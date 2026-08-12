import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { updatePostSchema, parseJson } from "@/lib/validation";
import { serializePost, getPostWithMeta } from "@/lib/feed";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSessionUser();

  const post = await getPostWithMeta(id, session?.profile?.id ?? null);
  if (!post) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Post not found" } },
      { status: 404 }
    );
  }

  const serialized = serializePost(
    { ...post, _count: post._count },
    (post as unknown as { _likedByMe?: boolean })._likedByMe ?? false
  );

  return NextResponse.json({ post: serialized });
}

/** Edit post text (owner only; notarized posts are immutable anchors). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || post.status !== "ACTIVE") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Post not found" } },
      { status: 404 }
    );
  }
  if (post.authorId !== user.profile.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You can only edit your own posts" } },
      { status: 403 }
    );
  }
  if (post.notarized) {
    return NextResponse.json(
      { error: { code: "NOTARIZED_IMMUTABLE", message: "Notarized posts cannot be edited" } },
      { status: 409 }
    );
  }

  let body;
  try {
    body = updatePostSchema.parse(await parseJson(request));
  } catch (e) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: (e as Error).message } },
      { status: 400 }
    );
  }

  const updated = await prisma.post.update({
    where: { id },
    data: { text: body.text ?? null },
    include: { author: true, _count: { select: { likes: true, comments: true } } },
  });

  return NextResponse.json({ post: serializePost(updated, false) });
}

/** Delete (soft-delete → status REMOVED) — owner only. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || post.status !== "ACTIVE") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Post not found" } },
      { status: 404 }
    );
  }
  if (post.authorId !== user.profile.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You can only delete your own posts" } },
      { status: 403 }
    );
  }

  await prisma.post.update({ where: { id }, data: { status: "REMOVED" } });
  return NextResponse.json({ deleted: true });
}
