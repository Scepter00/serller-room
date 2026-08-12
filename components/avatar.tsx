import Image from "next/image";
import { cn, colorFromSeed, initials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  seed: string;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
} as const;

export function Avatar({ name, seed, src, size = "md", className }: AvatarProps) {
  const color = colorFromSeed(seed);
  const container = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white select-none",
    SIZES[size],
    className
  );

  if (src) {
    return (
      <span className={container}>
        <Image
          src={src}
          alt={name}
          fill
          sizes="80px"
          className="object-cover"
          unoptimized={src.startsWith("/uploads/")}
        />
      </span>
    );
  }

  return (
    <span className={container} style={{ backgroundColor: color }} aria-hidden>
      {initials(name || seed)}
    </span>
  );
}
