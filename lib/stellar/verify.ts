import { Keypair } from "@stellar/stellar-sdk";

/**
 * Verify that `signature` is a valid signature by `publicKey` over `message`.
 *
 * Supports two real-world encodings of a Freighter `signMessage` result:
 *   - Buffer   (Freighter API v3): raw 64-byte Ed25519 signature.
 *   - string   (Freighter API v4): base64 — either a raw signature or a
 *     SEP-53 envelope. We first try raw verification; if the SDK exposes a
 *     message-verification helper we prefer it.
 *
 * Never throws: any parsing/verification failure returns `false`.
 */
export function verifyWalletSignature(
  publicKey: string,
  message: string,
  signature: string | Uint8Array
): boolean {
  try {
    const keypair = Keypair.fromPublicKey(publicKey);
    const messageBytes = Buffer.from(message, "utf8");

    // Modern path (SEP-53) if the installed SDK provides it.
    const maybeVerifyMessage = (keypair as unknown as {
      verifyMessage?: (m: string | Buffer, s: Buffer | Uint8Array) => boolean;
    }).verifyMessage;
    if (typeof maybeVerifyMessage === "function") {
      try {
        if (maybeVerifyMessage.call(keypair, message, toBuffer(signature))) return true;
      } catch {
        // fall through to raw paths
      }
    }

    // Raw signature path.
    const sigBuffer = toBuffer(signature);
    if (sigBuffer.length === 64) {
      return keypair.verify(messageBytes, sigBuffer);
    }

    return false;
  } catch {
    return false;
  }
}

function toBuffer(signature: string | Uint8Array): Buffer {
  if (signature instanceof Uint8Array) return Buffer.from(signature);
  // Strip any accidental whitespace; accept base64.
  return Buffer.from(signature.trim(), "base64");
}

/** Small helper: sign a message with a keypair (used in tests/dev scripts). */
export function signMessageWithKeypair(secret: string, message: string): string {
  const keypair = Keypair.fromSecret(secret);
  return keypair.sign(Buffer.from(message, "utf8")).toString("base64");
}
