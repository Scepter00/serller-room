import { prisma } from "@/lib/db";
import type { NotificationType } from "@prisma/client";

/**
 * Create a notification, skipping self-notifications.
 * Notifications to muted/blocked relations are filtered at read time.
 */
export async function createNotification(input: {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  postId?: string | null;
}): Promise<void> {
  if (input.recipientId === input.actorId) return;
  if (!input.actorId) return;

  await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      postId: input.postId ?? null,
    },
  });
}

export interface VisibilityContext {
  /** Profile ids the viewer blocked (their content is hidden). */
  blockedIds: string[];
  /** Profile ids that blocked the viewer (their content is hidden too). */
  blockingIds: string[];
  /** Profile ids the viewer muted. */
  mutedIds: string[];
  /** Profile ids that muted the viewer (no notifications). */
  mutingIds: string[];
}

/** Load all visibility relations for a viewer profile (empty context when anonymous). */
export async function getVisibilityContext(
  profileId: string | null | undefined
): Promise<VisibilityContext> {
  const empty: VisibilityContext = {
    blockedIds: [],
    blockingIds: [],
    mutedIds: [],
    mutingIds: [],
  };
  if (!profileId) return empty;

  const [blocks, blockedBy, mutes, mutedBy] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: profileId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: profileId }, select: { blockerId: true } }),
    prisma.mute.findMany({ where: { muterId: profileId }, select: { mutedId: true } }),
    prisma.mute.findMany({ where: { mutedId: profileId }, select: { muterId: true } }),
  ]);

  return {
    blockedIds: blocks.map((b) => b.blockedId),
    blockingIds: blockedBy.map((b) => b.blockerId),
    mutedIds: mutes.map((m) => m.mutedId),
    mutingIds: mutedBy.map((m) => m.muterId),
  };
}

/** A set of profile ids the viewer cannot see content from. */
export function hiddenAuthorIds(ctx: VisibilityContext): string[] {
  return [...new Set([...ctx.blockedIds, ...ctx.blockingIds])];
}
