"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";
import { ChildChip, ChildRows, type ChildSummary } from "./child-switcher";
import { APP_NAME, NAV, SWITCHER } from "@/lib/copy";
import { cn } from "@/lib/cn";

/**
 * The overview is the only nav item that matches exactly; every other section
 * stays lit while you are inside it, so "Bjud in" still reads as "Tillgång".
 */
function isActive(pathname: string, href: string, base: string): boolean {
  return href === base ? pathname === base : pathname.startsWith(href);
}

/**
 * Mobile gets a header with the active child chip; desktop gets a persistent
 * sidebar with the children on top and the nav pinned to the bottom. Both are
 * present on every screen inside a child, so the active child is never in
 * doubt.
 */
export function AppShell({
  child,
  childList,
  canEdit,
  children,
}: {
  child: ChildSummary;
  children: React.ReactNode;
  childList: ChildSummary[];
  /** False for a view-only user: no add button, anywhere. */
  canEdit: boolean;
}) {
  const pathname = usePathname();
  const base = `/barn/${child.id}`;
  // The primary action rides on the screens a parent reads, not on the forms.
  const onHistory = pathname === `${base}/matningar`;
  const showAddButton =
    canEdit && (pathname === base || pathname === `${base}/kurvor` || onHistory);
  // From the history list, saving returns to the list rather than the overview.
  const addHref = `${base}/matningar/ny${onHistory ? "?retur=matningar" : ""}`;
  const navItems = [
    { href: base, label: NAV.overview },
    { href: `${base}/kurvor`, label: NAV.charts },
    { href: `${base}/matningar`, label: NAV.measurements },
    // Sharing is a fourth nav item rather than a setting: who can read a
    // child's measurements is not a preference.
    { href: `${base}/tillgang`, label: NAV.access },
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-bg px-4 pt-3.5 pb-3 lg:hidden">
        <ChildChip child={child} childList={childList} />
        <Link
          href={`${base}/matningar`}
          className="flex min-h-11 items-center px-3 text-sm font-semibold text-accent"
        >
          {NAV.measurements}
        </Link>
      </header>

      <aside className="hidden w-67 flex-none flex-col gap-1.5 border-r border-border bg-surface-sunken px-3.5 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="flex items-center gap-2.5 px-1.5 pb-3.5">
          <BrandMark size={30} />
          <span className="font-serif text-[19px] font-semibold">{APP_NAME}</span>
        </div>
        <span className="px-1.5 pb-1.5 text-xs tracking-[0.06em] text-ink-muted uppercase">
          {SWITCHER.heading}
        </span>
        <ChildRows list={childList} activeId={child.id} />
        <Link
          href="/barn/nytt"
          className="mt-1 flex min-h-11 items-center justify-center rounded-[10px] border border-dashed border-border-strong text-sm font-semibold text-accent"
        >
          {SWITCHER.add}
        </Link>

        <nav className="mt-auto flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-10.5 items-center rounded-[9px] px-3 text-[15px] font-semibold",
                isActive(pathname, item.href, base)
                  ? "bg-accent-surface text-accent"
                  : "text-ink-secondary hover:bg-surface",
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/om-kurvorna"
            className="flex min-h-10.5 items-center rounded-[9px] px-3 text-sm text-ink-muted hover:bg-surface"
          >
            {NAV.about}
          </Link>
        </nav>
      </aside>

      <main className="flex-1 lg:overflow-y-auto">{children}</main>

      {showAddButton ? (
        <div className="sticky bottom-0 z-30 flex bg-gradient-to-t from-bg from-62% to-transparent px-4 pt-3 pb-5 lg:hidden">
          <Link
            href={addHref}
            className="flex min-h-14 flex-1 items-center justify-center rounded-[14px] bg-accent text-[17px] font-semibold text-white shadow-[0_6px_20px_rgba(28,92,102,0.22)]"
          >
            {NAV.addMeasurement}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
