import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MeasurementForm } from "@/components/measurement-form";
import { getChild, getMyRole } from "@/lib/db";
import { ageDays } from "@/lib/child-data";
import { canEdit } from "@/lib/access";
import { MEASUREMENT_FORM } from "@/lib/copy";
import { formatAge, todayIso } from "@/lib/format";

export default async function NewMeasurementPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ retur?: string }>;
}) {
  const { childId } = await params;
  const { retur } = await searchParams;
  const [child, myRole] = await Promise.all([getChild(childId), getMyRole(childId)]);
  if (!child) notFound();
  // The database refuses the insert for a view-only user; this is so the form
  // is never shown to someone who would only be told "no" after typing.
  if (!canEdit(myRole)) redirect(`/barn/${childId}`);
  const today = todayIso();
  // Adding from the history page should land back on it, so a parent filling in
  // several measurements from the BVC card stays where the list is.
  const back =
    retur === "matningar" ? `/barn/${child.id}/matningar` : `/barn/${child.id}`;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4.5 px-4 py-4 pb-10">
      <Link
        href={back}
        className="flex min-h-11 items-center self-start text-[15px] font-semibold text-accent"
      >
        ← {MEASUREMENT_FORM.cancel}
      </Link>
      <h1 className="font-serif text-[26px] font-semibold lg:text-[30px]">
        {MEASUREMENT_FORM.newTitle}
      </h1>
      <MeasurementForm
        childId={child.id}
        childName={child.name}
        childAgeText={formatAge(ageDays(child, today))}
        today={today}
        returnTo={back}
        backHref={back}
      />
    </div>
  );
}
