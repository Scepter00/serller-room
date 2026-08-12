import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { commentSchema, parseJson } from "@/lib/validation";
import { COMMENTS_PAGE_SIZE } from "@/lib/constants";

interface CommentAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

function serializeComment(c: {
  id: string;
  text: string;
  parentId: string | null;
  createdAt: Date;
  author: CommentAuthor;
}) {
  return {
    id: c.id,
    text: c.text,
    parentId: c.parentId,
    createdAt: c.createdAt.toISOString(),
    author: {
      username: c.author.username,
      displayName: c.author.displayName,
      avatarUrl: c.author.avatarUrl,
    },
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const comments = await prisma.comment.findMany({
    where: { postId: id, status: "ACTIVE" },
    orderBy: [{ parentId: "asc" }, { createdAt: "asc" }],
    take: COMMENTS_PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: { author: true },
  });

  const hasMore = comments.length > COMMENTS_PAGE_SIZE;
  const page = hasMore ? comments.slice(0, COMMENTS_PAGE_SIZE) : comments;

  return NextResponse.json({
    comments: page.map(serializeComment),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}

/** Add a comment or reply (parentId). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: true },
  });
  if (!post || post.status !== "ACTIVE") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Post not found" } },
      { status: 404 }
    );
  }

  let body;
  try {
    body = commentSchema.parse(await parseJson(request));
  } catch (e) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: (e as Error).message } },
      { status: 400 }
    );
  }

  let parentAuthorId: string | null = null;
  if (body.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: body.parentId } });
    if (!parent || parent.postId !== id) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Parent comment not found" } },
        { status: 400 }
      );
    }
    parentAuthorId = parent.authorId;
  }

  const comment = await prisma.comment.create({
    data: {
      postId: id,
      authorId: user.profile.id,
      parentId: body.parentId ?? null,
      text: body.text,
    },
    include: { author: true },
  });

  if (body.parentId && parentAuthorId) {
    await prisma.notification.create({
      data: {
        recipientId: parentAuthorId,
        actorId: user.profile.id,
        type: "REPLY",
        postId: id,
      },
    });
  } else {
    await prisma.notification.create({
      data: {
        recipientId: post.authorId,
        actorId: user.profile.id,
        type: "COMMENT",
        postId: id,
      },
    });
  }

  return NextResponse.json(
    { comment: serializeComment(comment) },
    { status: 201 }
  );
}
