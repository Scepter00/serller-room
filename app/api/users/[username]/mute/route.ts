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
      { error: { code: "INVALID_INPUT", message: "You cannot mute yourself" } },
      { status: 400 }
    );
  }

  await prisma.mute.upsert({
    where: { muterId_mutedId: { muterId: user.profile.id, mutedId: target.id } },
    create: { muterId: user.profile.id, mutedId: target.id },
    update: {},
  });

  return NextResponse.json({ muted: true });
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
  if (!target) return NextResponse.json({ muted: false });

  await prisma.mute.deleteMany({
    where: { muterId: user.profile.id, mutedId: target.id },
  });

  return NextResponse.json({ muted: false });
}
