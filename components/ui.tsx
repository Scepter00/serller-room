import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-t-transparent",
        "border-brand",
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {icon && <div className="text-t3">{icon}</div>}
      <h3 className="text-base font-semibold text-t1">{title}</h3>
      {description && <p className="max-w-sm text-sm text-t2">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="text-sm text-danger">{message}</p>
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium text-t1 transition-colors hover:border-brand/60 hover:text-brand"
        >
          Try again
        </button>
      )}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all",
        "disabled:cursor-not-allowed disabled:opacity-50",
        {
          primary:
            "gradient-brand text-white shadow-sm shadow-brand/25 hover:shadow-md hover:shadow-brand/30 hover:brightness-110 active:scale-[0.98]",
          secondary:
            "border border-border bg-surface text-t1 hover:border-brand/50 hover:text-brand",
          ghost: "text-t2 hover:bg-surface-2 hover:text-t1",
          danger: "bg-danger/10 text-danger hover:bg-danger/20",
        }[variant],
        {
          sm: "h-8 px-3 text-sm",
          md: "h-9 px-4 text-sm",
          lg: "h-11 px-6 text-base",
        }[size],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4 border-t-transparent" />}
      {children}
    </button>
  );
}
