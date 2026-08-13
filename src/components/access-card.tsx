"use client";

import * as React from "react";
import { revokeAccessAction } from "@/app/actions";
import { SHARE } from "@/lib/copy";
import { formatDate, isoDay } from "@/lib/format";
import {
  canRemoveMember,
  initial,
  isPermanentMember,
  sharedRole,
  type AccessMember,
  type ChildRole,
} from "@/lib/access";
import { cn } from "@/lib/cn";

/**
 * One person's access to a child.
 *
 * A co-manager's card carries the permanence sentence instead of a remove
 * control — the reason it cannot be undone is on the card, not in a tooltip or
 * a disabled button. Removing a view-only person is a two-step confirm inline
 * on the row, and the confirmation says that nobody is told about it.
 *
 * Everything this component decides is decided again in Postgres. A row that
 * offered a remove button it should not have would still be refused.
 */
export function AccessCard({
  member,
  myRole,
  childId,
  childName,
}: {
  member: AccessMember;
  myRole: ChildRole | null;
  childId: string;
  childName: string;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const role = sharedRole(member.role);
  const guardian = role === "guardian";
  const name = member.isSelf ? SHARE.you : member.displayName;

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-surface px-4 py-3.5 lg:gap-3 lg:p-[18px]">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-9.5 w-9.5 flex-none items-center justify-center rounded-full text-[15px] font-semibold",
            guardian ? "bg-accent text-white" : "bg-border text-ink-secondary",
          )}
        >
          {initial(name)}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-semibold lg:text-[17px]">{name}</span>
          <span className="text-[13px] text-ink-muted">
            {SHARE.since(formatDate(isoDay(member.since)))}
          </span>
        </span>
      </div>

      <span
        className={cn(
          "self-start rounded-full border px-2.5 py-[3px] text-xs font-semibold",
          guardian
            ? "border-accent-border bg-accent-surface text-accent-ink"
            : "border-border-strong bg-surface-muted text-ink-secondary",
        )}
      >
        {SHARE.roleName[role]}
      </span>
      <span className="text-[13px]/[1.45] text-ink-secondary lg:text-sm/[1.5]">
        {SHARE.roleSummary[role]}
      </span>

      {isPermanentMember(member) ? (
        <span className="prose-copy border-t border-hairline pt-2 text-[13px]/[1.45] text-ink-muted">
          {SHARE.permanent(member.displayName, childName)}
        </span>
      ) : null}

      {canRemoveMember(myRole, member) ? (
        <div className="flex flex-col gap-2 border-t border-hairline pt-2">
          {confirming ? (
            <>
              <span className="prose-copy text-sm/[1.5] text-ink-secondary">
                {SHARE.removeConfirm(member.displayName, childName)}
              </span>
              <div className="flex gap-2">
                <form action={revokeAccessAction}>
                  <input type="hidden" name="childId" value={childId} />
                  <input type="hidden" name="userId" value={member.userId} />
                  <button
                    type="submit"
                    className="min-h-11 cursor-pointer rounded-[10px] bg-ink px-4 text-[15px] font-semibold text-white"
                  >
                    {SHARE.remove}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="min-h-11 cursor-pointer rounded-[10px] border border-border-input px-4 text-[15px] font-semibold text-ink-secondary"
                >
                  {SHARE.cancel}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="min-h-11 cursor-pointer self-start px-1 text-sm font-semibold text-ink-muted hover:text-ink-secondary"
            >
              {SHARE.removeAsk}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
