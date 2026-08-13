"use client";

import * as React from "react";
import { useActionState } from "react";
import { createInviteAction, type InviteState } from "@/app/actions";
import { SHARE } from "@/lib/copy";
import type { SharedRole } from "@/lib/access";
import { cn } from "@/lib/cn";

/**
 * Choosing what to share, then making the link.
 *
 * The order is the point: the role is picked before the link exists, and the
 * screen says so. The irreversible choice sits next to the safe one — side by
 * side on desktop — so it is compared rather than scrolled past, and picking it
 * raises the warning before anything has been created.
 *
 * Changing the role after a link exists drops that link from the screen. The
 * link that is showing always belongs to the role that is selected; a parent
 * must never be able to copy a "Kan se" link while the card says "Delar
 * ansvaret".
 */
export function InviteScreen({ childId, childName }: { childId: string; childName: string }) {
  const [role, setRole] = React.useState<SharedRole>("viewer");
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    createInviteAction,
    null,
  );
  const [copied, setCopied] = React.useState(false);

  const link = state && "link" in state && state.role === role ? state.link : null;
  const error = state && "error" in state ? state.error : null;

  function pick(next: SharedRole) {
    setRole(next);
    setCopied(false);
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3.5">
        {(["viewer", "guardian"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => pick(option)}
            aria-pressed={role === option}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-[12px] p-3.5 text-left",
              role === option
                ? "border-2 border-accent bg-accent-surface/45"
                : "border border-border-strong bg-surface",
            )}
          >
            <span className="text-base font-semibold lg:text-[17px]">
              {SHARE.roleName[option]}
            </span>
            <span className="prose-copy text-sm/[1.45] text-ink-secondary lg:leading-[1.5]">
              {SHARE.roleChoice[option]}
            </span>
          </button>
        ))}
      </div>

      {role === "guardian" ? (
        <div className="flex gap-2.5 rounded-[14px] border border-border-strong bg-surface px-4 py-3.5 lg:gap-3 lg:p-[18px]">
          <span
            aria-hidden
            className="flex h-6 w-6 flex-none items-center justify-center rounded-md border-[1.5px] border-ink text-sm font-bold"
          >
            !
          </span>
          <p className="prose-copy m-0 text-sm/[1.5] text-ink-secondary lg:text-[15px]/[1.55]">
            {SHARE.permanentWarning(childName)}
          </p>
        </div>
      ) : null}

      {link ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-4 lg:p-5">
          <span className="text-[13px] text-ink-muted">{SHARE.linkFor(SHARE.roleName[role])}</span>
          <span className="text-base leading-[1.4] font-semibold break-all lg:text-[19px] lg:leading-[1.35]">
            {link.replace(/^https?:\/\//, "")}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(link);
                setCopied(true);
              }}
              className="min-h-12 cursor-pointer rounded-[10px] bg-accent px-4.5 text-[15px] font-semibold text-white"
            >
              {copied ? SHARE.copied : SHARE.copyLink}
            </button>
            <form action={formAction} onSubmit={() => setCopied(false)}>
              <input type="hidden" name="childId" value={childId} />
              <input type="hidden" name="role" value={role} />
              <button
                type="submit"
                disabled={pending}
                className="min-h-12 cursor-pointer rounded-[10px] border border-border-input px-4 text-[15px] font-semibold text-ink-secondary disabled:opacity-60"
              >
                {SHARE.newLink}
              </button>
            </form>
          </div>
          <span className="prose-copy border-t border-hairline pt-2.5 text-[13px]/[1.5] text-ink-secondary lg:text-sm/[1.55]">
            {SHARE.linkTerms}
          </span>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col">
          <input type="hidden" name="childId" value={childId} />
          <input type="hidden" name="role" value={role} />
          <button
            type="submit"
            disabled={pending}
            className="min-h-13 cursor-pointer rounded-[12px] bg-accent px-6 text-base font-semibold text-white disabled:opacity-60 lg:min-h-12.5 lg:self-start"
          >
            {SHARE.createLink}
          </button>
        </form>
      )}

      {error ? <p className="m-0 text-sm text-error">{error}</p> : null}
    </div>
  );
}
