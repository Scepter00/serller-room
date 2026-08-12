import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { getNetworkConfig } from "@/lib/stellar/network";
import { sleep } from "@/lib/utils";

/** The deployed notary contract id (set after Phase 9 deployment). */
export function contractId(): string | null {
  const id = process.env.NOTARY_CONTRACT_ID?.trim();
  return id || null;
}

export function notaryConfigured(): boolean {
  return !!contractId();
}

export function rpcServer(): rpc.Server {
  return new rpc.Server(getNetworkConfig().rpcUrl);
}

export function scvHash(hex: string): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));
}

export interface NotaryRecord {
  author: string;
  timestamp: string;
  uri: string;
}

/**
 * Build (and simulate) a `register` invocation for the author's wallet to sign.
 * The transaction must be authorized by the author address (require_auth).
 */
export async function buildRegisterInvocation(opts: {
  authorAddress: string;
  contentHash: string;
  uri: string;
}): Promise<{ unsignedXdr: string; networkPassphrase: string }> {
  const id = contractId();
  if (!id) throw new Error("Notary contract not configured");
  const server = rpcServer();
  const network = getNetworkConfig();

  // Throws if the author's account is not funded on the network.
  const account = await server.getAccount(opts.authorAddress);

  const contract = new Contract(id);
  const invocation = contract.call(
    "register",
    new Address(opts.authorAddress).toScVal(),
    scvHash(opts.contentHash),
    xdr.ScVal.scvString(opts.uri)
  );

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
  })
    .addOperation(invocation)
    .setTimeout(0)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return { unsignedXdr: prepared.toXDR(), networkPassphrase: network.passphrase };
}

/** Submit a user-signed contract invocation and await inclusion. */
export async function submitInvocation(signedXdr: string): Promise<{
  txHash: string;
  status: "confirmed" | "failed" | "pending";
}> {
  const server = rpcServer();
  const network = getNetworkConfig();
  const tx = TransactionBuilder.fromXDR(signedXdr, network.passphrase);

  const result = await server.sendTransaction(tx);
  const hash = result.hash;

  if (result.status === "ERROR") {
    const code = result.errorResult?.result().switch()?.name ?? "unknown";
    throw new Error(`Transaction rejected by RPC: ${code}`);
  }

  for (let i = 0; i < 15; i++) {
    const status = await server.getTransaction(hash);
    if (status.status === "SUCCESS") return { txHash: hash, status: "confirmed" };
    if (status.status === "FAILED") return { txHash: hash, status: "failed" };
    await sleep(1000);
  }
  return { txHash: hash, status: "pending" };
}

/**
 * Read a notarization record by content hash (null when absent/unconfigured).
 * Uses the SDK's spec-aware read helper against the deployed contract.
 */
export async function getRecord(contentHash: string): Promise<NotaryRecord | null> {
  const id = contractId();
  if (!id) return null;
  const server = rpcServer();
  const network = getNetworkConfig();
  try {
    const { result } = await server.queryContract<Record<string, unknown> | null>(
      id,
      "get_record",
      { hash: contentHash },
      network.passphrase
    );
    if (!result) return null;
    return {
      author: String(result.author ?? ""),
      timestamp: String(result.timestamp ?? "0"),
      uri: String(result.uri ?? ""),
    };
  } catch {
    return null;
  }
}
