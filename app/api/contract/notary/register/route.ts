import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { notarizePayload } from "@/lib/feed";
import { buildRegisterInvocation } from "@/lib/contract";
import { rateLimitGuard } from "@/lib/rate-limit";

/**
 * Build a `notary.register` invocation for the post author's wallet to sign.
 * Requires the author's Stellar account to be funded on the network.
 */
export async function POST(request: Request) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const limited = rateLimitGuard("default", request);
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user?.profile?.username) return unauthorized();

  let body: { postId: string };
  try {
    body = JSON.parse(await request.text()) as { postId: string };
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Invalid body" } },
      { status: 400 }
    );
  }
  if (!body.postId || body.postId.length > 64) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "postId required" } },
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
  if (!post.contentHash) {
    return NextResponse.json(
      { error: { code: "NO_CONTENT_HASH", message: "Post has no content hash" } },
      { status: 400 }
    );
  }

  const payload = notarizePayload({
    authorUsername: user.profile.username,
    text: post.text,
    mediaCid: post.mediaCid,
    createdAt: post.createdAt.toISOString(),
  });

  let invocation;
  try {
    invocation = await buildRegisterInvocation({
      authorAddress: user.walletAddress,
      contentHash: payload.contentHash,
      uri: payload.uri,
    });
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg.includes("account") || msg.includes("not exist") || msg.includes("not found")) {
      return NextResponse.json(
        {
          error: {
            code: "ACCOUNT_NOT_FUNDED",
            message:
              "Your Stellar account must be funded first. On Testnet, use 'Get testnet XLM' in the Wallet page.",
          },
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INVOKE_BUILD_FAILED", message: msg } },
      { status: 502 }
    );
  }

  return NextResponse.json({
    postId: post.id,
    contentHash: payload.contentHash,
    uri: payload.uri,
    unsignedXdr: invocation.unsignedXdr,
    networkPassphrase: invocation.networkPassphrase,
  });
}
