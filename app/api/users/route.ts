import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/** Search users by username or display name. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);

  if (!q) return NextResponse.json({ users: [] });

  const viewer = await getSessionUser();
  const viewerProfileId = viewer?.profile?.id ?? null;

  // Provider-agnostic search (SQLite dev / PostgreSQL prod): fetch a bounded
  // superset and narrow case-insensitively in JS.
  const ql = q.toLowerCase();
  const users = (await prisma.profile.findMany({
    where: { moderationStatus: "ACTIVE" },
    orderBy: { username: "asc" },
    take: limit * 4,
    include: { _count: { select: { followers: true, posts: true } } },
  })).filter(
    (u) =>
      (u.username ?? "").toLowerCase().includes(ql) ||
      (u.displayName ?? "").toLowerCase().includes(ql)
  ).slice(0, limit);

  // Hide blocked relations from results when signed in.
  let blockedIds = new Set<string>();
  if (viewerProfileId) {
    const blocks = await prisma.block.findMany({
      where: { blockerId: viewerProfileId },
      select: { blockedId: true },
    });
    blockedIds = new Set(blocks.map((b) => b.blockedId));
  }

  return NextResponse.json({
    users: users
      .filter((u) => !blockedIds.has(u.id))
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        bio: u.bio,
        avatarUrl: u.avatarUrl,
        followersCount: u._count.followers,
        postsCount: u._count.posts,
      })),
  });
}
