import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MeasurementForm } from "@/components/measurement-form";
import { getChild, getMeasurement, getMyRole } from "@/lib/db";
import { ageDays } from "@/lib/child-data";
import { canEdit } from "@/lib/access";
import { MEASUREMENT_FORM } from "@/lib/copy";
import { formatAge, todayIso } from "@/lib/format";

export default async function EditMeasurementPage({
  params,
}: {
  params: Promise<{ childId: string; measurementId: string }>;
}) {
  const { childId, measurementId } = await params;
  const [child, measurement, myRole] = await Promise.all([
    getChild(childId),
    getMeasurement(measurementId),
    getMyRole(childId),
  ]);
  if (!child || !measurement || measurement.childId !== child.id) notFound();
  if (!canEdit(myRole)) redirect(`/barn/${childId}/matningar`);
  const today = todayIso();
  const history = `/barn/${child.id}/matningar`;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4.5 px-4 py-4 pb-10">
      <Link
        href={history}
        className="flex min-h-11 items-center self-start text-[15px] font-semibold text-accent"
      >
        ← {MEASUREMENT_FORM.cancel}
      </Link>
      <h1 className="font-serif text-[26px] font-semibold lg:text-[30px]">
        {MEASUREMENT_FORM.editTitle}
      </h1>
      <MeasurementForm
        childId={child.id}
        childName={child.name}
        childAgeText={formatAge(ageDays(child, today))}
        today={today}
        measurement={measurement}
        returnTo={history}
        backHref={history}
      />
    </div>
  );
}
