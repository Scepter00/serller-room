import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { challengeSchema, parseJson } from "@/lib/validation";
import { rateLimitGuard } from "@/lib/rate-limit";
import { isValidPublicKey } from "@/lib/utils";
import { CHALLENGE_PREFIX, CHALLENGE_TTL_MS } from "@/lib/constants";

/**
 * Issue a single-use, expiring login challenge bound to a public key.
 * The wallet must sign `message`; verification happens in /auth/verify.
 */
export async function POST(request: Request) {
  const limited = rateLimitGuard("authChallenge", request);
  if (limited) return limited;

  let body;
  try {
    body = challengeSchema.parse(await parseJson(request));
  } catch (e) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: (e as Error).message } },
      { status: 400 }
    );
  }

  if (!isValidPublicKey(body.publicKey)) {
    return NextResponse.json(
      { error: { code: "INVALID_PUBLIC_KEY", message: "Not a valid Stellar public key" } },
      { status: 400 }
    );
  }

  const nonce = randomUUID();
  const message = `${CHALLENGE_PREFIX}${nonce}`;

  await prisma.authChallenge.create({
    data: {
      publicKey: body.publicKey,
      nonce,
      message,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  return NextResponse.json({
    nonce,
    message,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  });
}
