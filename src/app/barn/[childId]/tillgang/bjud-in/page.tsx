import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { InviteScreen } from "@/components/invite-screen";
import { getChild, getMyRole } from "@/lib/db";
import { canManageAccess } from "@/lib/access";
import { NAV, SHARE } from "@/lib/copy";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const [child, myRole] = await Promise.all([getChild(childId), getMyRole(childId)]);
  if (!child) notFound();
  // Only a co-manager may share. The database refuses to create the invite
  // either way; this is so a view-only user is never shown a form that would
  // fail.
  if (!canManageAccess(myRole)) redirect(`/barn/${child.id}/tillgang`);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-4 pb-10 lg:gap-5 lg:px-8 lg:py-7">
      <Link
        href={`/barn/${child.id}/tillgang`}
        className="flex min-h-11 items-center self-start text-[15px] font-semibold text-accent"
      >
        ← {NAV.access}
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[26px] leading-[1.2] font-semibold lg:text-[30px]">
          {SHARE.inviteTitle(child.name)}
        </h1>
        <p className="prose-copy m-0 text-[15px]/[1.5] text-ink-secondary lg:text-base/[1.55]">
          {SHARE.inviteIntro}
        </p>
      </div>

      <InviteScreen childId={child.id} childName={child.name} />
    </div>
  );
}
