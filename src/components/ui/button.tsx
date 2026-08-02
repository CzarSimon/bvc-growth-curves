import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Nothing interactive drops below 44px, so every size here starts there.
 * Primary actions are 54–56px.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-hover",
        outline:
          "border border-border-input bg-surface text-ink-secondary hover:border-border-strong",
        dashed:
          "border border-dashed border-border-strong bg-transparent text-accent hover:bg-surface",
        quiet: "bg-transparent text-accent hover:text-accent-ink",
        muted: "bg-transparent text-ink-muted hover:text-ink-secondary",
      },
      size: {
        primary: "min-h-14 px-5 text-[17px]",
        default: "min-h-11 px-4 text-[15px]",
        compact: "min-h-11 px-3 text-sm",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "default", block: false },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
  );
}

export { buttonVariants };
