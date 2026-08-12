# Serller — Product Review

> Status: Complete (Phase 1)

This document answers the ten product questions from the build specification. It defines *what*
Serller is before any architecture is chosen.

## 1. What exactly is Serller?

**Serller is a Web3 social application built around Stellar.** It is a place where creators post
short-form content (text, images, links), build audiences, and are directly rewarded by their
community with **XLM tips** — payments that are real, on-chain, and verifiable. Serller keeps the
familiar shape of a social network (feed, follow, like, comment, notify) and adds genuine
Stellar primitives where they create value: wallet identity, real tipping, and optional content
notarization.

## 2. Who is it for?

Primary personas (see `docs/product/user-personas.md`):

- **Stellar natives** — wallet users, Soroban builders, Freighter holders looking for a home on Stellar.
- **Creators** — writers, artists, developers who want direct, low-fee monetization without ad platforms.
- **Crypto-curious social users** — people migrating from centralized platforms who want self-custody identity.
- **Testnet explorers** — developers and enthusiasts experimenting risk-free before mainnet.

## 3. What problem does it solve?

- Centralized platforms extract most creator value and can deplatform arbitrarily.
- Existing crypto-social apps (Farcaster/Lens/Nostr) are **not on Stellar** and carry Ethereum/Solana UX baggage (gas, complexity).
- Stellar's core strength — fast, near-free, cross-border payments — is **underused in social**.
- There is **no dominant Stellar-native social network** (research, Phase 1). Serller fills that gap.

## 4. Why does it need Stellar?

- **Tipping** is the killer app: native XLM payments settle in ~4 seconds for fractions of a cent.
- **Identity**: wallet-based accounts are self-custody, portable, and phishing-resistant.
- **Verifiability**: tips and content anchors are publicly auditable on-chain.
- No other L1 combines payment-grade rails + smart contracts + a testnet faucet this cleanly.

## 5. What does Web3 actually provide? (honest answer)

| Claim | Serller reality |
|---|---|
| Own your identity | Yes — account = your Stellar keypair; you can leave and take your identity with you. |
| Own your money | Yes — tips are direct XLM payments; Serller is never a custodian. |
| Censorship resistance | Partial — content lives on Serller infra; **references + ownership are notarized on-chain**. |
| Content integrity | Yes — optional notarization records a hash/CID of your post on Testnet/Mainnet. |
| Decentralized everything | No — most social data (graph, feed) lives in PostgreSQL, like Farcaster Hubs. Blockchain is used where it *provides* value (Rule 4). |

## 6. Which data belongs on-chain?

- **XLM tip payments** (native transfers — the payment rail itself).
- **Content notarization records** (author address, content hash/CID, timestamp) — verifiable ownership/integrity anchors (Soroban contract, Phase 9).
- Nothing else needs to be on-chain for MVP.

## 7. Which data belongs off-chain?

- Users, profiles, posts, comments, likes, follows, notifications, reports, media references, moderation state — all in PostgreSQL.
- Rationale: social graph churn is high-frequency and cheap to store in a DB; storing it on-chain would violate Rule 4 (cost, performance, UX).

## 8. Which data belongs in decentralized storage?

- **Media blobs** (images) → IPFS via Pinata: content-addressed (CID), pinned, served through a gateway.
- The database stores the **CID/reference**, not the blob.
- Rationale: large media on-chain is prohibitively expensive; CIDs give content-addressing, dedup, and portability.

## 9. What makes Serller different?

1. **Stellar-native social** — the first serious attempt at a social network where Stellar payments are first-class, not bolted on.
2. **Real tipping UX** — a friction-minimized flow (server-built transaction, wallet-sign, instant confirmation, explorer link).
3. **No private keys, ever** — self-custody by design; Serller never sees a secret key.
4. **Rule-4 discipline** — most data stays in boring, reliable infrastructure; blockchain is used only where it pays rent.
5. **Testnet-first** — the whole product works on Stellar Testnet before mainnet.

## 10. What is the minimum viable product (MVP)?

1. Wallet connect (Freighter) + signature-based authentication.
2. Profiles (username, display name, bio, avatar, wallet association).
3. Posts: text, image (IPFS), link; like; comment; delete.
4. Follow/unfollow; home feed (following + "for you").
5. Discover (users, posts, hashtags) + search.
6. Notifications (follow, like, comment, reply, mention, tip).
7. **XLM tipping on Testnet** with confirmations + explorer links.
8. Content notarization via a Soroban contract on Testnet (optional per-post toggle).
9. Moderation: report, block, mute.
10. Android app (Capacitor) wrapping the same web app.

## Risks

| Risk | Mitigation |
|---|---|
| Testnet resets wipe contracts/data | Documented; deploy script re-deploys; contract IDs recorded per reset |
| Freighter SEP-53 API drift | Verification wrapped in one function + unit tests against a known keypair |
| No Postgres locally (dev env) | Prisma env-driven provider: SQLite dev, Postgres prod |
| Pinata needs API key | Signed-URL server flow + clearly-marked dev fallback |
| Google Play crypto policy complexity | Non-custodial design (no keys), financial declaration, closed-testing plan (Phase 18) |
| Soroban toolchain (Rust) version mismatch | Contracts pinned to sdk version compatible with available rustc; build docs |
