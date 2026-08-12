import { NextResponse } from "next/server";
import { RATE_LIMITS } from "@/lib/constants";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory sliding-window rate limiter keyed by (route, key).
 * NOTE: single-process only. For horizontally scaled deployments, replace
 * with a Redis-backed limiter (documented in docs/architecture/api.md).
 */
const buckets = new Map<string, Bucket>();

export type LimitName = keyof typeof RATE_LIMITS;

export function rateLimit(
  name: LimitName,
  key: string,
  now: number = Date.now()
): { ok: boolean; retryAfterSeconds: number } {
  const { windowMs, max } = RATE_LIMITS[name] ?? RATE_LIMITS.default;
  const bucketKey = `${name}:${key}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  if (bucket.count >= max) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/** Wrap a route handler with an IP-based rate limit; returns response on block. */
export function rateLimitGuard(
  name: LimitName,
  request: Request
): NextResponse | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const result = rateLimit(name, ip);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: `Too many requests. Try again in ${result.retryAfterSeconds}s.`,
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(result.retryAfterSeconds) },
      }
    );
  }
  return null;
}
