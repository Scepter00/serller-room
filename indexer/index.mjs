#!/usr/bin/env node
/**
 * Serller Blockchain Indexer (Phase 11).
 *
 * Tails the Stellar network for activity Serller cares about and writes it to
 * PostgreSQL via the Prisma client. Features:
 *   - Checkpointing: cursor stored in `indexer_checkpoints` (single row).
 *   - Idempotency: unique constraint on (txHash, opIndex) prevents duplicates.
 *   - Retry with backoff on transient errors.
 *   - Recovery: resumes from the last checkpoint after restart.
 *
 * Data model: indexer/README.md
 *
 * Run: npm run indexer   (needs .env with DATABASE_* + STELLAR_*)
 */
import "dotenv/config";
import { Horizon } from "@stellar/stellar-sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HORIZON_URL =
  process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const POLL_MS = Number(process.env.INDEXER_POLL_MS ?? 5000);
const MAX_RETRIES = 5;

// Only index payments involving these addresses (Serller tip accounts) — keep it cheap.
const WATCH_ADDRESSES = (process.env.INDEXER_WATCH_ADDRESSES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const server = new Horizon.Server(HORIZON_URL, { allowHttp: false });

function log(...args) {
  console.log(`[indexer ${new Date().toISOString()}]`, ...args);
}

async function getCheckpoint() {
  const row = await prisma.indexerCheckpoint.findUnique({ where: { id: 1 } });
  return row?.cursor ?? null;
}

async function saveCheckpoint(cursor) {
  await prisma.indexerCheckpoint.upsert({
    where: { id: 1 },
    create: { id: 1, cursor },
    update: { cursor },
  });
}

async function insertEvent(txHash, opIndex, type, data) {
  await prisma.blockchainEvent.upsert({
    where: { txHash_opIndex: { txHash, opIndex } },
    create: { txHash, opIndex, type, data: JSON.stringify(data) },
    update: {}, // idempotent — never reprocessed
  });
}

/** Poll Horizon payment stream, honoring the checkpoint cursor. */
async function pollOnce(cursor) {
  const builder = server
    .payments()
    .limit(50)
    .cursor(cursor ?? "now");

  const records = await builder.call();
  if (records.records.length === 0) return cursor;

  let lastCursor = cursor;
  let inserted = 0;

  for (const record of records.records) {
    lastCursor = record.paging_token;

    const isPayment = record.type === "payment";
    if (!isPayment) continue;

    // Filter to watched addresses (if configured).
    if (WATCH_ADDRESSES.length > 0) {
      const involved =
        (record.from ?? "").includes(":") ? record.from.split(":")[1] ?? record.from : record.from;
      const to = record.to ?? "";
      if (!WATCH_ADDRESSES.includes(involved) && !WATCH_ADDRESSES.includes(to)) {
        continue;
      }
    }

    const data = {
      from: record.from,
      to: record.to,
      amount: record.amount,
      assetType: record.asset_type,
      assetCode: record.asset_code ?? null,
      assetIssuer: record.asset_issuer ?? null,
      memo: record.memo ?? null,
      transaction: record.transaction_hash,
      ledger: record.ledger,
    };

    await insertEvent(record.transaction_hash, record.index ?? 0, "PAYMENT", data);
    inserted += 1;
  }

  await saveCheckpoint(lastCursor);
  if (inserted > 0) log(`+${inserted} payments (cursor ${lastCursor})`);
  return lastCursor;
}

async function run() {
  log(
    `starting · horizon=${HORIZON_URL} poll=${POLL_MS}ms watch=${WATCH_ADDRESSES.length ? WATCH_ADDRESSES.join(",") : "ALL"}`
  );
  let cursor = await getCheckpoint();
  if (cursor) log(`resuming from checkpoint ${cursor}`);

  let retries = 0;
  while (true) {
    try {
      cursor = await pollOnce(cursor);
      retries = 0;
      await sleep(POLL_MS);
    } catch (e) {
      retries += 1;
      const backoff = Math.min(60_000, 1000 * 2 ** retries);
      log(`error (retry ${retries}/${MAX_RETRIES} in ${backoff}ms): ${e.message}`);
      if (retries > MAX_RETRIES) {
        // Keep the process alive but slow down; operator can check logs.
        retries = MAX_RETRIES;
      }
      await sleep(backoff);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

run().catch(async (e) => {
  console.error("[indexer] fatal:", e);
  await prisma.$disconnect();
  process.exit(1);
});

process.on("SIGINT", async () => {
  log("shutting down…");
  await prisma.$disconnect();
  process.exit(0);
});
