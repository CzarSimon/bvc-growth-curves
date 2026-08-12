import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMeasurementAction } from "@/app/actions";
import { getChild, listMeasurements } from "@/lib/db";
import { ageDays, measurementValue, sortByDate } from "@/lib/child-data";
import { CHILD_FORM, HISTORY } from "@/lib/copy";
import { formatAge, formatDate, formatNumber } from "@/lib/format";
import { MEASURE_CONFIG, MEASURE_ORDER } from "@/lib/measures";
import type { Child, Measurement } from "@/lib/child-data";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const child = await getChild(childId);
  if (!child) notFound();
  const measurements = sortByDate(await listMeasurements(childId)).reverse();
  const history = `/barn/${child.id}/matningar`;
  const addHref = `${history}/ny?retur=matningar`;

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3.5 px-4 py-4 lg:gap-4 lg:px-8 lg:py-7">
      <Link
        href={`/barn/${child.id}`}
        className="flex min-h-11 items-center self-start text-[15px] font-semibold text-accent lg:hidden"
      >
        ← {child.name}
      </Link>
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-serif text-2xl font-semibold lg:text-[30px]">{HISTORY.title}</h1>
        {/* On mobile the app shell already carries the add button; on desktop it
            belongs here, next to the list it adds to. */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href={`/barn/${child.id}/andra`}
            className="flex min-h-11 items-center text-sm font-semibold text-accent"
          >
            {CHILD_FORM.editTitle}
          </Link>
          <Link
            href={addHref}
            className="flex min-h-12 items-center rounded-[10px] bg-accent px-5 text-base font-semibold text-white"
          >
            {HISTORY.add}
          </Link>
        </div>
      </div>

      {measurements.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[14px] border border-dashed border-border-strong bg-surface p-5.5">
          <p className="prose-copy m-0 text-base/[1.5] text-ink-secondary">{HISTORY.empty}</p>
          <Link
            href={addHref}
            className="flex min-h-12 items-center rounded-[10px] bg-accent px-4.5 text-base font-semibold text-white"
          >
            {HISTORY.add}
          </Link>
        </div>
      ) : null}

      {/* Mobile: one card per measurement. */}
      <div className="flex flex-col gap-3.5 lg:hidden">
        {measurements.map((measurement) => (
          <div
            key={measurement.id}
            className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-surface px-4 py-3.5"
          >
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="text-base font-semibold">
                {formatDate(measurement.measuredOn)}
              </span>
              <span className="text-[13px] text-ink-muted">
                {formatAge(ageDays(child, measurement.measuredOn))}
              </span>
            </div>
            <div className="nums flex flex-wrap gap-4.5">
              {MEASURE_ORDER.map((measure) => (
                <span key={measure} className="text-[15px] text-ink-secondary">
                  {valueText(measurement, measure)}
                </span>
              ))}
            </div>
            <div className="flex gap-1.5 border-t border-hairline pt-2">
              <RowActions child={child} measurement={measurement} returnTo={history} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: a table. */}
      {measurements.length > 0 ? (
        <div className="hidden overflow-hidden rounded-[14px] border border-border bg-surface lg:block">
          <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_0.9fr] gap-2.5 border-b border-border bg-surface-sunken px-4.5 py-3 text-xs tracking-[0.05em] text-ink-muted uppercase">
            <span>{HISTORY.columns.date}</span>
            <span>{HISTORY.columns.age}</span>
            {MEASURE_ORDER.map((measure) => (
              <span key={measure}>{MEASURE_CONFIG[measure].label}</span>
            ))}
            <span />
          </div>
          {measurements.map((measurement) => (
            <div
              key={measurement.id}
              className="nums grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_0.9fr] items-center gap-2.5 border-b border-hairline px-4.5 py-3 text-[15px]"
            >
              <span className="font-semibold">{formatDate(measurement.measuredOn)}</span>
              <span className="text-ink-muted">
                {formatAge(ageDays(child, measurement.measuredOn))}
              </span>
              {MEASURE_ORDER.map((measure) => (
                <span key={measure}>{valueText(measurement, measure)}</span>
              ))}
              <span className="flex justify-end gap-1">
                <RowActions child={child} measurement={measurement} returnTo={history} />
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <Link
        href={`/barn/${child.id}/andra`}
        className="flex min-h-11 items-center self-start text-sm font-semibold text-accent lg:hidden"
      >
        {CHILD_FORM.editTitle}
      </Link>
    </div>
  );
}

function valueText(measurement: Measurement, measure: (typeof MEASURE_ORDER)[number]) {
  const config = MEASURE_CONFIG[measure];
  const value = measurementValue(measurement, measure);
  return value === null ? "—" : `${formatNumber(value, config.decimals)} ${config.unit}`;
}

/** Correcting a typo is a common, low-stakes task and should feel like one. */
function RowActions({
  child,
  measurement,
  returnTo,
}: {
  child: Child;
  measurement: Measurement;
  returnTo: string;
}) {
  return (
    <>
      <Link
        href={`/barn/${child.id}/matningar/${measurement.id}`}
        className="flex min-h-11 items-center px-3 text-sm font-semibold text-accent"
      >
        {HISTORY.edit}
      </Link>
      <form action={deleteMeasurementAction}>
        <input type="hidden" name="childId" value={child.id} />
        <input type="hidden" name="measurementId" value={measurement.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          className="min-h-11 cursor-pointer px-3 text-sm font-semibold text-ink-muted hover:text-ink-secondary"
        >
          {HISTORY.remove}
        </button>
      </form>
    </>
  );
}
