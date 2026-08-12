# Serller — Stellar Ecosystem Research

> Status: Research complete — August 2026
> Purpose: Record verified, current facts about the Stellar ecosystem, wallets, SDKs,
> decentralized social networks, storage, and Google Play requirements that inform Serller's design.
> Rule 1 (research before implementation) is satisfied by this document. Every technical decision
> in the later phases references a section of this file.

---

## 1. The Stellar Network (2026)

| Topic | Finding |
|---|---|
| Consensus | Stellar Consensus Protocol; fast (3–5 s) settlement, low fees (~0.00001 XLM base). |
| Protocol 26 | Deployed to **Mainnet May 6, 2026** (release: *Yardstick*). |
| Protocol 27 | Active on **Testnet** as of June 2026 (release: *Zipper*). |
| Key upgrades | CAP-80 (efficient ZK / BN254), CAP-77 (freeze ledger entries), CAP-73 (Stellar Asset Contracts can create G-account balances), CAP-78/79 (limited TTL extensions, strkey conversions). |
| XLM | Native asset; required for base reserves, transaction fees, and Soroban state rent. |

**Implication for Serller:** the network is stable, cheap, and fast. Native XLM payments
(tipping) are the natural on-chain primitive — no custom token required.

### Environments

| Environment | Purpose | Horizon | Stellar RPC (soroban-rpc) | Friendbot |
|---|---|---|---|---|
| **Testnet** | Stable dev/test | `https://horizon-testnet.stellar.org` | `https://soroban-testnet.stellar.org` | `https://friendbot.stellar.org` |
| **Futurenet** | Bleeding edge | — | `https://rpc-futurenet.stellar.org` | `https://friendbot-futurenet.stellar.org` |
| **Mainnet** | Production | `https://horizon.stellar.org` | `https://soroban-rpc.stellar.org` | n/a |

Notes:
- Testnet resets 2–4×/year (next scheduled: **December 16, 2026**) — document any testnet state accordingly.
- Friendbot funds a target address with 10,000 test XLM directly — **no secret key required** to fund a user's testnet wallet.
- Stellar RPC keeps a bounded (~7 day) history window. It is not a heavy historical indexer; Serller's indexer must checkpoint continuously.

## 2. Smart Contracts: Soroban

- Soroban is Stellar's native smart contract layer: WebAssembly, written in **Rust**.
- **soroban-sdk** Rust crate: current stable targets Protocol 26 (`26.x`); the `27.x` line targets Protocol 27 testnet.
- **Stellar CLI** (formerly Soroban CLI): `stellar` — `contract init | build | test | deploy`, `keys generate/fund`, `contract extend` for TTL.
- Contract install:
  ```bash
  cargo install --locked stellar-cli
  ```
  or `brew install stellar-cli`.
- TTL: contract data entries and WASM have a Time-To-Live measured in ledgers; they must be periodically extended (`env.storage().instance().extend_ttl(...)` in-contract, or `stellar contract extend` from the CLI) or they are archived.
- Authorization: `Address::require_auth()` enforces cryptographic caller authorization.
- Events: `env.events().publish((symbol_short!("name"), topics), payload)`.
- Unit tests: `Env::default()` + `env.register(Contract, ())` + generated client in `#[cfg(test)]`.

## 3. Wallets & Integration (2026)

- **Freighter** — SDF-maintained browser extension; official package **`@stellar/freighter-api`**.
  - `isConnected()`, `requestAccess()`, `getPublicKey()`, `signTransaction(xdr, {network, address})`, `signMessage(message, {address})`.
  - `signMessage` implements **SEP-53 message signing** (returns a signed-message envelope). The backend verifies with the Stellar SDK's message-verification API.
- **Stellar Wallets Kit** — `@creit-tech/stellar-wallets-kit`: unified modal + adapters for Freighter, Albedo, Lobstr, xBull, WalletConnect, Hana. Recommended when multi-wallet UX is required.
- **Albedo** — browser signer, `@albedo-link/intent`, popup-based; no extension needed.
- **Lobstr / xBull / WalletConnect** — additional options via Wallets Kit.

**Serller decision:** primary integration is **Freighter** (`@stellar/freighter-api`) behind a small
`lib/wallet.ts` abstraction so Stellar Wallets Kit / Albedo can be added later without touching UI code.
This keeps the auth path (SEP-53) uniform.

## 4. SDKs (verified versions)

| SDK | Version (2026) | Used for |
|---|---|---|
| `@stellar/stellar-sdk` | `15.x` stable (v16 RC tracks Protocol 27) | Horizon, RPC, transactions, keypairs, message verification |
| `@stellar/freighter-api` | latest | Wallet connect / sign |
| `soroban-sdk` (Rust) | `26.x` | Serller contracts |
| `stellar-cli` | `26.x` | Contract build/deploy |

**Backend signature verification:** build a `Keypair` from the public key and verify the
SEP-53 message signature over the exact challenge string the server issued. Never trust a bare
"wallet address" claim — always verify a signature (Phase 5).

## 5. Decentralized Social Landscape

- **Farcaster** — identity on-chain; casts/likes/follows on decentralized Hubs; Frames for interactive apps.
- **Lens** — social graph as contracts/NFTs on Lens Chain; portable frontends.
- **Nostr** — relay-based, keypair-signed notes; no chain.
- **Bluesky / AT Protocol** — federated PDS + algorithmic choice.
- **Stellar-native social** is sparse: mostly *social-fi* (e.g. Socio — trading companion on X), savings/gamification (VisionMe). **No dominant Stellar-native social network exists** — Serller's market niche is open.

**Architecture pattern observed across all major protocols:**
- Identity & profiles: off-chain / lightweight on-chain anchor.
- Payments & monetization: strictly on-chain.
- Content, media, social graph: decentralized storage + databases/relays; only content *references* and integrity anchors go on-chain.

## 6. Decentralized Storage (2026)

| Option | Notes | Free tier |
|---|---|---|
| **Pinata (IPFS)** | Files API v3: `POST https://uploads.pinata.cloud/v3/files`; signed upload URLs so the browser uploads without exposing the JWT; dedicated gateway `*.mypinata.cloud`. | 500 files / 1 GB / 10 GB-mo bandwidth |
| Filebase (IPFS) | S3-compatible `https://s3.filebase.io` | 5 GB |
| IPFS Ninja | REST `https://api.ipfs.ninja`, upload tokens | 500 files / 1 GB |
| Arweave (Turbo) | Permanent storage; free under 100 KiB | partial |
| Storj | S3-compatible decentralized object storage | phased out free tier |

Retrieval: public gateways `https://ipfs.io/ipfs/<CID>` / `https://dweb.link/ipfs/<CID>` or a dedicated Pinata gateway.

**Serller decision:** **Pinata Files API v3** with signed upload URLs from the server
(JWT never leaves the server), a dedicated gateway, and a clearly-marked local dev fallback
(Phase 8).

## 7. Google Play — Crypto App Requirements (2026)

- **Non-custodial wallets are exempt** from centralized-license requirements — Serller never touches private keys (Rule 3), so it qualifies as non-custodial.
- **Financial features declaration** required on App Content page (tokenized assets / transactions enabled).
- **Private keys must never leave the device** — consistent with Serller's design.
- **No on-device mining** (not applicable).
- **Testing mandate:** new developer accounts must run a **closed test with ≥ 12 opted-in testers for ≥ 14 consecutive days** before production access can be requested.
- **Organization account** required for crypto-adjacent financial products (company + D-U-N-S) — a personal account may not be sufficient; verify at submission time.
- **Data Safety form:** declare transaction data, user IDs; encryption in transit + at rest; deletion requests.
- **Content rating:** UGC social app → complete the questionnaire; unmoderated chat raises age rating — Serller ships moderation (Phase 12).

## 8. Key Sources

- Stellar docs: https://developers.stellar.org
- Freighter: https://www.freighter.app / https://github.com/stellar/freighter
- Stellar Wallets Kit: https://github.com/Creit-Tech/Stellar-Wallets-Kit
- Pinata docs: https://docs.pinata.cloud
- Google Play blockchain policy: https://support.google.com/googleplay/android-developer/answer/13607354
- Google Play crypto exchange & wallet policy: https://support.google.com/googleplay/android-developer/answer/16329703
- Stellar Community Fund: https://communityfund.stellar.org

## 9. Open Questions / Follow-ups

- Exact latest `@stellar/stellar-sdk` API for SEP-53 verification must be confirmed against the installed package's TypeScript definitions (done during Phase 5 implementation).
- Pinata signed-URL flow requires a Pinata account + JWT (Phase 8 manual setup).
- Contract deployment to Testnet requires the `stellar` CLI or JS RPC deployment and a funded testnet account (Phase 9).
