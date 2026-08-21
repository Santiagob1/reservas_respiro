import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" && "px-6 py-3 text-sm",
        size === "sm" && "px-3.5 py-1.5 text-xs",
        variant === "primary" && "bg-gold text-ink hover:bg-gold-soft",
        variant === "secondary" && "border border-line text-cream hover:border-gold hover:text-gold",
        variant === "ghost" && "text-cream-dim hover:text-gold",
        className
      )}
      {...props}
    />
  );
}
