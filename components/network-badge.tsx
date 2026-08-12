import { cn } from "@/lib/utils";

/**
 * Network indicator. Reads the build-time env; shows a TESTNET badge whenever
 * the app is not configured for mainnet (Phase 5: network indicator).
 */
export function NetworkBadge({ className }: { className?: string }) {
  const network = process.env.NEXT_PUBLIC_NETWORK ?? "testnet";
  const isTestnet = network !== "mainnet";

  if (!isTestnet) return null;

  return (
    <span
      title="Serller currently runs on the Stellar Testnet"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-500",
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
      </span>
      TESTNET
    </span>
  );
}
