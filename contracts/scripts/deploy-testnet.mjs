#!/usr/bin/env node
/**
 * Deploy the Serller content-notary contract to Stellar Testnet.
 *
 * Steps:
 *   1. Use TESTNET_SECRET (deployer keypair) if provided; otherwise generate a
 *      fresh keypair and fund it via Friendbot.
 *   2. Upload the WASM (Operation.uploadContractWasm).
 *   3. Create the contract (Operation.createCustomContract with wasm sha256).
 *   4. Decode the ACTUAL created contract ID from the create transaction's
 *      result meta (authoritative — do not hand-derive).
 *   5. Call init(authority) so the deployer becomes the contract authority.
 *   6. Print NOTARY_CONTRACT_ID and persist it into .env.
 *
 * Idempotent: if NOTARY_CONTRACT_ID is already in .env (or env), the
 * upload/create steps are skipped and only init is (re)attempted. If the
 * authority is already initialized, init is skipped too.
 *
 * Prereqs: `npm run contract:build` (WASM present). Run from repo root.
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  hash,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.STELLAR_PASSPHRASE ?? Networks.TESTNET;
const FRIENDBOT = process.env.STELLAR_FRIENDBOT_URL ?? "https://friendbot.stellar.org";

const WASM_PATH = "contracts/content-notary/target/wasm32v1-none/release/serller_content_notary.wasm";

async function fund(address) {
  const res = await fetch(`${FRIENDBOT}?addr=${address}`);
  if (!res.ok) throw new Error(`Friendbot failed: ${res.status}`);
  console.log(`✓ funded ${address} via Friendbot`);
}

async function waitForInclusion(server, txHash) {
  for (let i = 0; i < 30; i++) {
    const status = await server.getTransaction(txHash);
    if (status.status === "SUCCESS") return status;
    if (status.status === "FAILED") throw new Error(`Transaction failed: ${txHash}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${txHash}`);
}

async function signAndSend(server, keypair, tx) {
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(keypair);
  const result = await server.sendTransaction(prepared);
  if (result.status === "ERROR") {
    throw new Error(`RPC rejected: ${result.errorResult?.error ?? "unknown"}`);
  }
  return waitForInclusion(server, result.hash);
}

/**
 * Extract the created contract ID from a create-contract transaction's result
 * meta. The ledger meta is authoritative: it contains the ContractData entry
 * (key = scvLedgerKeyContractInstance) for the freshly created contract.
 */
function readCreatedContractId(txStatus) {
  const meta = txStatus.resultMetaXdr;
  const txMeta = xdr.TransactionMeta.fromXDR(meta, "base64");
  const v = txMeta.v4();
  for (const op of v.operations()) {
    for (const change of op.changes()) {
      if (change.switch().name !== "ledgerEntryCreated") continue;
      const entry = change.created().data();
      if (entry.switch().name !== "contractData") continue;
      const cd = entry.contractData();
      if (cd.key().switch().name !== "scvLedgerKeyContractInstance") continue;
      const addr = cd.contract();
      if (addr.switch().name === "scAddressTypeContract") {
        const cid = addr.contractId();
        // js-xdr may expose Hash as a Buffer or as an XDR opaque; normalize.
        const raw = Buffer.isBuffer(cid) ? cid : Buffer.from(cid.toXDR("raw"));
        return StrKey.encodeContract(raw);
      }
    }
  }
  return undefined;
}

function readEnv() {
  try {
    const raw = readFileSync(".env", "utf8");
    const out = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

function writeEnvKey(key, value) {
  try {
    let raw = readFileSync(".env", "utf8");
    if (new RegExp(`^${key}=`, "m").test(raw)) {
      raw = raw.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
    } else {
      raw = `${raw.trim()}\n${key}=${value}\n`;
    }
    writeFileSync(".env", raw);
    console.log(`✓ persisted ${key} to .env`);
  } catch (e) {
    console.warn(`⚠ could not persist ${key} (${e.message})`);
  }
}

async function isInitialized(server, account, contractId) {
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(contract.call("authority"))
    .setTimeout(0)
    .build();
  try {
    const sim = await server.simulateTransaction(tx);
    // An initialized contract returns a successful simulation (no auth needed
    // for the read-only authority() call).
    return !sim.error;
  } catch {
    return false;
  }
}

async function deploy() {
  const env = readEnv();
  const existingId = (process.env.NOTARY_CONTRACT_ID ?? env.NOTARY_CONTRACT_ID ?? "").trim();

  let keypair;
  if (process.env.TESTNET_SECRET) {
    keypair = Keypair.fromSecret(process.env.TESTNET_SECRET);
  } else {
    console.log("No TESTNET_SECRET set — generating a fresh deployer keypair…");
    keypair = Keypair.random();
  }

  const server = new rpc.Server(RPC_URL);
  let account;
  try {
    account = await server.getAccount(keypair.publicKey());
  } catch {
    console.log("Deployer not funded — funding via Friendbot…");
    await fund(keypair.publicKey());
    account = await server.getAccount(keypair.publicKey());
  }

  let contractId = existingId;

  if (!contractId) {
    // Full deploy path.
    const wasm = readFileSync(WASM_PATH);
    console.log(`WASM: ${WASM_PATH} (${wasm.length} bytes)`);

    console.log("Uploading contract WASM…");
    let tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(Operation.uploadContractWasm({ wasm }))
      .setTimeout(0)
      .build();
    await signAndSend(server, keypair, tx);
    console.log("✓ WASM uploaded");

    console.log("Creating contract…");
    const wasmHash = hash(wasm); // sha256 of the wasm
    tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(
        Operation.createCustomContract({
          address: new Address(keypair.publicKey()),
          wasmHash,
          salt: Buffer.alloc(32),
        })
      )
      .setTimeout(0)
      .build();
    const createStatus = await signAndSend(server, keypair, tx);
    console.log("✓ Contract created");

    // Decode the ACTUAL contract ID from the ledger meta (authoritative).
    contractId = readCreatedContractId(createStatus);
    if (!contractId) {
      throw new Error("Could not extract the created contract ID from tx meta");
    }
    console.log(`✓ Contract ID: ${contractId}`);
    writeEnvKey("NOTARY_CONTRACT_ID", contractId);
  } else {
    console.log(`Reusing existing contract ID: ${contractId}`);
  }

  // Init step (idempotent).
  const already = await isInitialized(server, account, contractId);
  if (already) {
    console.log("✓ Authority already initialized — skipping init");
  } else {
    console.log("Initializing authority…");
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call("init", new Address(keypair.publicKey()).toScVal()))
      .setTimeout(0)
      .build();
    await signAndSend(server, keypair, tx);
    console.log("✓ Authority initialized");
  }

  console.log(`\n✅ Deployment complete.\n   NOTARY_CONTRACT_ID=${contractId}\n   Network=${PASSPHRASE}`);
}

deploy().catch((e) => {
  console.error("✖ Deploy failed:", e.message);
  process.exit(1);
});
