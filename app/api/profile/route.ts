import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { profileSchema, parseJson } from "@/lib/validation";

/**
 * Update the authenticated user's profile.
 * Usernames are claimed once (wallet ↔ username stay conceptually separate).
 */
export async function PATCH(request: Request) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body;
  try {
    body = profileSchema.parse(await parseJson(request));
  } catch (e) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: (e as Error).message } },
      { status: 400 }
    );
  }

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) return unauthorized();

  const data: {
    username?: string;
    displayName?: string | null;
    bio?: string | null;
    avatarCid?: string | null;
    avatarUrl?: string | null;
  } = {};

  if (body.username !== undefined) {
    const desired = body.username.toLowerCase();
    if (profile.username && profile.username !== desired) {
      return NextResponse.json(
        { error: { code: "USERNAME_LOCKED", message: "Username is already claimed" } },
        { status: 409 }
      );
    }
    const taken = await prisma.profile.findUnique({ where: { username: desired } });
    if (taken && taken.userId !== user.id) {
      return NextResponse.json(
        { error: { code: "USERNAME_TAKEN", message: "That username is taken" } },
        { status: 409 }
      );
    }
    data.username = desired;
  }
  if (body.displayName !== undefined) data.displayName = body.displayName;
  if (body.bio !== undefined) data.bio = body.bio;
  if (body.avatarCid !== undefined) data.avatarCid = body.avatarCid;
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;

  const updated = await prisma.profile.update({
    where: { userId: user.id },
    data,
  });

  return NextResponse.json({ profile: updated });
}
