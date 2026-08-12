import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { serializePost } from "@/lib/feed";
import { hiddenAuthorIds, getVisibilityContext } from "@/lib/social";

/** Discover: trending users, trending hashtags, recent posts. */
export async function GET() {
  const session = await getSessionUser();
  const viewerProfileId = session?.profile?.id ?? null;
  const visibility = await getVisibilityContext(viewerProfileId);
  const hidden = hiddenAuthorIds(visibility);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [trendingUsers, trendingHashtags, recentPosts] = await Promise.all([
    prisma.profile.findMany({
      where: { moderationStatus: "ACTIVE" },
      orderBy: { followers: { _count: "desc" } },
      take: 10,
      include: { _count: { select: { followers: true } } },
    }),
    prisma.postHashtag.groupBy({
      by: ["tag"],
      where: { post: { createdAt: { gte: since } } },
      _count: { _all: true },
      orderBy: { _count: { tag: "desc" } },
      take: 10,
    }),
    prisma.post.findMany({
      where: {
        status: "ACTIVE",
        createdAt: { gte: since },
        ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
      },
      orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
      take: 10,
      include: { author: true, _count: { select: { likes: true, comments: true } } },
    }),
  ]);

  return NextResponse.json({
    trendingUsers: trendingUsers.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      followersCount: u._count.followers,
    })),
    trendingHashtags: trendingHashtags.map((h) => ({ tag: h.tag, count: h._count._all })),
    recentPosts: recentPosts.map((p) => serializePost(p, false)),
  });
}
