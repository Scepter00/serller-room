import { Horizon, Networks, TransactionBuilder, Operation, Asset, BASE_FEE } from "@stellar/stellar-sdk";

export const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";
export const NETWORK_PASSPHRASE = STELLAR_NETWORK === "mainnet"
  ? Networks.PUBLIC
  : (process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET);
export const HORIZON_URL = process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

const horizon = new Horizon.Server(HORIZON_URL);

export async function getAccount(address: string) {
  return horizon.loadAccount(address);
}

export async function buildTipTransaction(from: string, destination: string, amount: string) {
  const account = await getAccount(from);
  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.payment({
      destination,
      asset: Asset.native(),
      amount,
    }))
    .setTimeout(300)
    .build();
}

export async function getExplorerUrl(hash: string) {
  const network = STELLAR_NETWORK === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}
