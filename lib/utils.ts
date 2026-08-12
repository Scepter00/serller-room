import { StrKey } from "@stellar/stellar-sdk";
import { USERNAME_PATTERN } from "./constants";

/** Join class names, skipping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Relative time, e.g. "3m", "2h", "5d", "Jan 2". */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Full date for titles. */
export function fullDate(date: Date | string): string {
  return new Date(date).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Normalize a Stellar amount string (stroops or decimal) for display.
 * e.g. "10000000" -> "1", "1.5000000" -> "1.5"
 */
export function formatXlm(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString(undefined, { maximumFractionDigits: 7 });
}

/** Shorten a Stellar public key for display: GABC…WXYZ */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Validate a Stellar ed25519 public key (G…). */
export function isValidPublicKey(value: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(value);
  } catch {
    return false;
  }
}

/** Validate a Stellar contract id (C…) or public key. */
export function isValidAddressOrContract(value: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value);
  } catch {
    return false;
  }
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

/** Extract lowercase unique hashtags from text. */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#([a-zA-Z0-9_]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

/** Extract mentioned usernames (valid Serller usernames) from text. */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z][a-zA-Z0-9_]{2,19})/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

/** Deterministic color from a seed string (for avatar placeholders). */
export function colorFromSeed(seed: string): string {
  const palette = [
    "#8b5cf6",
    "#3b82f6",
    "#06b6d4",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#ec4899",
    "#14b8a6",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

/** Initials for avatar placeholder. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Build a public gateway URL for an IPFS CID. */
export function ipfsUrl(cid: string, gateway: string): string {
  const base = gateway.replace(/\/+$/, "");
  if (cid.startsWith("http")) return cid;
  if (base.includes("/ipfs/")) return `${base}/${cid}`;
  return `${base}/ipfs/${cid}`;
}

/** Extract the first URL from a string, if any. */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0].replace(/[),.;]+$/, "") : null;
}

export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Sleep helper. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
