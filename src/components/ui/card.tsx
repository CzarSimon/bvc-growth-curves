import * as React from "react";
import { cn } from "@/lib/cn";

/** Cards use borders, not shadows. */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-border bg-surface p-[18px]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("font-serif text-xl font-semibold text-ink", className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("prose-copy text-base/[1.55] text-ink-secondary", className)}
      {...props}
    />
  );
}

export function CardDivider({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("border-t border-hairline", className)} {...props} />;
}
