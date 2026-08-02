"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/** A bottom sheet. Tapping anywhere above it dismisses. */
export function SheetContent({
  className,
  title,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[rgba(28,26,23,0.38)]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 rounded-t-[20px] border-t border-border bg-bg px-4 pt-2.5 pb-6",
          "focus:outline-none",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        <div
          aria-hidden
          className="my-1 mb-2.5 h-1 w-9.5 self-center rounded-full bg-border-input"
        />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
