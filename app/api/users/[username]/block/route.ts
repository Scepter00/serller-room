import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";

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
      { error: { code: "INVALID_INPUT", message: "You cannot block yourself" } },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.block.upsert({
      where: {
        blockerId_blockedId: { blockerId: user.profile.id, blockedId: target.id },
      },
      create: { blockerId: user.profile.id, blockedId: target.id },
      update: {},
    }),
    // Blocking removes the follow relationship both ways.
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: user.profile.id, followingId: target.id },
          { followerId: target.id, followingId: user.profile.id },
        ],
      },
    }),
  ]);

  return NextResponse.json({ blocked: true });
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
  if (!target) return NextResponse.json({ blocked: false });

  await prisma.block.deleteMany({
    where: { blockerId: user.profile.id, blockedId: target.id },
  });

  return NextResponse.json({ blocked: false });
}
