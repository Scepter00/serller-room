# Serller Contracts

One Soroban contract for MVP: **`content-notary`** — on-chain proof of authorship.

See `docs/architecture/contracts.md` for the full design (purpose, storage, functions,
events, authorization, errors, upgrade strategy).

## Why only one contract?

- Tipping is a native Stellar primitive (XLM payments) — no contract needed (Rule 4).
- Content notarization is the one thing a contract adds that a database cannot:
  **publicly verifiable authorship** independent of Serller's infrastructure.
- No social-graph or marketplace contracts in MVP (unjustified complexity/cost).

## Development

```bash
# Build (WASM) — requires rustup toolchain + wasm32v1-none target (Rust ≥ 1.84)
rustup target add wasm32v1-none
npm run contract:build

# Unit tests (authorization, storage, events, edge cases)
npm run contract:test
```

## Deploy to Testnet

```bash
node contracts/scripts/deploy-testnet.mjs
```

The script:
1. Uses `TESTNET_SECRET` from `.env` (a testnet-only deployer keypair; generate with
   `node -e "console.log(require('@stellar/stellar-sdk').Keypair.random().secret())"`).
   If unset, generates + funds a fresh one via Friendbot.
2. Uploads the WASM (`Operation.uploadContractWasm`).
3. Creates the contract (`Operation.createCustomContract`).
4. Calls `init(authority)`.
5. Prints `NOTARY_CONTRACT_ID` — paste it into `.env`.

⚠️ Testnet resets (2–4×/year) wipe contracts; redeploy after a reset and update `.env`.

## SDK version note

The contract pins `soroban-sdk = "21.0.0"` (buildable with the locally available Rust
toolchain). The API surface used here (`require_auth`, events, persistent storage,
`extend_ttl`) is identical in later SDK versions; CI builds with the latest stable toolchain.
Bump to the current protocol-matched SDK (26/27) when the toolchain is upgraded.
