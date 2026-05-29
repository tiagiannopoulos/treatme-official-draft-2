import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "text";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  icon?: ReactNode;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-cream hover:bg-ink-soft active:scale-[0.98] transition",
  secondary:
    "bg-bubblegum text-ink hover:bg-bubblegum/85 transition",
  outline:
    "border border-ink/80 text-ink bg-transparent hover:bg-ink hover:text-cream transition",
  text:
    "text-ink underline-offset-4 hover:underline px-0",
};

export const PillButton = forwardRef<HTMLButtonElement, Props>(function PillButton(
  { variant = "primary", fullWidth, icon, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 font-semibold text-[15px] tracking-tight lowercase disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variant !== "text" && "shadow-[0_1px_0_rgba(0,0,0,0.04)]",
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
});
