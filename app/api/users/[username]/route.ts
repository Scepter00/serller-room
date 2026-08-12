import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getVisibilityContext, hiddenAuthorIds } from "@/lib/social";
import { serializePost } from "@/lib/feed";

/**
 * Public profile page data: profile, stats, relationship state for the viewer,
 * and the first page of the user's posts.
 * Note: the wallet address is never exposed for other users' profiles.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const profile = await prisma.profile.findUnique({
    where: { username: username.toLowerCase() },
  });
  if (!profile || profile.moderationStatus === "SUSPENDED") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  const session = await getSessionUser();
  const viewerProfileId = session?.profile?.id ?? null;

  const [followersCount, followingCount, postsCount] = await Promise.all([
    prisma.follow.count({ where: { followingId: profile.id } }),
    prisma.follow.count({ where: { followerId: profile.id } }),
    prisma.post.count({ where: { authorId: profile.id, status: "ACTIVE" } }),
  ]);

  let isFollowing = false;
  let isSelf = false;
  let blocked = false;
  let blockingMe = false;
  let muted = false;

  if (viewerProfileId) {
    isSelf = viewerProfileId === profile.id;
    const [follow, block, reverseBlock, mute] = await Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerProfileId,
            followingId: profile.id,
          },
        },
        select: { id: true },
      }),
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: { blockerId: viewerProfileId, blockedId: profile.id },
        },
        select: { id: true },
      }),
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: { blockerId: profile.id, blockedId: viewerProfileId },
        },
        select: { id: true },
      }),
      prisma.mute.findUnique({
        where: { muterId_mutedId: { muterId: viewerProfileId, mutedId: profile.id } },
        select: { id: true },
      }),
    ]);
    isFollowing = !!follow;
    blocked = !!block;
    blockingMe = !!reverseBlock;
    muted = !!mute;
  }

  // Posts (first page), filtering blocked relations (Phase 12 moderation).
  const visibility = await getVisibilityContext(viewerProfileId);
  const hidden = hiddenAuthorIds(visibility);
  const hiddenSet = new Set(hidden);

  const posts = await prisma.post.findMany({
    where: {
      authorId: profile.id,
      status: "ACTIVE",
      ...(hiddenSet.size ? { authorId: { notIn: [...hiddenSet] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 11,
    include: { author: true, _count: { select: { likes: true, comments: true } } },
  });

  const hasMore = posts.length > 10;
  const page = hasMore ? posts.slice(0, 10) : posts;

  let likedIds = new Set<string>();
  if (viewerProfileId) {
    const likes = await prisma.like.findMany({
      where: { userId: viewerProfileId, postId: { in: page.map((p) => p.id) } },
      select: { postId: true },
    });
    likedIds = new Set(likes.map((l) => l.postId));
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      followersCount,
      followingCount,
      postsCount,
      isFollowing,
      isSelf,
      blocked,
      blockingMe,
      muted,
      createdAt: profile.createdAt.toISOString(),
    },
    posts: page.map((p) => serializePost(p, likedIds.has(p.id))),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
