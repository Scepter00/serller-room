# Serller — System Architecture

> Status: Complete (Phase 2)

## 1. Overview

Serller is a single Next.js application (App Router) that serves both the web frontend and the
REST API, backed by PostgreSQL (SQLite for local dev), plus two satellite services:
a **blockchain indexer** (Node) and the **Soroban content-notary contract** (Rust).

```
                 ┌────────────────────────────┐
                 │         USERS              │
                 │   browser / Android shell  │
                 └──────────────┬─────────────┘
                                │ HTTPS
                 ┌──────────────▼─────────────┐
                 │   Next.js (web + API)      │   <- single deployable unit
                 │  app/ (routes, components) │
                 └──────┬────────────┬────────┘
                        │            │
          ┌─────────────▼──┐    ┌────▼────────────────────┐
          │  PostgreSQL    │    │  Media: IPFS (Pinata)   │
          │  (Prisma ORM)  │    │  + dev local fallback   │
          └─────────────┬──┘    └─────────────────────────┘
                        │            ┌─────────────────────────┐
                        │            │  Indexer (Node, tails    │
                        │            │  Horizon + Stellar RPC)  │
                        │            └────────────┬────────────┘
                        └──────────────┬───────────┘
                                       ▼
                            ┌────────────────────┐
                            │   Stellar network  │
                            │  Horizon / RPC     │
                            │  (Testnet first)   │
                            └────────────────────┘
```

Wallet path (signing never touches Serller servers):

```
Frontend ──(challenge)──► API ──► Stellar (Horizon/RPC)
   ▲                          │
   │ signMessage (SEP-53)     │
   └── Freighter wallet ◄─────┘  (private key stays in wallet)
```

## 2. Components

| Component | Tech | Responsibility |
|---|---|---|
| Web frontend | Next.js, React, Tailwind, TS | UI: feed, profile, wallet, etc. |
| API | Next.js route handlers | Auth, social graph, tipping orchestration |
| Database | PostgreSQL (dev: SQLite) via Prisma | All off-chain state |
| Media storage | IPFS (Pinata) + dev fallback | Images, content-addressed |
| Indexer | Node + `@stellar/stellar-sdk` | Tail payments/events → DB, checkpointed |
| Contracts | Rust (soroban-sdk) | Content notary (ownership/integrity anchors) |
| CI | GitHub Actions | lint, typecheck, unit+integration tests, build |
| Mobile | Capacitor wrapping the web app | Android |

## 3. Security boundaries

1. **Client ⇄ API**: HTTPS, JWT httpOnly cookie (SameSite=Lax), CSRF header checks, rate limiting.
2. **API ⇄ DB**: parameterized queries only (Prisma); no raw SQL with user input.
3. **API ⇄ Stellar**: server builds/verifies transactions; *never* holds user secret keys.
4. **Wallet ⇄ Stellar**: signing happens only inside the wallet; Serller only ever sees public keys + signatures.
5. **API ⇄ Pinata**: JWT stays server-side; clients get short-lived signed upload URLs.
6. **Contract ⇄ users**: `require_auth` on every state-changing call; typed errors; events.

## 4. Key decisions

- **Single Next.js unit** (not separate FE/BE services) for MVP velocity, with route-handler API.
- **Prisma env-driven provider** (`DATABASE_PROVIDER`): `sqlite` locally, `postgresql` in prod.
- **JWT sessions in httpOnly cookies** (not localStorage) — XSS-resistant.
- **Server-built tip transactions** — the client never constructs the payment; it only signs.
- **Indexer writes with unique constraints** — idempotent by `(txHash, opIndex)`.
- **All blockchain features Testnet-first** (Rule 5).
