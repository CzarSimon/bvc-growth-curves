import Link from "next/link";
import { notFound } from "next/navigation";
import { MeasurementForm } from "@/components/measurement-form";
import { getChild } from "@/lib/db";
import { ageDays } from "@/lib/child-data";
import { MEASUREMENT_FORM } from "@/lib/copy";
import { formatAge, todayIso } from "@/lib/format";

export default async function NewMeasurementPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const child = await getChild(childId);
  if (!child) notFound();
  const today = todayIso();

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4.5 px-4 py-4 pb-10">
      <Link
        href={`/barn/${child.id}`}
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
        returnTo={`/barn/${child.id}`}
        backHref={`/barn/${child.id}`}
      />
    </div>
  );
}
