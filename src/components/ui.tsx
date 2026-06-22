import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "danger" | "active";

const VARIANTS: Record<Variant, string> = {
  default:
    "text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  danger:
    "text-zinc-500 hover:bg-red-500/15 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400",
  active:
    "bg-accent-500/15 text-accent-600 hover:bg-accent-500/25 dark:text-accent-300",
};

const SIZES = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
} as const;

/** アイコンのみのボタン。label を title と aria-label に必ず付ける。 */
export function IconButton({
  label,
  children,
  variant = "default",
  size = "md",
  className = "",
  ...rest
}: {
  label: string;
  children: ReactNode;
  variant?: Variant;
  size?: keyof typeof SIZES;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`grid cursor-pointer place-items-center rounded-md outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-accent-500/60 active:scale-90 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
