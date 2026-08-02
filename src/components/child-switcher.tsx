"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SWITCHER, CHILD_FORM, NAV } from "@/lib/copy";
import { formatAge, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Child } from "@/lib/child-data";

export type ChildSummary = Child & { ageDays: number };

function meta(child: ChildSummary): string {
  const sex = child.sex === "female" ? CHILD_FORM.girl : CHILD_FORM.boy;
  return `${sex} · ${formatAge(child.ageDays)} · född ${formatDate(child.birthDate)}`;
}

/**
 * Entering a measurement on the wrong child is a real and damaging error, so
 * the active child is visible on every screen and switching is one tap.
 */
export function ChildChip({
  child,
  childList,
}: {
  child: ChildSummary;
  childList: ChildSummary[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pr-3.5 pl-1.5 text-left hover:bg-[#F2EFE9]">
        <Avatar name={child.name} active />
        <span className="flex flex-col leading-[1.15]">
          <span className="text-[15px] font-semibold">{child.name}</span>
          <span className="text-xs text-ink-muted">{formatAge(child.ageDays)}</span>
        </span>
        <span className="ml-1 text-[11px] text-ink-muted">{NAV.switch}</span>
      </SheetTrigger>
      <SheetContent title={SWITCHER.heading}>
        <span className="px-1 pb-1 text-[13px] text-ink-muted">{SWITCHER.hint}</span>
        <ChildRows list={childList} activeId={child.id} onPicked={() => setOpen(false)} />
        <Link
          href="/barn/nytt"
          className="mt-1 flex min-h-14 items-center justify-center rounded-[12px] border border-dashed border-border-strong text-base font-semibold text-accent"
        >
          {SWITCHER.add}
        </Link>
      </SheetContent>
    </Sheet>
  );
}

export function ChildRows({
  list,
  activeId,
  onPicked,
}: {
  list: ChildSummary[];
  activeId: string;
  onPicked?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
      {list.map((child) => {
        const active = child.id === activeId;
        return (
          <button
            key={child.id}
            type="button"
            onClick={() => {
              onPicked?.();
              // Keep the parent on the same screen for the child they picked.
              const suffix = pathname.replace(/^\/barn\/[^/]+/, "");
              const keep = /^(\/kurvor|\/matningar)$/.test(suffix) ? suffix : "";
              router.push(`/barn/${child.id}${keep}`);
            }}
            className={cn(
              "flex min-h-15 w-full cursor-pointer items-center gap-3 rounded-[12px] border p-2 px-3 text-left",
              active ? "border-accent bg-accent-surface" : "border-border bg-surface",
            )}
          >
            <Avatar name={child.name} active={active} />
            <span className="flex flex-col leading-[1.25]">
              <span className="text-[17px] font-semibold">{child.name}</span>
              <span className="text-[13px] text-ink-muted">{meta(child)}</span>
            </span>
            {active ? (
              <span className="ml-auto text-sm font-semibold text-accent">
                {SWITCHER.selected}
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

export function Avatar({
  name,
  active,
  size = 36,
}: {
  name: string;
  active?: boolean;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size < 34 ? 14 : 15 }}
      className={cn(
        "flex flex-none items-center justify-center rounded-full font-semibold",
        active ? "bg-accent text-white" : "bg-hairline text-ink-secondary",
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
