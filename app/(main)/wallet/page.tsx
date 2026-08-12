"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  Gift,
  LogOut,
  Wallet as WalletIcon,
} from "lucide-react";
import { Button, EmptyState, FullPageSpinner } from "@/components/ui";
import { NetworkBadge } from "@/components/network-badge";
import { useSession, logout } from "@/lib/client/session";
import { api } from "@/lib/client/api";
import { getWalletAddress } from "@/lib/client/wallet";
import { formatXlm, shortAddress } from "@/lib/utils";

interface TxItem {
  id: string;
  txHash: string | null;
  explorerUrl: string | null;
  direction: "sent" | "received";
  amount: string;
  asset: string;
  status: string;
  postId: string | null;
  createdAt: string;
}

export default function WalletPage() {
  const { user, loading: sessionLoading, refresh } = useSession();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [funding, setFunding] = useState(false);
  const [fundMessage, setFundMessage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TxItem[] | null>(null);

  useEffect(() => {
    if (user) void getWalletAddress().then(setWalletAddress);
  }, [user]);

  const loadTxs = useCallback(() => {
    void api<{ transactions: TxItem[] }>("/api/transactions")
      .then((d) => setTransactions(d.transactions))
      .catch(() => setTransactions([]));
  }, []);

  useEffect(() => {
    if (user) loadTxs();
  }, [user, loadTxs]);

  async function copyAddress() {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function fund() {
    setFunding(true);
    setFundMessage(null);
    try {
      await api("/api/wallet/fund", { method: "POST" });
      setFundMessage("Funded! 10,000 test XLM is on its way to your wallet.");
    } catch (e) {
      setFundMessage(e instanceof Error ? e.message : "Funding failed");
    } finally {
      setFunding(false);
    }
  }

  async function disconnect() {
    await logout();
    await refresh();
  }

  if (sessionLoading) return <FullPageSpinner />;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <EmptyState
          icon={<WalletIcon className="h-8 w-8" />}
          title="Connect your wallet"
          description="Your Stellar wallet is your Serller identity. Connect Freighter to continue."
          action={
            <Link href="/">
              <Button>Connect wallet</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <WalletIcon className="h-5 w-5 text-brand" /> Wallet
        </h1>
        <NetworkBadge />
      </div>

      {/* account card */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-2 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-t3">Connected address</p>
            <p className="mt-1 truncate font-mono text-sm font-semibold">
              {walletAddress ?? user.walletAddress}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={copyAddress}
              aria-label="Copy address"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-t2 transition-colors hover:text-t1"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={disconnect}
              aria-label="Disconnect"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-t2 transition-colors hover:text-danger"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-3 text-xs leading-relaxed text-t2">
          <p className="font-semibold text-t1">Testnet first (Rule 5)</p>
          <p className="mt-1">
            Serller runs on the Stellar Testnet. Fund your wallet with free test XLM below — no
            secret keys involved (Friendbot funds your address directly).
          </p>
        </div>

        <Button className="mt-4 w-full" onClick={fund} loading={funding}>
          <Gift className="h-4 w-4" />
          {funding ? "Funding…" : "Get testnet XLM (Friendbot)"}
        </Button>
        {fundMessage && <p className="mt-2 text-sm text-t2">{fundMessage}</p>}
      </div>

      {/* tip history */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-t3">
          Tip history
        </h2>
        {transactions === null ? (
          <FullPageSpinner />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No tips yet"
            description="Tips you send and receive will appear here with explorer links."
          />
        ) : (
          <ul className="space-y-2">
            {transactions.map((t) => (
              <li
                key={t.id}
                className="card-hover flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {t.direction === "sent" ? "Sent" : "Received"}{" "}
                    <span className="font-mono text-accent">
                      {formatXlm(t.amount)} {t.asset}
                    </span>
                  </p>
                  <p className="truncate text-xs text-t3">
                    {t.txHash ? shortAddress(t.txHash) : t.status} ·{" "}
                    {new Date(t.createdAt).toLocaleString()}
                  </p>
                </div>
                {t.explorerUrl && (
                  <a
                    href={t.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open in explorer"
                    className="shrink-0 rounded-full p-2 text-t3 transition-colors hover:bg-surface-2 hover:text-brand"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
