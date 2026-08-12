import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Coins,
  Fingerprint,
  Globe,
  Images,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { APP_TAGLINE } from "@/lib/constants";
import { NetworkBadge } from "@/components/network-badge";

const FEATURES = [
  {
    icon: Fingerprint,
    title: "Your wallet is your identity",
    body: "Connect Freighter and authenticate by signing a challenge. Serller never sees your private key — ever.",
  },
  {
    icon: Coins,
    title: "Real XLM tips",
    body: "Tip creators in XLM with a server-built, wallet-signed payment that settles on Stellar in seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Verifiable content",
    body: "Opt-in notarization anchors a hash of your post in a Soroban contract — provable authorship.",
  },
  {
    icon: Images,
    title: "Content-addressed media",
    body: "Images live on IPFS, referenced by CID — portable, deduplicated, and never trapped in a database blob.",
  },
  {
    icon: Globe,
    title: "Open & testnet-first",
    body: "Open source, documented, and fully running on Stellar Testnet before any mainnet deployment.",
  },
  {
    icon: Zap,
    title: "A social app that feels normal",
    body: "Feed, follow, like, comment, notifications — the social UX you know, with crypto that actually works.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-brand/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-brand-2/20 blur-[120px]" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="gradient-brand flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black text-white">
            S
          </span>
          <span className="text-xl font-extrabold tracking-tight">Serller</span>
        </div>
        <nav className="flex items-center gap-4">
          <NetworkBadge />
          <Link
            href="/feed"
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-t1 transition-colors hover:border-brand/50 hover:text-brand"
          >
            Open the app
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* hero */}
        <section className="flex flex-col items-center gap-6 pb-20 pt-16 text-center md:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            The social network on Stellar
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Post. Follow. Get tipped in{" "}
            <span className="gradient-text">real XLM.</span>
          </h1>
          <p className="max-w-xl text-lg text-t2">{APP_TAGLINE} Wallet identity, real payments,
            verifiable content — Testnet first, open source always.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/feed"
              className="gradient-brand rounded-full px-7 py-3 font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:shadow-xl hover:shadow-brand/30 hover:brightness-110"
            >
              Start exploring
            </Link>
            <Link
              href="/discover"
              className="rounded-full border border-border bg-surface px-7 py-3 font-semibold text-t1 transition-colors hover:border-brand/50 hover:text-brand"
            >
              Browse without a wallet
            </Link>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-t3">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Requires the Freighter wallet for posting & tipping · funded free on Testnet
          </p>
        </section>

        {/* features */}
        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card-hover rounded-2xl border border-border bg-surface p-6"
            >
              <div className="gradient-brand mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-t2">{f.body}</p>
            </div>
          ))}
        </section>

        {/* notifications teaser */}
        <section className="mb-20 flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-10 text-center">
          <Bell className="h-8 w-8 text-brand" />
          <h2 className="max-w-xl text-2xl font-bold md:text-3xl">
            Follow, like, comment — and get tipped for it
          </h2>
          <p className="max-w-lg text-t2">
            Notifications for follows, likes, comments, replies, mentions and tips. Discover
            trending posts and creators. Report abuse. Block and mute. All of it open source.
          </p>
          <div className="mt-2 flex gap-3">
            <Link
              href="/feed"
              className="rounded-full border border-border bg-surface-2 px-6 py-2.5 font-semibold text-t1 transition-colors hover:border-brand/50 hover:text-brand"
            >
              Enter the room
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-t3 md:flex-row">
          <span>© {new Date().getFullYear()} Serller · MIT licensed · open source</span>
          <div className="flex gap-4">
            <Link href="https://github.com/Scepter00/serller-room" className="hover:text-t1">
              GitHub
            </Link>
            <Link href="/docs" className="hover:text-t1">
              Docs
            </Link>
            <Link href="/settings" className="hover:text-t1">
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
