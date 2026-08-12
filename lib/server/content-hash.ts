import { createHash } from "node:crypto";

/**
 * Deterministic content hash for notarization. Covers the meaningful post
 * content so the on-chain record is verifiable against the post.
 *
 * Server-only module: node:crypto must never reach a client bundle.
 */
export function computeContentHash(input: {
  authorUsername: string;
  text?: string | null;
  mediaCid?: string | null;
  createdAt: string;
}): string {
  const canonical = JSON.stringify({
    author: input.authorUsername,
    text: input.text ?? null,
    mediaCid: input.mediaCid ?? null,
    createdAt: input.createdAt,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
