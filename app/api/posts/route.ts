import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { createPostSchema, parseJson } from "@/lib/validation";
import { rateLimitGuard } from "@/lib/rate-limit";
import { getFeed, serializePost, notarizePayload, type FeedType } from "@/lib/feed";
import { getVisibilityContext } from "@/lib/social";
import { computeContentHash } from "@/lib/server/content-hash";
import { extractHashtags, extractMentions } from "@/lib/utils";

const FEED_TYPES: FeedType[] = ["following", "forYou", "latest", "trending"];

/** Feed: ?feed=following|forYou|latest|trending&cursor=<id> */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const feed = (url.searchParams.get("feed") ?? "forYou") as FeedType;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const type: FeedType = FEED_TYPES.includes(feed) ? feed : "forYou";

  const session = await getSessionUser();
  const visibility = await getVisibilityContext(session?.profile?.id ?? null);

  const result = await getFeed(type, {
    viewerProfileId: session?.profile?.id ?? null,
    visibility,
    cursor,
  });

  return NextResponse.json(result);
}

/** Create a post (text / image / link). */
export async function POST(request: Request) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const limited = rateLimitGuard("createPost", request);
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  let body;
  try {
    body = createPostSchema.parse(await parseJson(request));
  } catch (e) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: (e as Error).message } },
      { status: 400 }
    );
  }

  const authorUsername = user.profile.username ?? user.profile.id;
  const createdAt = new Date().toISOString();
  const contentHash = computeContentHash({
    authorUsername,
    text: body.text,
    mediaCid: body.mediaCid,
    createdAt,
  });

  const post = await prisma.post.create({
    data: {
      authorId: user.profile.id,
      text: body.text ?? null,
      link: body.link ?? null,
      mediaCid: body.mediaCid ?? null,
      contentHash,
      notarized: false,
      hashtags: {
        create: extractHashtags(body.text ?? "").map((tag) => ({ tag })),
      },
    },
    include: { author: true, _count: { select: { likes: true, comments: true } } },
  });

  // Mention notifications (Phase 12).
  const mentions = extractMentions(body.text ?? "");
  if (mentions.length) {
    const mentionedProfiles = await prisma.profile.findMany({
      where: { username: { in: mentions } },
      select: { id: true, username: true },
    });
    for (const mentioned of mentionedProfiles) {
      if (mentioned.id === user.profile.id) continue;
      await prisma.notification.create({
        data: {
          recipientId: mentioned.id,
          actorId: user.profile.id,
          type: "MENTION",
          postId: post.id,
        },
      });
    }
  }

  const notaryPayload =
    body.notarize && user.profile.username
      ? notarizePayload({
          authorUsername: user.profile.username,
          text: body.text,
          mediaCid: body.mediaCid,
          createdAt,
        })
      : null;

  return NextResponse.json(
    {
      post: serializePost(post, false),
      notarize: notaryPayload,
    },
    { status: 201 }
  );
}
