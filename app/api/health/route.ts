import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getNetworkConfig } from "@/lib/stellar/network";

export async function GET() {
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }

  const network = getNetworkConfig().network;
  let networkStatus = "unknown";
  try {
    const horizon = await fetch(`${getNetworkConfig().horizonUrl}/`, {
      signal: AbortSignal.timeout(5000),
    });
    networkStatus = horizon.ok ? "ok" : `http_${horizon.status}`;
  } catch {
    networkStatus = "unreachable";
  }

  return NextResponse.json({
    status: db === "ok" ? "ok" : "degraded",
    db,
    stellarNetwork: network,
    stellarHorizon: networkStatus,
    notaryConfigured: !!process.env.NOTARY_CONTRACT_ID,
    storageDriver: process.env.STORAGE_DRIVER ?? "local",
    time: new Date().toISOString(),
  });
}
