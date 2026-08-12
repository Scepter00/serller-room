import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { explorerTxUrl } from "@/lib/explorer";

/** The viewer's tip history (sent + received via Serller). */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ fromAddress: user.walletAddress }, { toAddress: user.walletAddress }],
    },
    orderBy: { createdAt: "desc" },
    take: 31,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = transactions.length > 30;
  const page = hasMore ? transactions.slice(0, 30) : transactions;

  return NextResponse.json({
    transactions: page.map((t) => ({
      id: t.id,
      txHash: t.txHash,
      explorerUrl: t.txHash ? explorerTxUrl(t.txHash) : null,
      direction: t.fromAddress === user.walletAddress ? "sent" : "received",
      amount: t.amount,
      asset: t.asset,
      postId: t.postId,
      memo: t.memo,
      status: t.status,
      ledger: t.ledger,
      createdAt: t.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
