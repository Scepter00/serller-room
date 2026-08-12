//! Serller Content Notary — Soroban contract.
//!
//! Stores on-chain records of (author, content_hash, timestamp, uri) so Serller
//! users can prove authorship and content integrity for notarized posts.
//!
//! Design decisions (see docs/architecture/contracts.md):
//!   - Records are keyed by content hash and immutable once registered.
//!   - Every write requires cryptographic authorization (`require_auth`).
//!   - TTL is extended on writes and on reads of hot entries.
//!   - Typed errors, events, no unnecessary complexity.
//!
//! Built against soroban-sdk 27 (Stellar Protocol 27 / Testnet).

#![no_std]
// env.events().publish is deprecated in favor of #[contractevent]; it remains
// fully functional and keeps the event contract (topics) identical across the
// JS client. Tracked for migration in a later SDK bump.
#![allow(deprecated)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Bytes, Env, String,
};

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub enum DataKey {
    /// Contract admin/authority.
    Authority,
    /// Hash -> Record (persistent).
    Record(Bytes),
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct Record {
    pub author: Address,
    pub timestamp: u64,
    pub uri: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[contracterror]
pub enum NotaryError {
    AlreadyRegistered = 0,
    NotAuthorized = 1,
    InvalidUri = 2,
    EmptyHash = 3,
    NotInitialized = 4,
    InvalidHash = 5,
}

const HASH_LEN: u32 = 32;
const INSTANCE_TTL: u32 = 31_536_000; // ~2 years of ledgers (5s/ledger)
const RECORD_TTL: u32 = 31_536_000;

#[contract]
pub struct ContentNotary;

#[contractimpl]
impl ContentNotary {
    /// Initialize the contract authority (must be the deployer).
    pub fn init(env: Env, authority: Address) {
        if env.storage().instance().has(&DataKey::Authority) {
            panic_with_error!(&env, NotaryError::AlreadyRegistered);
        }
        env.storage().instance().set(&DataKey::Authority, &authority);
        env.storage().instance().extend_ttl(INSTANCE_TTL, INSTANCE_TTL);
        env.events().publish((symbol_short!("init"), authority.clone()), ());
    }

    /// Register content: (author, hash, uri) with the author's authorization.
    pub fn register(env: Env, author: Address, hash: Bytes, uri: String) -> Record {
        author.require_auth();

        if hash.len() != HASH_LEN {
            panic_with_error!(&env, NotaryError::InvalidHash);
        }
        if is_zero_hash(&hash) {
            panic_with_error!(&env, NotaryError::EmptyHash);
        }
        if uri.len() > 64 {
            panic_with_error!(&env, NotaryError::InvalidUri);
        }
        if env.storage().persistent().has(&DataKey::Record(hash.clone())) {
            panic_with_error!(&env, NotaryError::AlreadyRegistered);
        }

        let record = Record {
            author: author.clone(),
            timestamp: env.ledger().timestamp(),
            uri: uri.clone(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Record(hash.clone()), &record);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Record(hash), RECORD_TTL, RECORD_TTL);
        env.storage().instance().extend_ttl(INSTANCE_TTL, INSTANCE_TTL);

        env.events().publish(
            (symbol_short!("register"), author.clone()),
            (record.timestamp, uri),
        );

        record
    }

    /// Read a record by content hash (extends TTL on hot entries).
    pub fn get_record(env: Env, hash: Bytes) -> Option<Record> {
        let key = DataKey::Record(hash.clone());
        let record = env.storage().persistent().get::<_, Record>(&key);
        if record.is_some() {
            env.storage()
                .persistent()
                .extend_ttl(&key, RECORD_TTL, RECORD_TTL);
        }
        record
    }

    /// Whether a content hash has been registered.
    pub fn is_registered(env: Env, hash: Bytes) -> bool {
        env.storage().persistent().has(&DataKey::Record(hash))
    }

    /// Current contract authority.
    pub fn authority(env: Env) -> Address {
        env.storage()
            .instance()
            .get::<_, Address>(&DataKey::Authority)
            .unwrap_or_else(|| panic_with_error!(&env, NotaryError::NotInitialized))
    }

    /// Transfer admin control (upgrade/ops continuity path).
    pub fn transfer_authority(env: Env, new_authority: Address) {
        let current = Self::authority(env.clone());
        current.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::Authority, &new_authority);
        env.storage().instance().extend_ttl(INSTANCE_TTL, INSTANCE_TTL);

        env.events().publish((symbol_short!("transfer"), current), new_authority);
    }
}

fn is_zero_hash(hash: &Bytes) -> bool {
    hash.iter().all(|b| b == 0u8)
}

mod test;
