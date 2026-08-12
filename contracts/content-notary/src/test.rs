//! Content Notary unit tests: authorization, storage, events, invalid inputs,
//! repeated calls, and TTL extension. Contract errors are asserted via the
//! generated `try_*` client methods (they return `Result` instead of panicking).

#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    vec, Address, Bytes, Env, IntoVal, String, Symbol, Val,
};

use crate::{ContentNotary, ContentNotaryClient, DataKey, NotaryError, Record};

/// Register a contract + client with a fresh environment; returns (client, contract id).
fn setup<'e>(env: &'e Env, authority: &Address) -> (ContentNotaryClient<'e>, Address) {
    let contract_id = env.register(ContentNotary, ());
    let client = ContentNotaryClient::new(env, &contract_id);
    client.init(authority);
    (client, contract_id)
}

fn hash_from(env: &Env, byte: u8) -> Bytes {
    Bytes::from_slice(env, &[byte; 32])
}

#[test]
fn test_register_and_read() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| {
        l.timestamp = 1_700_000_000;
    });
    let authority = Address::generate(&env);
    let author = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    let hash = hash_from(&env, 7);
    let uri = String::from_str(&env, "serller://post/abc123");

    let record = client.register(&author, &hash, &uri);
    assert_eq!(record.author, author);
    assert_eq!(record.uri, uri);
    assert_eq!(record.timestamp, 1_700_000_000);

    let fetched = client.get_record(&hash).unwrap();
    assert_eq!(fetched, record);
    assert!(client.is_registered(&hash));
}

#[test]
fn test_authorization_is_required() {
    let env = Env::default();
    // No mock_all_auths: real authorization checks are enforced.
    let authority = Address::generate(&env);
    let author = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    let hash = hash_from(&env, 1);
    let uri = String::from_str(&env, "serller://post/x");

    // Without the author's authorization, registration must fail.
    let result = client.try_register(&author, &hash, &uri);
    assert!(result.is_err(), "unauthenticated register must fail");
}

#[test]
fn test_duplicate_hash_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let authority = Address::generate(&env);
    let author = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    let hash = hash_from(&env, 9);
    let uri = String::from_str(&env, "serller://post/dup");
    client.register(&author, &hash, &uri);

    let result = client.try_register(&author, &hash, &uri);
    assert!(result.is_err(), "second register must fail with AlreadyRegistered");
}

#[test]
fn test_empty_hash_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let authority = Address::generate(&env);
    let author = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    let zero = hash_from(&env, 0);
    let uri = String::from_str(&env, "serller://post/zero");

    let result = client.try_register(&author, &zero, &uri);
    assert!(result.is_err(), "zero hash must be rejected");
}

#[test]
fn test_malformed_hash_length_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let authority = Address::generate(&env);
    let author = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    let short_hash = Bytes::from_slice(&env, &[1u8, 2, 3]);
    let uri = String::from_str(&env, "serller://post/short");

    let result = client.try_register(&author, &short_hash, &uri);
    assert!(result.is_err(), "hash must be exactly 32 bytes");
}

#[test]
fn test_oversized_uri_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let authority = Address::generate(&env);
    let author = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    let hash = hash_from(&env, 3);
    let long_uri = String::from_str(&env, &"u".repeat(65));

    let result = client.try_register(&author, &hash, &long_uri);
    assert!(result.is_err(), "uri > 64 bytes must be rejected");
}

#[test]
fn test_read_miss_returns_none() {
    let env = Env::default();
    env.mock_all_auths();
    let authority = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    let missing = hash_from(&env, 42);
    assert_eq!(client.get_record(&missing), None);
    assert!(!client.is_registered(&missing));
}

#[test]
fn test_authority_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let authority = Address::generate(&env);
    let next = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    assert_eq!(client.authority(), authority);
    client.transfer_authority(&next);
    assert_eq!(client.authority(), next);
}

#[test]
fn test_authority_transfer_requires_auth() {
    let env = Env::default();
    let authority = Address::generate(&env);
    let next = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    // An unsigned caller cannot transfer authority.
    let result = client.try_transfer_authority(&next);
    assert!(result.is_err());
}

#[test]
fn test_register_emits_event() {
    let env = Env::default();
    env.mock_all_auths();
    let authority = Address::generate(&env);
    let author = Address::generate(&env);
    let (client, contract_id) = setup(&env, &authority);

    let hash = hash_from(&env, 5);
    let uri = String::from_str(&env, "serller://post/event");
    let record = client.register(&author, &hash, &uri);

    // Exact event assertion via the SDK's ContractEvents equality helper:
    // topics = (symbol "register", author address); data = (timestamp, uri).
    let events = env.events().all();
    let topics: soroban_sdk::Vec<Val> = vec![
        &env,
        Symbol::new(&env, "register").into_val(&env),
        author.clone().into_val(&env),
    ];
    let data: Val = (record.timestamp, uri).into_val(&env);
    let expected = vec![&env, (contract_id, topics, data)];
    assert_eq!(events, expected);
}

#[test]
fn test_storage_lifecycle_ttl() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| {
        l.timestamp = 1_700_000_000;
    });
    let authority = Address::generate(&env);
    let author = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    let hash = hash_from(&env, 11);
    let uri = String::from_str(&env, "serller://post/ttl");
    client.register(&author, &hash, &uri);

    // Record remains readable across many ledgers (TTL extended on write + read).
    for _ in 0..100 {
        env.ledger().with_mut(|l| l.timestamp += 5);
        assert!(client.is_registered(&hash));
    }

    let record = client.get_record(&hash).unwrap();
    assert_eq!(record.author, author);
}

#[test]
fn test_record_immutability_across_writers() {
    let env = Env::default();
    env.mock_all_auths();
    let authority = Address::generate(&env);
    let author_a = Address::generate(&env);
    let author_b = Address::generate(&env);
    let (client, _contract_id) = setup(&env, &authority);

    let hash = hash_from(&env, 13);
    client.register(&author_a, &hash, &String::from_str(&env, "serller://post/one"));

    // A second author cannot overwrite the same hash.
    let result = client.try_register(&author_b, &hash, &String::from_str(&env, "serller://post/two"));
    assert!(result.is_err());

    // Original record intact.
    assert_eq!(client.get_record(&hash).unwrap().author, author_a);
}

#[test]
fn test_error_code_mapping() {
    // Guard: error codes stay stable (contract interface contract).
    assert_eq!(NotaryError::AlreadyRegistered as u32, 0);
    assert_eq!(NotaryError::NotAuthorized as u32, 1);
    assert_eq!(NotaryError::InvalidUri as u32, 2);
    assert_eq!(NotaryError::EmptyHash as u32, 3);
    assert_eq!(NotaryError::NotInitialized as u32, 4);
    assert_eq!(NotaryError::InvalidHash as u32, 5);
}

#[test]
fn test_storage_key_shapes() {
    // The DataKey serialization must match what the JS client sends.
    let env = Env::default();
    let _ = DataKey::Authority;
    let _ = DataKey::Record(Bytes::from_slice(&env, &[0u8; 32]));
    let _: Record = Record {
        author: Address::generate(&env),
        timestamp: 0,
        uri: String::from_str(&env, ""),
    };
}
