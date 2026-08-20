import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-gold text-ink hover:bg-gold-soft",
        variant === "secondary" && "border border-line text-cream hover:border-gold hover:text-gold",
        variant === "ghost" && "text-cream-dim hover:text-gold",
        className
      )}
      {...props}
    />
  );
}
