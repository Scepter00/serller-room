# Serller Indexer

Tails the Stellar network (Horizon payments) and writes `blockchain_events` rows to the
database. This powers on-chain verification, tip attribution, and auditability.

## Features (Phase 11)

- **Checkpointing** — the last processed cursor is stored in `indexer_checkpoints` (single row, id=1).
- **Idempotency** — unique `(txHash, opIndex)` constraint makes reprocessing safe.
- **Retry with backoff** — transient errors back off exponentially (1s → 2s → … → 60s cap).
- **Recovery** — restart resumes from the checkpoint; no duplicate events.

## Run

```bash
npm run indexer
```

Environment:

| Var | Default | Purpose |
|---|---|---|
| `STELLAR_HORIZON_URL` | testnet horizon | Which network to tail |
| `INDEXER_POLL_MS` | 5000 | Poll interval |
| `INDEXER_WATCH_ADDRESSES` | (all) | Comma-separated addresses to filter on |

## Architecture

```
Stellar (Horizon payments stream)
   ↓ cursor tailing
indexer/index.mjs
   ↓ upsert by (txHash, opIndex)
blockchain_events (PostgreSQL)
   ↓
API / UI (explorer links, tip history, verification)
```

## Notes

- Testnet resets (2–4×/year) wipe history: clear `blockchain_events` + `indexer_checkpoints`
  and re-run after a reset (documented in `docs/architecture/blockchain.md`).
- Horizon cursors are per-stream and stable across restarts.
- Soroban contract events can be added by extending `pollOnce` with `server.getTransactions` /
  RPC `getEvents`; the `blockchain_events.type = CONTRACT_EVENT` enum is already reserved.
