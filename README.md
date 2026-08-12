# Serller

**Serller is a Web3 social application built around Stellar.**

A social network where your wallet is your identity: post text, images and links; follow, like
and comment; and reward creators directly with **real XLM tips** that settle on the Stellar
network in seconds. Content can be **notarized on-chain** (Soroban) to prove authorship.

> ⚠️ **Testnet first.** All blockchain features currently run on the Stellar **Testnet**
> (Rule 5). Mainnet is gated behind configuration and a completed security review.

---

## Features

- **Wallet identity** — connect with the [Freighter](https://www.freighter.app) Stellar wallet;
  authenticate by signing a server-issued challenge (SEP-53). Serller **never sees your private key** (Rule 3).
- **Social core** — posts (text / image / link), likes, comments + replies, follows, feeds
  (Following / For You / Latest / Trending), profiles, search, notifications.
- **XLM tipping** — tip any creator in XLM. The server builds the payment; your wallet signs it;
  you see the confirmation and an explorer link.
- **Content notarization** — opt-in per post: a hash of your post is registered in the
  Soroban `content-notary` contract on Testnet.
- **Decentralized media** — images stored on IPFS (Pinata) with a local dev fallback.
- **Moderation** — report, block, mute.
- **Android** — Capacitor shell for the same web app (`android/`).
- **Blockchain indexer** — `indexer/` tails Stellar for payments/contract events with
  checkpointing and idempotency.

## Tech stack

| Layer | Choice |
|---|---|
| Web + API | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4 (light + dark mode) |
| Database | PostgreSQL (Prisma 6); SQLite for local dev |
| Stellar | `@stellar/stellar-sdk` 13, `@stellar/freighter-api` 6 |
| Contracts | Rust (soroban-sdk), `contracts/content-notary` |
| Storage | IPFS via Pinata (Files API v3) |
| Tests | Vitest (unit/integration), Playwright (e2e), `cargo test` (contract) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

## Prerequisites

- **Node.js ≥ 18.18** (npm)
- **Freighter** browser extension (for wallet features)
- Rust toolchain + `wasm32-unknown-unknown` target (only for the contract, Phase 9)

## Quick start

```bash
git clone git@github.com:Scepter00/serller-room.git
cd serller-room

npm install        # install dependencies
npm run setup      # create .env (SQLite dev DB + generated AUTH_SECRET)
npx prisma generate
npx prisma db push # create the SQLite dev database
npm run db:seed    # optional: seed demo content (clearly marked DEMO)
npm run dev        # http://localhost:3000
```

Open http://localhost:3000, install Freighter, connect your wallet (use the **Testnet** network
in Freighter), then fund yourself from `/wallet` ("Get testnet XLM" via Friendbot).

### Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run e2e` | Playwright end-to-end tests |
| `npm run db:push` / `db:migrate` / `db:deploy` | Database schema |
| `npm run indexer` | Run the blockchain indexer service |
| `npm run contract:test` | Rust contract unit tests |
| `npm run contract:build` | Build the contract WASM |

## Environment

Copy `.env.example` → `.env` (or use `npm run setup`). Key variables:

- `STELLAR_NETWORK=testnet` — `mainnet` requires an explicit opt-in + security review.
- `DATABASE_PROVIDER=sqlite` (dev) / `postgresql` (prod).
- `STORAGE_DRIVER=local` (dev mock) / `pinata` (production, needs `PINATA_JWT`).
- `NOTARY_CONTRACT_ID` — set after Phase 9 contract deployment.

## Repository layout

```
app/            Next.js app: pages + API route handlers
components/     React UI components
lib/            Server/client libraries (db, auth, stellar, storage, validation)
prisma/         Data model + seed
contracts/      Soroban content-notary contract (Rust)
indexer/        Blockchain indexer service (Node)
android/        Capacitor Android shell
docs/           Phase deliverables (research, architecture, security, play-store, …)
scripts/        Dev + ops helpers
tests/          Unit, integration, e2e tests
.github/        CI workflows
```

## Documentation

See `docs/` — the full build spec (`SERLLER MASTER BUILD PROMPT`) is executed phase by phase;
`docs/roadmap.md` tracks progress. Key documents:

- `docs/research/ecosystem.md` — verified Stellar ecosystem research (2026)
- `docs/architecture/*` — system, database, API, auth, storage, blockchain, contracts
- `docs/product/*` — personas, user flows
- `docs/security/security-review.md` — security review
- `docs/play-store/*` — Google Play preparation

## Security

- **Serller never touches private keys.** Wallets sign. (Rule 3)
- See `SECURITY.md` and `docs/security/security-review.md`.

## License

MIT — see [LICENSE](LICENSE).
