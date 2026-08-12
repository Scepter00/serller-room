import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { createNotification } from "@/lib/social";

async function loadPost(postId: string) {
  return prisma.post.findUnique({ where: { id: postId } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  const { id } = await params;
  const post = await loadPost(id);
  if (!post || post.status !== "ACTIVE") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Post not found" } },
      { status: 404 }
    );
  }

  await prisma.like.upsert({
    where: { userId_postId: { userId: user.profile.id, postId: id } },
    create: { userId: user.profile.id, postId: id },
    update: {},
  });

  await createNotification({
    recipientId: post.authorId,
    actorId: user.profile.id,
    type: "LIKE",
    postId: id,
  });

  return NextResponse.json({ liked: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  const { id } = await params;
  await prisma.like.deleteMany({
    where: { userId: user.profile.id, postId: id },
  });

  return NextResponse.json({ liked: false });
}
