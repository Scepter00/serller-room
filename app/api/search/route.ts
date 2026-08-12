import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { serializePost } from "@/lib/feed";
import { hiddenAuthorIds, getVisibilityContext } from "@/lib/social";

/** Search users, posts and hashtags (Phase 12). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const type = url.searchParams.get("type") ?? "all";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);

  if (!q) {
    return NextResponse.json({ users: [], posts: [], hashtags: [] });
  }

  const session = await getSessionUser();
  const viewerProfileId = session?.profile?.id ?? null;
  const visibility = await getVisibilityContext(viewerProfileId);
  const hidden = hiddenAuthorIds(visibility);

  const results: {
    users: unknown[];
    posts: unknown[];
    hashtags: unknown[];
  } = { users: [], posts: [], hashtags: [] };

  const ql = q.toLowerCase();

  // Provider-agnostic search: SQLite (dev) and PostgreSQL (prod) both
  // support `contains`; case-insensitive narrowing happens in JS so the
  // schema works on both providers.
  const [users, posts, hashtags] = await Promise.all([
    type === "all" || type === "users"
      ? prisma.profile
          .findMany({
            where: { moderationStatus: "ACTIVE" },
            orderBy: { username: "asc" },
            take: limit * 4,
            include: { _count: { select: { followers: true } } },
          })
          .then((rows) =>
            rows
              .filter(
                (u) =>
                  (u.username ?? "").toLowerCase().includes(ql) ||
                  (u.displayName ?? "").toLowerCase().includes(ql)
              )
              .slice(0, limit)
          )
      : Promise.resolve([]),
    type === "all" || type === "posts"
      ? prisma.post
          .findMany({
            where: {
              status: "ACTIVE",
              text: { contains: q },
              ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: limit * 4,
            include: { author: true, _count: { select: { likes: true, comments: true } } },
          })
          .then((rows) =>
            rows
              .filter((p) => (p.text ?? "").toLowerCase().includes(ql))
              .slice(0, limit)
          )
      : Promise.resolve([]),
    type === "all" || type === "hashtags"
      ? prisma.postHashtag.groupBy({
          by: ["tag"],
          where: { tag: { contains: ql } },
          _count: { _all: true },
          orderBy: { _count: { tag: "desc" } },
          take: limit,
        })
      : Promise.resolve([]),
  ]);

  results.users = users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    followersCount: u._count.followers,
  }));
  results.posts = posts.map((p) => serializePost(p, false));
  results.hashtags = hashtags.map((h) => ({ tag: h.tag, count: h._count._all }));

  return NextResponse.json(results);
}
