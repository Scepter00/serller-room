import { Networks } from "@stellar/stellar-sdk";
import { STELLAR_NETWORKS, type StellarNetworkName } from "@/lib/constants";

/**
 * Resolve the active Stellar network from the environment.
 * Mainnet is locked behind an explicit opt-in (Rule 5: testnet first).
 */
export function getNetworkConfig(): {
  network: StellarNetworkName;
  passphrase: string;
  horizonUrl: string;
  rpcUrl: string;
  friendbotUrl: string | null;
} {
  const requested = (process.env.STELLAR_NETWORK ?? "testnet").toLowerCase();
  if (requested === "mainnet") {
    if (process.env.STELLAR_MAINNET_ENABLED !== "true") {
      throw new Error(
        "Mainnet is disabled. Set STELLAR_MAINNET_ENABLED=true ONLY after the security review passes (Rule 5)."
      );
    }
    return STELLAR_NETWORKS.mainnet;
  }
  return STELLAR_NETWORKS.testnet;
}

export function networkPassphrase(): string {
  const cfg = getNetworkConfig();
  return cfg.passphrase;
}

export function sdkNetworks(): string {
  return getNetworkConfig().network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
}

export function isTestnet(): boolean {
  return getNetworkConfig().network === "testnet";
}
