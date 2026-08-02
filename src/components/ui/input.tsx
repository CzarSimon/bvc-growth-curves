"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/cn";

export function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-sm font-semibold text-ink", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "min-h-13 w-full min-w-0 rounded-[10px] border border-border-input bg-surface px-3.5 text-[17px] nums",
        "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
        "md:min-h-12 md:text-base",
        className,
      )}
      {...props}
    />
  );
}

/** An input with its unit printed inside the field, as on the BVC card. */
export function UnitInput({
  unit,
  className,
  ...props
}: React.ComponentProps<"input"> & { unit: string }) {
  return (
    <div className="flex items-center rounded-[10px] border border-border-input bg-surface pr-3.5 focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
      <input
        inputMode="decimal"
        className={cn(
          "min-h-14 w-full min-w-0 flex-1 border-0 bg-transparent px-3.5 text-xl nums outline-none md:min-h-12 md:text-base",
          className,
        )}
        {...props}
      />
      <span className="text-base text-ink-muted">{unit}</span>
    </div>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-[15px] font-semibold text-error">
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="text-[13px] text-ink-muted">{hint}</span> : null}
      <FieldError>{error}</FieldError>
    </label>
  );
}
