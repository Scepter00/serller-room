import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { getVisibilityContext } from "@/lib/social";

const NOTIFICATION_ICONS: Record<string, string> = {
  FOLLOW: "follow",
  LIKE: "like",
  COMMENT: "comment",
  REPLY: "reply",
  MENTION: "mention",
  TIP: "tip",
};

/** List the viewer's notifications (marks them read) with pagination. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const visibility = await getVisibilityContext(user.profile.id);
  const excludedActors = [
    ...new Set([...visibility.mutedIds, ...visibility.mutingIds, ...visibility.blockedIds, ...visibility.blockingIds]),
  ];

  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: user.profile.id,
      ...(excludedActors.length ? { actorId: { notIn: excludedActors } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 31,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: { actor: true },
  });

  const hasMore = notifications.length > 30;
  const page = hasMore ? notifications.slice(0, 30) : notifications;

  // Mark read (fire and forget).
  const unreadIds = page.filter((n) => !n.read).map((n) => n.id);
  if (unreadIds.length) {
    void prisma.notification.updateMany({
      where: { id: { in: unreadIds } },
      data: { read: true },
    });
  }

  return NextResponse.json({
    notifications: page.map((n) => ({
      id: n.id,
      type: n.type,
      kind: NOTIFICATION_ICONS[n.type] ?? n.type,
      read: n.read,
      postId: n.postId,
      createdAt: n.createdAt.toISOString(),
      actor: n.actor
        ? {
            username: n.actor.username,
            displayName: n.actor.displayName,
            avatarUrl: n.actor.avatarUrl,
          }
        : null,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    unreadCount: await prisma.notification.count({
      where: { recipientId: user.profile.id, read: false },
    }),
  });
}
