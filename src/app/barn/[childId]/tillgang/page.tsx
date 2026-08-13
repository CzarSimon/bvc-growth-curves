import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessCard } from "@/components/access-card";
import { getChild, getMyRole, listChildAccess } from "@/lib/db";
import { canManageAccess } from "@/lib/access";
import { NAV, SHARE } from "@/lib/copy";

/**
 * Vem har tillgång — the list of everyone who can see this child.
 *
 * Everyone with access sees this screen, including view-only users: knowing who
 * else is reading a child's measurements is not a privilege of the people who
 * can edit them. What a view-only user does not get is the invite button or any
 * remove control.
 *
 * On desktop the list is a card grid rather than a full-width stack — a
 * household is two to four people, and a single column on a wide screen is
 * mostly empty space.
 */
export default async function AccessPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const [child, myRole, access] = await Promise.all([
    getChild(childId),
    getMyRole(childId),
    listChildAccess(childId),
  ]);
  if (!child) notFound();

  const canInvite = canManageAccess(myRole);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-4 pb-10 lg:gap-5 lg:px-8 lg:py-7">
      <Link
        href={`/barn/${child.id}`}
        className="flex min-h-11 items-center self-start text-[15px] font-semibold text-accent lg:hidden"
      >
        ← {NAV.back}
      </Link>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <div className="flex max-w-[560px] flex-col gap-1.5">
          <h1 className="font-serif text-[26px] leading-[1.2] font-semibold lg:text-[30px]">
            {SHARE.title(child.name)}
          </h1>
          <p className="prose-copy m-0 text-[15px]/[1.5] text-ink-secondary lg:text-base/[1.55]">
            {SHARE.intro}
          </p>
        </div>
        {canInvite ? (
          <Link
            href={`/barn/${child.id}/tillgang/bjud-in`}
            className="hidden min-h-12 flex-none items-center rounded-[10px] bg-accent px-5 text-base font-semibold text-white lg:flex"
          >
            {SHARE.invite}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:items-start lg:gap-4">
        {access.map((member) => (
          <AccessCard
            key={member.userId}
            member={member}
            myRole={myRole}
            childId={child.id}
            childName={child.name}
          />
        ))}
      </div>

      {canInvite ? (
        <Link
          href={`/barn/${child.id}/tillgang/bjud-in`}
          className="flex min-h-13 items-center justify-center rounded-[12px] bg-accent px-5 text-base font-semibold text-white lg:hidden"
        >
          {SHARE.invite}
        </Link>
      ) : null}

      <p className="prose-copy m-0 max-w-[640px] text-[13px]/[1.5] text-ink-muted lg:text-sm/[1.55]">
        {SHARE.footnote}
      </p>
    </div>
  );
}
