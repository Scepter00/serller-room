"use client";

/**
 * Freighter wallet wrapper. Serller never touches private keys (Rule 3):
 * the wallet does all signing; we only read public keys and signatures.
 */
import {
  getAddress,
  isConnected,
  requestAccess,
  signMessage,
  signTransaction,
} from "@stellar/freighter-api";

export class WalletError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const result = await isConnected();
    return result.isConnected;
  } catch {
    return false;
  }
}

/** Prompt the user to connect and return their public key. */
export async function connectWallet(): Promise<string> {
  if (!(await isFreighterInstalled())) {
    throw new WalletError(
      "FREIGHTER_NOT_INSTALLED",
      "Freighter is not installed. Install the Freighter browser extension to continue."
    );
  }
  const access = await requestAccess();
  if (access.error) {
    throw new WalletError("ACCESS_DENIED", access.error.message ?? "Access denied");
  }
  return access.address;
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const result = await getAddress();
    if (result.error) return null;
    return result.address;
  } catch {
    return null;
  }
}

/**
 * Sign an arbitrary message (SEP-53 / personal sign) with the connected wallet.
 * Returns the signature as a base64 string (Buffer and string outputs normalized).
 */
export async function signMessageForAuth(
  message: string,
  address: string
): Promise<string> {
  const result = await signMessage(message, { address });
  if (result.error) {
    throw new WalletError(
      "SIGN_MESSAGE_FAILED",
      result.error.message ?? "Wallet declined to sign"
    );
  }
  if (result.signedMessage == null) {
    throw new WalletError("SIGN_MESSAGE_FAILED", "Wallet returned no signature");
  }
  if (typeof result.signedMessage === "string") {
    return result.signedMessage;
  }
  // Buffer (Freighter API v3) → base64 for transport.
  return Buffer.from(result.signedMessage).toString("base64");
}

/** Sign a transaction XDR with the connected wallet. */
export async function signTransactionWithWallet(
  xdr: string,
  networkPassphrase: string,
  address: string
): Promise<string> {
  const result = await signTransaction(xdr, { networkPassphrase, address });
  if (result.error) {
    throw new WalletError(
      "SIGN_TX_FAILED",
      result.error.message ?? "Wallet declined to sign the transaction"
    );
  }
  return result.signedTxXdr;
}

/** What does the connected wallet think the network is? (for the network badge) */
export async function getWalletNetworkInfo(): Promise<{
  network: string | null;
  networkPassphrase: string | null;
}> {
  try {
    const { default: mod } = await import("@stellar/freighter-api");
    const getNetwork = (mod as unknown as { getNetwork?: () => Promise<{ network?: string; networkPassphrase?: string; error?: { message?: string } }> }).getNetwork;
    if (!getNetwork) return { network: null, networkPassphrase: null };
    const info = await getNetwork();
    if (info.error) return { network: null, networkPassphrase: null };
    return {
      network: info.network ?? null,
      networkPassphrase: info.networkPassphrase ?? null,
    };
  } catch {
    return { network: null, networkPassphrase: null };
  }
}
