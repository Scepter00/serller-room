/** Convert a decimal XLM string (up to 7 decimals) to stroops (BigInt). */
export function xlmToStroops(amount: string): bigint {
  const parts = amount.split(".");
  const whole = parts[0] ?? "0";
  const frac = (parts[1] ?? "").padEnd(7, "0").slice(0, 7);
  return BigInt(whole || "0") * 10_000_000n + BigInt(frac || "0");
}

/** Convert stroops to a decimal XLM string, trimmed of trailing zeros. */
export function stroopsToXlm(stroops: bigint | string): string {
  const raw = BigInt(stroops);
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const whole = abs / 10_000_000n;
  const frac = (abs % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  const value = frac ? `${whole}.${frac}` : whole.toString();
  return negative ? `-${value}` : value;
}
