import { NextResponse } from "next/server";
import { getNetworkConfig } from "@/lib/stellar/network";
import { contractId, notaryConfigured } from "@/lib/contract";

/** Notary contract status (Phase 9). */
export async function GET() {
  return NextResponse.json({
    configured: notaryConfigured(),
    contractId: contractId(),
    network: getNetworkConfig().network,
    rpcUrl: getNetworkConfig().rpcUrl,
  });
}
