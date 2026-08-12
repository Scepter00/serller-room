"use client";

import { useState } from "react";
import { LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui";
import { useSession, logout, authenticateWithWallet } from "@/lib/client/session";
import { shortAddress } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function WalletButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const { user, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const { isNewUser } = await authenticateWithWallet();
      await refresh();
      router.push(isNewUser ? "/settings" : "/feed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    await logout();
    await refresh();
    router.refresh();
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button variant={variant} size="sm" onClick={() => router.push("/wallet")}>
          <Wallet className="h-4 w-4" />
          {shortAddress(user.walletAddress)}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDisconnect} aria-label="Disconnect wallet">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={handleConnect} loading={busy} size={variant === "primary" ? "lg" : "sm"}>
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
