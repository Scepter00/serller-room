import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySchema, parseJson } from "@/lib/validation";
import { rateLimitGuard } from "@/lib/rate-limit";
import { verifyWalletSignature } from "@/lib/stellar/verify";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

/**
 * Verify the wallet's signature over the issued challenge. On success:
 * upsert the user by wallet address, create the session cookie, and return
 * the session + whether the profile is newly created.
 */
export async function POST(request: Request) {
  const limited = rateLimitGuard("authVerify", request);
  if (limited) return limited;

  let body;
  try {
    body = verifySchema.parse(await parseJson(request));
  } catch (e) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: (e as Error).message } },
      { status: 400 }
    );
  }

  const challenge = await prisma.authChallenge.findUnique({
    where: { nonce: body.nonce },
  });

  if (!challenge || challenge.publicKey !== body.publicKey) {
    return NextResponse.json(
      { error: { code: "CHALLENGE_NOT_FOUND", message: "Invalid or unknown challenge" } },
      { status: 401 }
    );
  }
  if (challenge.used) {
    return NextResponse.json(
      { error: { code: "CHALLENGE_USED", message: "Challenge already used — start a new login" } },
      { status: 401 }
    );
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: { code: "CHALLENGE_EXPIRED", message: "Challenge expired — try again" } },
      { status: 401 }
    );
  }

  // Verify the wallet actually owns this public key (never trust the address alone).
  const valid = verifyWalletSignature(body.publicKey, challenge.message, body.signature);
  if (!valid) {
    return NextResponse.json(
      { error: { code: "INVALID_SIGNATURE", message: "Signature verification failed" } },
      { status: 401 }
    );
  }

  // Mark the challenge single-use (replay protection).
  await prisma.authChallenge.update({
    where: { id: challenge.id },
    data: { used: true },
  });

  const existing = await prisma.user.findUnique({
    where: { walletAddress: body.publicKey },
    include: { profile: true },
  });

  let user = existing;
  let isNewUser = false;
  if (!user) {
    user = await prisma.user.create({
      data: { walletAddress: body.publicKey, profile: { create: {} } },
      include: { profile: true },
    });
    isNewUser = true;
  }

  const token = await createSessionToken(user.id);
  const response = NextResponse.json({
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      profile: user.profile,
    },
    isNewUser,
  });
  setSessionCookie(response, token);
  return response;
}
