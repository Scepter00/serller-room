import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { submitInvocation } from "@/lib/contract";
import { explorerTxUrl } from "@/lib/explorer";
import { rateLimitGuard } from "@/lib/rate-limit";

/**
 * Submit a user-signed notary invocation and mark the post notarized.
 * Requires an un-notarized post owned by the caller.
 */
export async function POST(request: Request) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const limited = rateLimitGuard("default", request);
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  let body: { postId: string; signedXdr: string };
  try {
    body = JSON.parse(await request.text()) as { postId: string; signedXdr: string };
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Invalid body" } },
      { status: 400 }
    );
  }
  if (!body.postId || !body.signedXdr) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "postId and signedXdr required" } },
      { status: 400 }
    );
  }

  const post = await prisma.post.findUnique({ where: { id: body.postId } });
  if (!post || post.status !== "ACTIVE") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Post not found" } },
      { status: 404 }
    );
  }
  if (post.authorId !== user.profile.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You can only notarize your own posts" } },
      { status: 403 }
    );
  }
  if (post.notarized) {
    return NextResponse.json(
      { error: { code: "ALREADY_NOTARIZED", message: "Post is already notarized" } },
      { status: 409 }
    );
  }

  try {
    const result = await submitInvocation(body.signedXdr);
    if (result.status !== "confirmed") {
      return NextResponse.json(
        {
          error: {
            code: "NOTARY_TX_FAILED",
            message: `Notary transaction ${result.status} (${result.txHash})`,
          },
        },
        { status: 400 }
      );
    }

    await prisma.post.update({
      where: { id: post.id },
      data: { notarized: true, notaryTxHash: result.txHash },
    });

    return NextResponse.json({
      notarized: true,
      txHash: result.txHash,
      explorerUrl: explorerTxUrl(result.txHash),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: "NOTARY_SUBMIT_FAILED",
          message: (e as Error).message ?? "Notary submission failed",
        },
      },
      { status: 502 }
    );
  }
}
