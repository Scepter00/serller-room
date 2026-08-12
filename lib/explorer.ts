import { getNetworkConfig } from "@/lib/stellar/network";

/** Build a stellar.expert URL for a transaction hash on the active network. */
export function explorerTxUrl(txHash: string): string {
  const network = getNetworkConfig().network;
  const networkPath = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${networkPath}/tx/${txHash}`;
}

export function explorerAccountUrl(address: string): string {
  const network = getNetworkConfig().network;
  const networkPath = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${networkPath}/account/${address}`;
}
