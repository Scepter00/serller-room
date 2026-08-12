# Serller — Smart Contract Design

> Status: Complete (Phase 2) — implementation in Phase 9

## 1. Which contracts, and why

Serller deploys **one** contract for MVP: **`content_notary`**.

Justification (Rule 4): tipping is already a native on-chain primitive (no contract needed).
The one thing a contract adds that a database cannot is **publicly verifiable authorship** —
anyone can independently check that a given content hash was registered by a given wallet at a
given ledger time, without trusting Serller's database. This is a deliberate, minimal, valuable use
of Soroban. No social-graph or marketplace contracts in MVP (unjustified complexity/cost).

## 2. Purpose

Store on-chain records of `(author: Address, content_hash: Bytes<32>, timestamp: u64, uri: Symbol/String)`
so Serller users can prove authorship and content integrity for notarized posts.

## 3. Storage

- Instance storage: `DataKey::Record(hash) → Record` where
  `Record { author: Address, timestamp: u64, uri: String }` — keyed by content hash (immutable once set).
- TTL: `extend_ttl` on every write and on reads of hot entries (`env.storage().instance().extend_ttl`),
  plus instance-level extension in `__constructor`-adjacent init. (Research: CAP-78/79; soroban-sdk `extend_ttl`.)

## 4. Functions

| Function | Auth | Description |
|---|---|---|
| `init(authority: Address)` | deployer (constructor) | Sets contract authority (may be Serller ops account) |
| `register(author: Address, hash: Bytes<32>, uri: String)` | `author.require_auth()` | Records hash→(author, timestamp=ledger timestamp, uri). Errors if hash already registered. Emits event. |
| `get_record(hash: Bytes<32>)` | none (read) | Returns `Option<Record>`; extends TTL on hit |
| `is_registered(hash: Bytes<32>)` | none (read) | Bool helper |
| `authority()` | none | Returns current authority |
| `transfer_authority(new_authority: Address)` | `authority.require_auth()` | Ownership of contract admin (upgrade path) |

## 5. Events

```rust
env.events().publish(
    (symbol_short!("register"), author),
    (hash, timestamp, uri)
);
```

## 6. Authorization

- `register`: the **author address must `require_auth()`** — cryptographic proof the caller owns the
  author keypair. The server can only include `author` in the call; the wallet must authorize it.
- `transfer_authority`: only current authority.
- No other privileged state changes. No secret keys anywhere.

## 7. Errors (typed, contract-defined)

| Code | Meaning |
|---|---|
| `AlreadyRegistered` | hash already on-chain (records immutable) |
| `NotAuthorized` | caller not authorized |
| `InvalidUri` | uri too long (> 64 bytes) |
| `EmptyHash` | zero hash rejected |

## 8. Upgrade strategy

- v0.1: no upgradable proxy — contract is immutable once deployed (simplest + safest).
- Authority can be transferred for ops continuity.
- Future versions deploy a new contract ID and migrate new posts; old records remain readable.

## 9. Dependencies

- `soroban-sdk` Rust crate (protocol-matched version).
- Testnet RPC `https://soroban-testnet.stellar.org` for deployment.
- Friendbot for funding the deployer account.

## 10. Tests (Phase 9/14)

- Unit (Rust): register happy path; duplicate hash; wrong-author auth failure; read-misses;
  authority transfer; URI bounds; event shape; TTL extension calls.
- Integration (JS, Testnet): deploy → register (signed by a test wallet) → verify via RPC read.
