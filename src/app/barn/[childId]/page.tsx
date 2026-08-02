import Link from "next/link";
import { notFound } from "next/navigation";
import { GrowthChart } from "@/components/growth-chart";
import { AttentionCard, BvcCard } from "@/components/bvc-card";
import { getChild, listMeasurements } from "@/lib/db";
import {
  ageDays,
  latestMeasurement,
  measurementValue,
  seriesFor,
  correctedAge,
  type Child,
  type Measurement,
} from "@/lib/child-data";
import { buildReading } from "@/lib/reading";
import { CURVES_CARD, NAV, OUT_OF_RANGE_SHORT, READING, sdPhrase } from "@/lib/copy";
import { formatAge, formatDate, formatNumber, todayIso } from "@/lib/format";
import { MEASURE_CONFIG, MEASURE_ORDER } from "@/lib/measures";
import { plotMeasurement } from "@/lib/growth";
import { childRef } from "@/lib/child-data";
import type { Measure } from "@/lib/growth";

export default async function ChildHomePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const child = await getChild(childId);
  if (!child) notFound();
  const measurements = await listMeasurements(childId);

  const reading = buildReading(child, measurements);
  const latest = latestMeasurement(measurements);

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-3.5 px-4 py-4 lg:gap-5 lg:px-8 lg:py-7">
      <div className="hidden items-end justify-between gap-5 lg:flex">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[32px] font-semibold">{child.name}</h1>
          <span className="text-[15px] text-ink-muted">{childMeta(child)}</span>
        </div>
        <Link
          href={`/barn/${child.id}/matningar/ny`}
          className="flex min-h-12 items-center rounded-[10px] bg-accent px-5 text-base font-semibold text-white"
        >
          {NAV.addMeasurement}
        </Link>
      </div>

      <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-4">
        <div className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface p-[18px] lg:p-[22px]">
          <h2 className="font-serif text-xl font-semibold lg:text-[21px]">{reading.title}</h2>
          <p className="prose-copy m-0 text-base/[1.55] text-ink-secondary lg:leading-[1.6]">
            {reading.body}
          </p>

          {latest ? (
            <LatestValues child={child} latest={latest} />
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          {reading.attention ? <AttentionCard text={reading.attention} /> : null}
          <BvcCard />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-4 lg:hidden">
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold">{CURVES_CARD.title}</span>
          <span className="text-[13px]/[1.45] text-ink-muted">{CURVES_CARD.body}</span>
        </div>
        {MEASURE_ORDER.map((measure) => (
          <MiniChartLink key={measure} child={child} measurements={measurements} measure={measure} />
        ))}
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        {MEASURE_ORDER.map((measure) => (
          <MiniChartLink
            key={measure}
            child={child}
            measurements={measurements}
            measure={measure}
            card
          />
        ))}
      </div>
    </div>
  );
}

function childMeta(child: Child): string {
  const sex = child.sex === "female" ? "Flicka" : "Pojke";
  return `${sex} · ${formatAge(ageDays(child, todayIso()))} · född ${formatDate(child.birthDate)} i vecka ${child.gestationWeeks}+${child.gestationDays}`;
}

/**
 * The latest measurement, one full-width row per measure. A three-column grid
 * was tried and is too cramped at 390px.
 */
function LatestValues({ child, latest }: { child: Child; latest: Measurement }) {
  const age = correctedAge(child, latest.measuredOn);

  return (
    <div className="flex flex-col border-t border-hairline pt-2.5">
      <span className="pb-0.5 text-[13px] text-ink-muted">
        {READING.latestHeading} · {formatDate(latest.measuredOn)} ·{" "}
        {formatAge(ageDays(child, latest.measuredOn))}
      </span>
      {MEASURE_ORDER.map((measure, index) => {
        const config = MEASURE_CONFIG[measure];
        const value = measurementValue(latest, measure);
        const plotted =
          value === null
            ? null
            : plotMeasurement(childRef(child), measure, latest.measuredOn, value);
        return (
          <div
            key={measure}
            className={`flex flex-col gap-0.5 pt-2.5 pb-2 ${index < 2 ? "border-b border-hairline-soft" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] text-ink-secondary">{config.label}</span>
              <span className="nums text-[21px] font-semibold">
                {value === null
                  ? "—"
                  : `${formatNumber(value, config.decimals)} ${config.unit}`}
              </span>
            </div>
            <span className="text-[13px] text-ink-muted">
              {plotted === null
                ? ""
                : plotted.ok
                  ? sdPhrase(plotted.value.sds)
                  : OUT_OF_RANGE_SHORT[plotted.reason]}
            </span>
          </div>
        );
      })}
      {!age.ok ? (
        <span className="pt-1 text-[13px] text-ink-muted">
          {OUT_OF_RANGE_SHORT[age.reason]}
        </span>
      ) : null}
    </div>
  );
}

function MiniChartLink({
  child,
  measurements,
  measure,
  card = false,
}: {
  child: Child;
  measurements: Measurement[];
  measure: Measure;
  card?: boolean;
}) {
  const config = MEASURE_CONFIG[measure];
  const { points } = seriesFor(child, measurements, measure);
  return (
    <Link
      href={`/barn/${child.id}/kurvor?matt=${config.slug}`}
      className={
        card
          ? "flex cursor-pointer flex-col gap-2.5 rounded-[14px] border border-border bg-surface p-4 hover:border-border-strong"
          : "flex w-full cursor-pointer flex-col gap-2 rounded-[12px] border border-hairline px-3 pt-3 pb-2 hover:border-border-strong"
      }
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-[15px] font-semibold">{config.chartTitle}</span>
        <span className="text-sm font-semibold text-accent">{CURVES_CARD.open}</span>
      </div>
      <GrowthChart
        sex={child.sex}
        measure={measure}
        points={points}
        zoom={12}
        width={260}
        height={150}
        mini
        childName={child.name}
      />
    </Link>
  );
}
