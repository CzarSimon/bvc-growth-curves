"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/cn";

/** The measure switcher: a segmented control on a sunken track. */
export function Segmented({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
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
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "min-h-11 flex-1 cursor-pointer rounded-[9px] px-2.5 text-sm font-semibold text-ink-muted transition-colors",
        "data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-[0_1px_3px_rgba(28,26,23,0.12)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
      {...props}
    />
  );
}

export const SegmentedRoot = TabsPrimitive.Root;
export const SegmentedContent = TabsPrimitive.Content;

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
