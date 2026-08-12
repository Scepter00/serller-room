import { NextResponse } from "next/server";
import { getRecord } from "@/lib/contract";

/** Public on-chain verification: read the notary record for a content hash. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const contentHash = (url.searchParams.get("hash") ?? "").trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "hash must be 64 hex chars" } },
      { status: 400 }
    );
  }

  const record = await getRecord(contentHash);
  return NextResponse.json({ contentHash, record });
}
