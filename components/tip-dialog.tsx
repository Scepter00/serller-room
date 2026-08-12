"use client";

import { useState } from "react";
import { CheckCircle2, Coins, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/client/api";
import { signTransactionWithWallet } from "@/lib/client/wallet";
import { useSession } from "@/lib/client/session";
import { formatXlm, shortAddress } from "@/lib/utils";
import type { ApiPost } from "@/lib/feed";

interface TipResult {
  txHash: string;
  status: string;
  explorerUrl: string;
  amount: string;
}

export function TipDialog({
  post,
  onClose,
  onTipped,
}: {
  post: ApiPost;
  onClose: () => void;
  onTipped: () => void;
}) {
  const { user } = useSession();
  const [amount, setAmount] = useState("5");
  const [step, setStep] = useState<"form" | "signing" | "done" | "error">("form");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TipResult | null>(null);

  const authorName = post.author.displayName ?? post.author.username ?? "creator";

  async function sendTip() {
    if (!user) return;
    setError(null);
    setStep("signing");
    try {
      // 1. Server builds the payment — recipient resolved server-side (never trusted from client).
      const build = await api<{
        buildId: string;
        unsignedXdr: string;
        recipientAddress: string;
        amount: string;
        networkPassphrase: string;
      }>("/api/transactions/tip", {
        method: "POST",
        body: {
          username: post.author.username,
          amount,
          postId: post.id,
        },
      });

      // 2. Wallet signs the transaction.
      const signedXdr = await signTransactionWithWallet(
        build.unsignedXdr,
        build.networkPassphrase,
        user.walletAddress
      );

      // 3. Server re-verifies dest/amount/asset, submits, and records.
      const submitted = await api<TipResult>("/api/transactions/submit", {
        method: "POST",
        body: { buildId: build.buildId, signedXdr },
      });

      setResult(submitted);
      setStep("done");
      onTipped();
    } catch (e) {
      setStep("error");
      setError(e instanceof Error ? e.message : "Tip failed");
    }
  }

  const recipientDisplay = post.author.username
    ? `@${post.author.username}`
    : shortAddress(post.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Send an XLM tip"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              name={authorName}
              seed={post.author.username ?? post.id}
              src={post.author.avatarUrl}
              size="md"
            />
            <div>
              <h2 className="font-bold">Tip {authorName}</h2>
              <p className="text-xs text-t3">{recipientDisplay} · Stellar Testnet</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-t3 transition-colors hover:bg-surface-2 hover:text-t1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "done" && result ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <h3 className="text-lg font-bold">Tip sent 🎉</h3>
            <p className="text-sm text-t2">
              {formatXlm(result.amount)} XLM on its way to {authorName}.
            </p>
            <p className="max-w-full truncate rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-t3">
              {result.txHash}
            </p>
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
            >
              View on explorer <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button className="mt-2" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label htmlFor="tip-amount" className="mb-1.5 block text-sm font-medium text-t2">
                Amount (XLM)
              </label>
              <div className="relative">
                <Coins className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t3" />
                <input
                  id="tip-amount"
                  type="number"
                  min="1"
                  step="0.1"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={step === "signing"}
                  className="w-full rounded-xl border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-lg font-semibold outline-none focus:border-brand"
                />
              </div>
              <p className="mt-2 text-xs text-t3">
                You will confirm this payment in your Freighter wallet. Minimum 1 XLM.
              </p>
            </div>

            {step === "error" && error && (
              <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} disabled={step === "signing"}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={sendTip}
                loading={step === "signing"}
                disabled={!amount || Number(amount) < 1}
              >
                {step === "signing" ? "Waiting for wallet…" : `Tip ${amount} XLM`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
