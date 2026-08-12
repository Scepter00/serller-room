import { z } from "zod";
import {
  BIO_MAX,
  COMMENT_TEXT_MAX,
  POST_TEXT_MAX,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_PATTERN,
} from "@/lib/constants";

export const publicKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(56)
  .regex(/^[GCA][A-Z2-7]{55}$/, "Invalid Stellar address format");

export const challengeSchema = z.object({
  publicKey: publicKeySchema,
});

export const verifySchema = z.object({
  publicKey: publicKeySchema,
  nonce: z.string().trim().min(1).max(64),
  signature: z.string().trim().min(1).max(4096),
});

export const usernameField = z
  .string()
  .trim()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters`)
  .regex(USERNAME_PATTERN, "Usernames: start with a letter, then letters, numbers or _");

export const createPostSchema = z
  .object({
    text: z.string().trim().max(POST_TEXT_MAX).optional(),
    mediaCid: z.string().trim().max(256).optional(),
    mediaUrl: z.string().trim().max(512).optional(),
    link: z.string().trim().max(512).optional(),
    notarize: z.boolean().optional().default(false),
  })
  .refine(
    (v) => !!(v.text || v.mediaCid || v.link),
    "A post needs text, an image, or a link"
  );

export const updatePostSchema = z.object({
  text: z.string().trim().max(POST_TEXT_MAX).optional(),
});

export const commentSchema = z.object({
  text: z.string().trim().min(1).max(COMMENT_TEXT_MAX),
  parentId: z.string().trim().max(64).optional(),
});

export const profileSchema = z.object({
  username: usernameField.optional(),
  displayName: z.string().trim().max(50).optional(),
  bio: z.string().trim().max(BIO_MAX).optional(),
  avatarCid: z.string().trim().max(256).optional(),
  avatarUrl: z.string().trim().max(512).optional(),
});

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,7})?$/, "Amount must be a positive XLM number (up to 7 decimals)");

export const tipSchema = z.object({
  username: usernameField,
  amount: amountSchema,
  postId: z.string().trim().max(64).optional(),
});

export const submitSchema = z.object({
  buildId: z.string().trim().min(1).max(64),
  signedXdr: z.string().trim().min(1).max(32_768),
});

export const reportSchema = z.object({
  targetType: z.enum(["USER", "POST"]),
  targetId: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(1).max(300),
});

export const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  type: z.enum(["users", "posts", "hashtags"]).optional(),
  cursor: z.string().trim().max(64).optional(),
});

export const mediaSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(100),
  size: z.number().int().positive().max(8 * 1024 * 1024),
});

export const notaryVerifySchema = z.object({
  contentHash: z.string().trim().regex(/^[0-9a-f]{64}$/, "contentHash must be sha256 hex"),
});

/** Parse JSON body safely; returns parsed data or throws a 400 response. */
export async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new JsonParseError();
  }
}

export class JsonParseError extends Error {
  constructor() {
    super("Invalid JSON body");
  }
}
