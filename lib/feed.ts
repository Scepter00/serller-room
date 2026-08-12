import { prisma } from "@/lib/db";
import { hiddenAuthorIds, type VisibilityContext } from "@/lib/social";
import { computeContentHash } from "@/lib/server/content-hash";
import { ipfsUrl } from "@/lib/utils";
import { IPFS_GATEWAY } from "@/lib/storage";
import { PAGE_SIZE } from "@/lib/constants";
import type { Post, Profile } from "@prisma/client";

export interface PostAuthor {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ApiPost {
  id: string;
  text: string | null;
  link: string | null;
  mediaCid: string | null;
  mediaUrl: string | null;
  notarized: boolean;
  notaryTxHash: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  author: PostAuthor;
}

export function mediaUrlFor(cid: string | null): string | null {
  if (!cid) return null;
  if (cid.startsWith("/") || cid.startsWith("http")) return cid;
  return ipfsUrl(cid, IPFS_GATEWAY);
}

/** Serialize a post (with counts) into the API shape. */
export function serializePost(
  post: Post & {
    author: Profile;
    _count?: { likes: number; comments: number };
  },
  likedByMe = false
): ApiPost {
  return {
    id: post.id,
    text: post.text,
    link: post.link,
    mediaCid: post.mediaCid,
    mediaUrl: mediaUrlFor(post.mediaCid),
    notarized: post.notarized,
    notaryTxHash: post.notaryTxHash,
    contentHash: post.contentHash,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    likeCount: post._count?.likes ?? 0,
    commentCount: post._count?.comments ?? 0,
    likedByMe,
    author: {
      username: post.author.username,
      displayName: post.author.displayName,
      avatarUrl: post.author.avatarUrl,
    },
  };
}

export type FeedType = "following" | "forYou" | "latest" | "trending";

export interface FeedOptions {
  viewerProfileId: string | null;
  visibility: VisibilityContext;
  cursor?: string;
  limit?: number;
}

/**
 * Fetch a feed page using keyset pagination (cursor = last post id).
 * Blocked users' content is filtered (Phase 12 moderation).
 */
export async function getFeed(
  type: FeedType,
  { viewerProfileId, visibility, cursor, limit = PAGE_SIZE }: FeedOptions
) {
  const hidden = hiddenAuthorIds(visibility);

  const baseWhere = {
    status: "ACTIVE" as const,
    authorId: { notIn: hidden.length ? hidden : undefined },
  };

  let where;
  if (type === "following") {
    if (!viewerProfileId) return { posts: [], nextCursor: null };
    const following = await prisma.follow.findMany({
      where: { followerId: viewerProfileId },
      select: { followingId: true },
    });
    where = {
      ...baseWhere,
      authorId: { in: following.map((f) => f.followingId) },
    };
  } else if (type === "trending") {
    where = {
      ...baseWhere,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    };
  } else {
    where = baseWhere;
  }

  const posts = await prisma.post.findMany({
    where: cursor
      ? { ...where, id: { lt: cursor } } // cuid ordering ~= chronological for v0.1
      : where,
    orderBy:
      type === "trending"
        ? [{ likes: { _count: "desc" } }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }],
    take: limit + 1,
    include: {
      author: true,
      _count: { select: { likes: true, comments: true } },
    },
  });

  const hasMore = posts.length > limit;
  const page = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  let likedIds = new Set<string>();
  if (viewerProfileId) {
    const liked = await prisma.like.findMany({
      where: { userId: viewerProfileId, postId: { in: page.map((p) => p.id) } },
      select: { postId: true },
    });
    likedIds = new Set(liked.map((l) => l.postId));
  }

  return {
    posts: page.map((p) => serializePost(p, likedIds.has(p.id))),
    nextCursor,
  };
}

/** Load a single post with author + counts + viewer's like state. */
export async function getPostWithMeta(
  postId: string,
  viewerProfileId: string | null
) {
  const post = await prisma.post.findFirst({
    where: { id: postId, status: "ACTIVE" },
    include: {
      author: true,
      _count: { select: { likes: true, comments: true } },
    },
  });
  if (!post || !viewerProfileId) return post;

  const like = await prisma.like.findUnique({
    where: { userId_postId: { userId: viewerProfileId, postId } },
    select: { id: true },
  });
  return { ...post, _likedByMe: !!like };
}

/** Build the notarization anchor payload for a post. */
export function notarizePayload(input: {
  authorUsername: string;
  text?: string | null;
  mediaCid?: string | null;
  createdAt: string;
}): { contentHash: string; uri: string } {
  const contentHash = computeContentHash(input);
  const uri = `serller://post/${contentHash.slice(0, 16)}`;
  return { contentHash, uri };
}
