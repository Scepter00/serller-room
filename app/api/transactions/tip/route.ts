import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { tipSchema, parseJson } from "@/lib/validation";
import { rateLimitGuard } from "@/lib/rate-limit";
import { getNetworkConfig } from "@/lib/stellar/network";
import { xlmToStroops } from "@/lib/stellar/amounts";
import { TIP_MAX_STROOPS, TIP_MIN_STROOPS, TIP_MEMO_PREFIX } from "@/lib/constants";

/**
 * Build a real XLM payment for the creator.
 * The recipient is resolved server-side from the username — the client can
 * never tamper with who receives the money (Phase 10 security requirement).
 */
export async function POST(request: Request) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const limited = rateLimitGuard("tip", request);
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user?.profile?.username) return unauthorized();

  let body;
  try {
    body = tipSchema.parse(await parseJson(request));
  } catch (e) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: (e as Error).message } },
      { status: 400 }
    );
  }

  const amountStroops = xlmToStroops(body.amount);
  if (amountStroops < TIP_MIN_STROOPS || amountStroops > TIP_MAX_STROOPS) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_AMOUNT",
          message: "Tips must be between 1 and 1000 XLM",
        },
      },
      { status: 400 }
    );
  }

  const recipientProfile = await prisma.profile.findUnique({
    where: { username: body.username.toLowerCase() },
    include: { user: true },
  });
  if (!recipientProfile?.user) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Recipient not found" } },
      { status: 404 }
    );
  }
  if (recipientProfile.id === user.profile.id) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "You cannot tip yourself" } },
      { status: 400 }
    );
  }

  const network = getNetworkConfig();
  const horizon = new Horizon.Server(network.horizonUrl);

  let senderAccount;
  try {
    senderAccount = await horizon.loadAccount(user.walletAddress);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "SENDER_NOT_FUNDED",
          message:
            "Your wallet has no Stellar account yet. On Testnet, fund it from the Wallet page (Get testnet XLM).",
        },
      },
      { status: 400 }
    );
  }

  const memo = body.postId
    ? `${TIP_MEMO_PREFIX}${body.postId.slice(0, 14)}`
    : TIP_MEMO_PREFIX.slice(0, -1);

  const transaction = new TransactionBuilder(senderAccount, {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
  })
    .addOperation(
      Operation.payment({
        destination: recipientProfile.user.walletAddress,
        asset: Asset.native(),
        amount: body.amount,
      })
    )
    .addMemo(Memo.text(memo))
    .setTimeout(120)
    .build();

  const buildId = randomUUID();
  await prisma.transaction.create({
    data: {
      buildId,
      fromAddress: user.walletAddress,
      toAddress: recipientProfile.user.walletAddress,
      amount: amountStroops.toString(),
      asset: "XLM",
      postId: body.postId ?? null,
      memo,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    buildId,
    unsignedXdr: transaction.toXDR(),
    recipientAddress: recipientProfile.user.walletAddress,
    recipientUsername: recipientProfile.username,
    recipientDisplayName: recipientProfile.displayName,
    amount: amountStroops.toString(),
    networkPassphrase: network.passphrase,
    network: network.network,
  });
}
