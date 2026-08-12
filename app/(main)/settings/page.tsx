"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Save, Wallet } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button, FullPageSpinner } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { NetworkBadge } from "@/components/network-badge";
import { useSession } from "@/lib/client/session";
import { api } from "@/lib/client/api";
import { shortAddress } from "@/lib/utils";
import { BIO_MAX, USERNAME_MAX, USERNAME_MIN } from "@/lib/constants";

export default function SettingsPage() {
  const { user, loading, refresh } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (user?.profile) {
      setUsername(user.profile.username ?? "");
      setDisplayName(user.profile.displayName ?? "");
      setBio(user.profile.bio ?? "");
      setAvatarUrl(user.profile.avatarUrl ?? "");
    }
  }, [user]);

  if (loading) return <FullPageSpinner />;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl p-4 text-center">
        <p className="text-sm text-t2">
          Connect your wallet to manage your profile.{" "}
          <button onClick={() => router.push("/")} className="font-semibold text-brand">
            Go to home
          </button>
        </p>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: {
          username: username.trim().toLowerCase() || undefined,
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
        },
      });
      await refresh();
      setMessage({ ok: true, text: "Profile saved" });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Settings</h1>
        <div className="flex items-center gap-2">
          <NetworkBadge />
          <ThemeToggle />
        </div>
      </div>

      {/* identity */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <Avatar
            name={displayName || username || "me"}
            seed={user.walletAddress}
            src={avatarUrl || undefined}
            size="xl"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-t2">
              <Wallet className="h-4 w-4" /> {shortAddress(user.walletAddress)}
            </p>
            <p className="text-xs text-t3">
              Wallet and username stay separate — your identity is your wallet.
            </p>
          </div>
        </div>
      </div>

      {/* profile form */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-t2">
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_handle"
            minLength={USERNAME_MIN}
            maxLength={USERNAME_MAX}
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <p className="mt-1 text-xs text-t3">
            Letters, numbers and underscores — claimed once, public and unique.
          </p>
        </div>

        <div>
          <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-t2">
            Display name
          </label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            placeholder="Your name"
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </div>

        <div>
          <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-t2">
            Bio <span className="text-t3">({bio.length}/{BIO_MAX})</span>
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={BIO_MAX}
            rows={3}
            placeholder="Tell people about yourself"
            className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </div>

        <div>
          <label htmlFor="avatarUrl" className="mb-1.5 block text-sm font-medium text-t2">
            Avatar URL <span className="text-t3">(IPFS gateway URL recommended)</span>
          </label>
          <input
            id="avatarUrl"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…/ipfs/<cid>"
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 font-mono text-xs outline-none focus:border-brand"
          />
        </div>

        {message && (
          <p className={`text-sm ${message.ok ? "text-success" : "text-danger"}`}>
            {message.ok && <Check className="mr-1 inline h-4 w-4" />}
            {message.text}
          </p>
        )}

        <Button onClick={save} loading={saving}>
          <Save className="h-4 w-4" /> Save profile
        </Button>
      </div>
    </div>
  );
}
