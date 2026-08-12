import { NextResponse } from "next/server";
import {
  BadRequestError,
  Horizon,
  NotFoundError,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { submitSchema, parseJson } from "@/lib/validation";
import { rateLimitGuard } from "@/lib/rate-limit";
import { getNetworkConfig } from "@/lib/stellar/network";
import { xlmToStroops } from "@/lib/stellar/amounts";
import { explorerTxUrl } from "@/lib/explorer";

/**
 * Submit a wallet-signed tip. Before forwarding to Horizon, the server
 * re-verifies the transaction matches the server-built intent:
 * source, destination, amount and asset (Phase 10 security requirement).
 */
export async function POST(request: Request) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const limited = rateLimitGuard("tip", request);
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  let body;
  try {
    body = submitSchema.parse(await parseJson(request));
  } catch (e) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: (e as Error).message } },
      { status: 400 }
    );
  }

  const record = await prisma.transaction.findUnique({
    where: { buildId: body.buildId },
  });
  if (!record || record.fromAddress !== user.walletAddress) {
    return NextResponse.json(
      { error: { code: "BUILD_NOT_FOUND", message: "Unknown transaction build" } },
      { status: 400 }
    );
  }

  // Idempotency: if already confirmed, return the recorded result.
  if (record.status === "CONFIRMED" && record.txHash) {
    return NextResponse.json({
      txHash: record.txHash,
      status: "confirmed",
      explorerUrl: explorerTxUrl(record.txHash),
      amount: record.amount,
      duplicate: true,
    });
  }

  const network = getNetworkConfig();

  // Parse the signed transaction.
  let tx;
  try {
    tx = TransactionBuilder.fromXDR(body.signedXdr, network.passphrase);
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_XDR", message: "The wallet returned an invalid transaction" } },
      { status: 400 }
    );
  }

  // Re-verify against the recorded intent (never trust the client).
  if (!(tx instanceof Transaction) || tx.source !== record.fromAddress) {
    return NextResponse.json(
      { error: { code: "TX_MISMATCH", message: "Transaction source does not match the intended sender" } },
      { status: 403 }
    );
  }
  const op = tx.operations[0];
  if (!op || op.type !== "payment") {
    return NextResponse.json(
      { error: { code: "TX_MISMATCH", message: "Transaction does not contain a payment" } },
      { status: 403 }
    );
  }
  const payment = op as unknown as {
    destination: string;
    asset: { isNative(): boolean };
    amount: string;
  };
  if (payment.destination !== record.toAddress) {
    return NextResponse.json(
      { error: { code: "TX_MISMATCH", message: "Payment destination was tampered with" } },
      { status: 403 }
    );
  }
  if (!payment.asset.isNative()) {
    return NextResponse.json(
      { error: { code: "TX_MISMATCH", message: "Payment asset is not XLM" } },
      { status: 403 }
    );
  }
  if (xlmToStroops(payment.amount) !== BigInt(record.amount)) {
    return NextResponse.json(
      { error: { code: "TX_MISMATCH", message: "Payment amount was tampered with" } },
      { status: 403 }
    );
  }

  // Forward to Horizon.
  const horizon = new Horizon.Server(network.horizonUrl);
  try {
    const result = await horizon.submitTransaction(tx);
    const txHash = result.hash;

    await prisma.transaction.update({
      where: { id: record.id },
      data: { status: "CONFIRMED", txHash, ledger: result.ledger },
    });

    // Record for the indexer (idempotent).
    await prisma.blockchainEvent.upsert({
      where: { txHash_opIndex: { txHash, opIndex: 0 } },
      create: {
        txHash,
        opIndex: 0,
        type: "PAYMENT",
        data: JSON.stringify({
          from: record.fromAddress,
          to: record.toAddress,
          amount: record.amount,
          memo: record.memo,
        }),
      },
      update: {},
    });

    // Tip notification.
    if (record.postId) {
      const recipient = await prisma.profile.findFirst({
        where: { user: { walletAddress: record.toAddress } },
        select: { id: true },
      });
      const sender = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (recipient && sender && recipient.id !== sender.id) {
        await prisma.notification.create({
          data: {
            recipientId: recipient.id,
            actorId: sender.id,
            type: "TIP",
            postId: record.postId,
          },
        });
      }
    }

    return NextResponse.json({
      txHash,
      status: "confirmed",
      explorerUrl: explorerTxUrl(txHash),
      amount: record.amount,
    });
  } catch (e) {
    await prisma.transaction.update({
      where: { id: record.id },
      data: { status: "FAILED" },
    });
    return mapSubmitError(e);
  }
}

function mapSubmitError(e: unknown): NextResponse {
  if (e instanceof NotFoundError) {
    return NextResponse.json(
      { error: { code: "TX_NOT_FOUND", message: "Transaction could not be found on the network" } },
      { status: 400 }
    );
  }
  if (e instanceof BadRequestError) {
    const data = (e.response?.data as
      | { extras?: { result_codes?: { transaction?: string; operations?: string[] } } }
      | undefined);
    const codes = data?.extras?.result_codes;
    const message = friendlyTxError(codes?.transaction, codes?.operations?.[0]);
    return NextResponse.json(
      { error: { code: "TX_REJECTED", message } },
      { status: 400 }
    );
  }
  const raw = (e as Error).message ?? "Unknown error";
  return NextResponse.json(
    {
      error: {
        code: "NETWORK_ERROR",
        message: `Network error submitting transaction: ${raw.slice(0, 160)}`,
      },
    },
    { status: 502 }
  );
}

function friendlyTxError(txCode?: string, opCode?: string): string {
  const map: Record<string, string> = {
    op_underfunded: "Insufficient balance to complete this payment",
    op_no_destination: "The recipient account does not exist",
    op_bad_auth: "Transaction authorization failed",
    op_too_few_entries: "Network reserve limits reached",
    tx_bad_seq: "Sequence number conflict — please try again",
    tx_too_late: "Transaction timed out — please try again",
    tx_insufficient_fee: "Insufficient fee — please try again",
    tx_failed: "Transaction failed on the network",
  };
  const code = opCode ?? txCode ?? "tx_failed";
  return map[code] ?? `Transaction rejected: ${code}`;
}
