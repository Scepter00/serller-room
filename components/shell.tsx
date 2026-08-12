"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Compass,
  Home,
  PenSquare,
  Settings,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn, shortAddress } from "@/lib/utils";
import { NetworkBadge } from "@/components/network-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/client/session";

const NAV = [
  { href: "/feed", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = NAV.slice(0, 4);

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border px-4 py-6 lg:flex">
        <Link href="/feed" className="mb-8 flex items-center gap-2 px-2">
          <span className="gradient-brand flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black text-white">
            S
          </span>
          <span className="text-xl font-extrabold tracking-tight">Serller</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/feed"
                ? pathname === "/feed"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium transition-colors",
                  active
                    ? "bg-surface-2 text-t1"
                    : "text-t2 hover:bg-surface-2/60 hover:text-t1"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 px-4">
          <NetworkBadge />
        </div>

        <Button
          className="mt-6 w-full"
          onClick={() => router.push(user ? "/feed?compose=1" : "/")}
        >
          <PenSquare className="h-4 w-4" />
          New Post
        </Button>

        <div className="mt-auto flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
          </div>
          {user ? (
            <Link
              href={
                user.profile?.username
                  ? `/profile/${user.profile.username}`
                  : "/settings"
              }
              className="flex items-center gap-3 rounded-full p-2 transition-colors hover:bg-surface-2"
            >
              <Avatar
                name={user.profile?.displayName ?? "me"}
                seed={user.walletAddress}
                src={user.profile?.avatarUrl}
                size="sm"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {user.profile?.username ?? "Set username"}
                </p>
                <p className="truncate text-xs text-t3 font-mono">
                  {shortAddress(user.walletAddress)}
                </p>
              </div>
            </Link>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-3 rounded-full p-2 transition-colors hover:bg-surface-2"
            >
              <Avatar name="guest" seed="guest" size="sm" />
              <span className="text-sm font-medium text-t2">Sign in with wallet</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────── */}
      <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>

      {/* ── Mobile top bar ──────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/feed" className="flex items-center gap-2">
          <span className="gradient-brand flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black text-white">
            S
          </span>
          <span className="text-lg font-extrabold">Serller</span>
          <NetworkBadge className="ml-1" />
        </Link>
        <ThemeToggle />
      </header>

      {/* ── Mobile bottom nav ───────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active =
            item.href === "/feed"
              ? pathname === "/feed"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-brand" : "text-t3 hover:text-t2"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
