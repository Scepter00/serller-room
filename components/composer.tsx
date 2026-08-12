"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Link2, ShieldCheck, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { POST_TEXT_MAX } from "@/lib/constants";

export function Composer({ onCreated }: { onCreated?: () => void }) {
  const { user } = useSession();
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [notarize, setNotarize] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    e.target.value = "";
  }

  function clearFile() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  async function submit() {
    if (!user) return;
    if (!text.trim() && !file && !link.trim()) {
      setError("Add some text, an image, or a link.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let mediaCid: string | undefined;
      let mediaUrl: string | undefined;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const media = await fetch("/api/media", {
          method: "POST",
          headers: { "x-serller-csrf": "1" },
          credentials: "same-origin",
          body: form,
        });
        if (!media.ok) {
          const body = await media.json().catch(() => ({}));
          throw new Error(body.error?.message ?? "Upload failed");
        }
        const mediaJson = (await media.json()) as { cid: string; url: string };
        mediaCid = mediaJson.cid;
        mediaUrl = mediaJson.url;
      }

      const cleanLink = link.trim() || undefined;
      await api("/api/posts", {
        method: "POST",
        body: {
          text: text.trim() || undefined,
          mediaCid,
          mediaUrl,
          link: cleanLink,
          notarize,
        },
      });

      setText("");
      setLink("");
      setNotarize(false);
      clearFile();
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create post");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
        <p className="text-sm text-t2">
          Connect your Freighter wallet to start posting.
        </p>
      </div>
    );
  }

  const canPost = (text.trim() || file || link.trim()) && !busy;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex gap-3">
        <Avatar
          name={user.profile?.displayName ?? "me"}
          seed={user.walletAddress}
          src={user.profile?.avatarUrl}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening on Stellar?"
            maxLength={POST_TEXT_MAX}
            rows={3}
            className="w-full resize-none rounded-xl bg-transparent py-1 text-[15px] leading-relaxed outline-none placeholder:text-t3"
          />

          {previewUrl && file && (
            <div className="relative mt-2 inline-block overflow-hidden rounded-xl border border-border">
              <Image
                src={previewUrl}
                alt="Upload preview"
                width={320}
                height={240}
                className="max-h-52 w-full object-cover"
              />
              <button
                type="button"
                onClick={clearFile}
                aria-label="Remove image"
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {link && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-brand-2">
              <Link2 className="h-3.5 w-3.5" />
              <span className="max-w-[260px] truncate">{link}</span>
              <button
                type="button"
                onClick={() => setLink("")}
                aria-label="Remove link"
                className="text-t3 hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
              className="hidden"
              onChange={pickFile}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label="Attach image"
              className="rounded-full p-2 text-t2 transition-colors hover:bg-surface-2 hover:text-brand"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const url = prompt("Paste a link (https://…)");
                if (url) setLink(url.trim());
              }}
              aria-label="Attach link"
              className="rounded-full p-2 text-t2 transition-colors hover:bg-surface-2 hover:text-brand"
            >
              <Link2 className="h-5 w-5" />
            </button>

            <label className="ml-1 flex cursor-pointer select-none items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium text-t2 transition-colors hover:bg-surface-2 hover:text-t1">
              <input
                type="checkbox"
                checked={notarize}
                onChange={(e) => setNotarize(e.target.checked)}
                className="h-3.5 w-3.5 accent-[--brand]"
              />
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Notarize on-chain
            </label>

            <span className="ml-auto text-xs text-t3">
              {text.length}/{POST_TEXT_MAX}
            </span>
            <Button size="sm" onClick={submit} disabled={!canPost} loading={busy}>
              {busy ? "Posting…" : "Post"}
            </Button>
          </div>

          {notarize && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-t3">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              A hash of this post will be registered in the Soroban notary contract on Testnet.
            </p>
          )}

          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
