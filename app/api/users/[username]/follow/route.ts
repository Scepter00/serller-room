import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { createNotification } from "@/lib/social";

async function resolveTarget(username: string) {
  return prisma.profile.findUnique({ where: { username: username.toLowerCase() } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  const { username } = await params;
  const target = await resolveTarget(username);
  if (!target) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }
  if (target.id === user.profile.id) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "You cannot follow yourself" } },
      { status: 400 }
    );
  }

  const blocked = await prisma.block.findUnique({
    where: {
      blockerId_blockedId: { blockerId: target.id, blockedId: user.profile.id },
    },
    select: { id: true },
  });
  if (blocked) {
    return NextResponse.json(
      { error: { code: "BLOCKED", message: "You cannot follow this user" } },
      { status: 403 }
    );
  }

  await prisma.follow.upsert({
    where: {
      followerId_followingId: {
        followerId: user.profile.id,
        followingId: target.id,
      },
    },
    create: { followerId: user.profile.id, followingId: target.id },
    update: {},
  });

  await createNotification({
    recipientId: target.id,
    actorId: user.profile.id,
    type: "FOLLOW",
  });

  return NextResponse.json({ following: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  const { username } = await params;
  const target = await resolveTarget(username);
  if (!target) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  await prisma.follow.deleteMany({
    where: { followerId: user.profile.id, followingId: target.id },
  });

  return NextResponse.json({ following: false });
}
