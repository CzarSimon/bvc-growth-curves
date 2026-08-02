"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/cn";

/**
 * The measure switcher and the zoom range are both single-choice controls over
 * the same chart, not tab panels — there is one region and it changes. Radix's
 * ToggleGroup gives that the right semantics and roving focus; Tabs would
 * promise a tabpanel that does not exist.
 */
export function Segmented({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn(
        "flex gap-1.5 rounded-[12px] border border-border bg-surface-muted p-1",
        className,
      )}
      {...props}
    />
  );
}

export function SegmentedItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        "min-h-11 flex-1 cursor-pointer rounded-[9px] px-2.5 text-sm font-semibold text-ink-muted transition-colors",
        "data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-[0_1px_3px_rgba(28,26,23,0.12)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
      {...props}
    />
  );
}

/** The zoom range pills. Single-select, always one selected. */
export function PillGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn("flex flex-wrap gap-1.5", className)}
      {...props}
    />
  );
}

export function Pill({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        "min-h-10 cursor-pointer rounded-full border border-border-input bg-surface px-3 text-[13px] font-semibold text-ink-secondary transition-colors",
        "data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
      {...props}
    />
  );
}
