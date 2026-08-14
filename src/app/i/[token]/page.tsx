import Link from "next/link";
import { acceptInviteAction } from "@/app/actions";
import { BrandMark } from "@/components/brand-mark";
import { getInvitePreview, isSignedIn } from "@/lib/db";
import { hashInviteToken, isPlausibleToken } from "@/lib/invite";
import { sharedRole } from "@/lib/access";
import { SHARE } from "@/lib/copy";

/**
 * The invitee's first view — the one screen in the product a person can reach
 * before they have an account, and the only one that has to explain itself from
 * nothing.
 *
 * It says who shared what, what joining will mean, and — for "Delar ansvaret" —
 * that it cannot be undone, before there is any way to accept. The role shown
 * is read from the invite row in the database; the token in the URL is the only
 * thing this page sends, so a forwarded or edited link cannot ask for more than
 * it was made with.
 *
 * Centred at 560px on desktop: it should read like a letter, not an admin
 * panel.
 */
export default async function InviteLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ fel?: string }>;
}) {
  const { token } = await params;
  const { fel } = await searchParams;

  // Asked together. `isSignedIn` is only needed further down, for a link that
  // resolves, but it verifies the token locally now rather than asking the auth
  // server — so paying for it on a dead link costs less than the round trip
  // that waiting for the preview first used to add to every live one.
  const [preview, signedIn] = await Promise.all([
    isPlausibleToken(token)
      ? getInvitePreview(hashInviteToken(token))
      : Promise.resolve({ status: "missing" } as const),
    isSignedIn(),
  ]);

  if (preview.status !== "ok") {
    return (
      <Frame>
        <h1 className="font-serif text-[26px] leading-[1.15] font-semibold lg:text-[30px]">
          {SHARE.linkDead.title}
        </h1>
        <p className="prose-copy m-0 text-base/[1.55] text-ink-secondary">
          {SHARE.linkDead[preview.status]}
        </p>
        <Link href="/" className="text-[15px] font-semibold text-accent">
          {SHARE.acceptDecline}
        </Link>
      </Frame>
    );
  }

  const role = sharedRole(preview.role);
  const pronoun = preview.childSex === "female" ? "hon" : "han";

  if (preview.alreadyMember) {
    return (
      <Frame>
        <h1 className="font-serif text-[26px] leading-[1.15] font-semibold lg:text-[30px]">
          {SHARE.acceptAlreadyMember(preview.childName)}
        </h1>
        <Link
          href={`/barn/${preview.childId}`}
          className="flex min-h-13 items-center justify-center rounded-[12px] bg-accent px-6 text-base font-semibold text-white"
        >
          {SHARE.acceptOpenChild}
        </Link>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-serif text-[30px] leading-[1.15] font-semibold tracking-[-0.01em] lg:text-[32px]">
          {SHARE.acceptTitle(preview.invitedBy, preview.childName)}
        </h1>
        <p className="prose-copy m-0 text-base/[1.55] text-ink-secondary lg:text-[16px]/[1.6]">
          {SHARE.acceptBody(preview.childName, pronoun)}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 rounded-[14px] border border-border bg-surface p-4 lg:p-5">
        <span className="text-[13px] text-ink-muted">{SHARE.acceptRoleLabel}</span>
        <span className="text-[18px] font-semibold lg:text-[19px]">{SHARE.roleName[role]}</span>
        <span className="text-sm/[1.5] text-ink-secondary lg:text-[15px]">
          {SHARE.roleSummary[role]}
        </span>
      </div>

      {role === "guardian" ? (
        <p className="prose-copy m-0 text-sm/[1.5] text-ink-secondary lg:text-[15px]/[1.55]">
          {SHARE.acceptPermanent(preview.invitedBy)}
        </p>
      ) : null}

      {fel ? <p className="m-0 text-sm text-error">{SHARE.linkDead.failed}</p> : null}

      <div className="mt-auto flex flex-col gap-2.5 lg:mt-0 lg:flex-row lg:items-center">
        {signedIn ? (
          <form action={acceptInviteAction} className="flex flex-col">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="min-h-14 cursor-pointer rounded-[14px] bg-accent px-7 text-[17px] font-semibold text-white"
            >
              {SHARE.acceptJoin}
            </button>
          </form>
        ) : (
          <Link
            href={`/logga-in?retur=${encodeURIComponent(`/i/${token}`)}`}
            className="flex min-h-14 items-center justify-center rounded-[14px] bg-accent px-7 text-[17px] font-semibold text-white"
          >
            {SHARE.acceptSignIn}
          </Link>
        )}
        <Link
          href="/"
          className="flex min-h-12 items-center justify-center px-4 text-[15px] font-semibold text-ink-muted"
        >
          {SHARE.acceptDecline}
        </Link>
      </div>

      <p className="prose-copy m-0 text-[13px]/[1.5] text-ink-muted lg:text-sm/[1.55]">
        {SHARE.acceptFootnote}
      </p>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-5.5 px-6 pt-9 pb-10 lg:my-10">
      <BrandMark size={44} />
      {children}
    </div>
  );
}
