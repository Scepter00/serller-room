# Serller — Blockchain Architecture

> Status: Complete (Phase 2)

## 1. What is on-chain, and why (Rule 4 decision table)

| Feature | On-chain? | Rationale |
|---|---|---|
| XLM tips | **Yes** — native Stellar payments | Payments are the network's purpose; instant, ~free, verifiable |
| Content ownership / integrity (notarization) | **Yes** — Soroban notary contract | Verifiable authorship anchor; cheap; opt-in per post |
| Profile, posts, comments, likes, follows | **No** — PostgreSQL | High-frequency social churn; on-chain would be slow & costly (Rule 4) |
| Media blobs | **No** — IPFS (CID in DB) | Cost; content-addressing is sufficient |
| Username registry | **No** (MVP) | Off-chain unique constraint; revisit if portability demand grows |

## 2. Networks

- **Dev/Test:** Stellar **Testnet** — Horizon `https://horizon-testnet.stellar.org`,
  RPC `https://soroban-testnet.stellar.org`, Friendbot `https://friendbot.stellar.org`.
- **Mainnet:** locked behind env flag `STELLAR_NETWORK=mainnet`; disabled until security review
  (Rule 5). Client UI shows a TESTNET badge whenever on Testnet.

## 3. Tip flow (on-chain path)

```
Server: resolves recipient address from username  (never trusts client)
Server: builds payment (XLM, memo "SERLLER-TIP:<postId>")  → unsigned XDR
Client: wallet signs XDR (Freighter)
Client: POST signed XDR → server re-verifies dest/amount/asset vs buildId
Server: submit to Horizon → tx hash
DB: transactions row; indexer confirms; notifications fired
```

## 4. Notary contract (on-chain path, Phase 9)

```
Post author (wallet) → POST /api/posts (notarize: true)
Server: computes contentHash = sha256(canonical(metadata+CID+author))
Client: wallet signs contract invoke (notary.register)
Server: submits via RPC → contract event "Registered"
DB: post.notarized=true, notaryTxHash set
Anyone: notary.getRecord(contentHash) → { author, timestamp } (verifiable)
```

## 5. Indexer (on-chain → DB path, Phase 11)

```
Stellar (Horizon payments stream + RPC events)
        ↓  cursor-based tailing, checkpointed in DB
   Indexer service
        ↓  upsert with unique (txHash, opIndex)
   blockchain_events + transactions update
        ↓
   API/UI (tip history, notifications)
```

- Checkpoint: single row `indexer_checkpoints` (cursor). On restart, resume from it.
- Idempotency: unique constraint on `(txHash, opIndex)`; failures logged & retried with backoff.
- Testnet resets (2–4×/yr) require clearing events + re-sync; documented in ops docs.

## 6. Cost & UX notes

- Native XLM payments: ~0.00001 XLM fee — tipping costs cents.
- Notarization: one Soroban invocation + state rent (TTL extension managed by the contract
  `extend_ttl` calls on write).
- Users on Testnet can fund their wallet via Friendbot directly from `/wallet` (no secrets involved).
