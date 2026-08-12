import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { rateLimitGuard } from "@/lib/rate-limit";
import { getNetworkConfig } from "@/lib/stellar/network";

/**
 * Fund the authenticated user's wallet with testnet XLM via Friendbot.
 * Testnet only — returns a friendly error on mainnet.
 * No secrets involved: friendbot funds the target address directly.
 */
export async function POST(request: Request) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const limited = rateLimitGuard("authChallenge", request); // reuse tight limit
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  const network = getNetworkConfig();
  if (!network.friendbotUrl) {
    return NextResponse.json(
      { error: { code: "MAINNET", message: "Friendbot funding is Testnet-only" } },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${network.friendbotUrl}?addr=${encodeURIComponent(user.walletAddress)}`,
      { signal: AbortSignal.timeout(20000) }
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: {
            code: "FUND_FAILED",
            message: `Friendbot responded ${response.status}: ${body.slice(0, 160)}`,
          },
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ funded: true, address: user.walletAddress });
  } catch {
    return NextResponse.json(
      { error: { code: "NETWORK_ERROR", message: "Could not reach Friendbot" } },
      { status: 502 }
    );
  }
}
