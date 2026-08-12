import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CSRF_HEADER, SESSION_COOKIE } from "@/lib/constants";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? "insecure-dev-secret");
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 7);

export interface SessionUser {
  id: string;
  walletAddress: string;
  profile: {
    id: string;
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    avatarCid: string | null;
    moderationStatus: string;
  } | null;
}

/** Issue a signed JWT for the given user id. */
export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(SECRET);
}

/** Set the session cookie on a response. */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/** Load the authenticated user + profile from the session cookie (or null). */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, SECRET);
    const userId = payload.sub;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) return null;

    return {
      id: user.id,
      walletAddress: user.walletAddress,
      profile: user.profile
        ? {
            id: user.profile.id,
            username: user.profile.username,
            displayName: user.profile.displayName,
            bio: user.profile.bio,
            avatarUrl: user.profile.avatarUrl,
            avatarCid: user.profile.avatarCid,
            moderationStatus: user.profile.moderationStatus,
          }
        : null,
    };
  } catch {
    return null;
  }
}

/** Return a 401 response with a structured error. */
export function unauthorized(message = "Authentication required"): NextResponse {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message } },
    { status: 401 }
  );
}

/** CSRF defense: require the custom header on state-changing requests. */
export function csrfGuard(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return null;

  const header = request.headers.get(CSRF_HEADER);
  if (header !== "1") {
    return NextResponse.json(
      { error: { code: "CSRF_REJECTED", message: "Missing CSRF header" } },
      { status: 403 }
    );
  }
  return null;
}
