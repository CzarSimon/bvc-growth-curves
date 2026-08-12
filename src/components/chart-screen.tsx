"use client";

import * as React from "react";
import Link from "next/link";
import { ChartLegend, GrowthChart, type ZoomRange } from "./growth-chart";
import { Pill, PillGroup, Segmented, SegmentedItem } from "./ui/segmented";
import { CHART, OUT_OF_RANGE, sdPhrase } from "@/lib/copy";
import { formatAge, formatDate, formatNumber } from "@/lib/format";
import { MEASURE_CONFIG, MEASURE_ORDER } from "@/lib/measures";
import type { Measure, OutOfRangeReason, Sex } from "@/lib/growth";
import type { CurvePoint } from "@/lib/child-data";

export type ChartScreenData = {
  childId: string;
  childName: string;
  childMeta: string;
  sex: Sex;
  birthDate: string;
  footnote: string;
  series: Record<Measure, CurvePoint[]>;
  /** Recorded values that fall outside the reference, by measure and reason. */
  notPlotted: Record<Measure, Partial<Record<OutOfRangeReason, number>>>;
  /** Days between birth and each measurement date, for the detail card. */
  ageDaysByMeasurement: Record<string, number>;
};

const ZOOMS: Array<{ value: ZoomRange; label: string }> = [
  { value: 3, label: CHART.zoom.three },
  { value: 12, label: CHART.zoom.twelve },
  { value: 24, label: CHART.zoom.twentyFour },
];

export function ChartScreen({
  data,
  initialMeasure,
}: {
  data: ChartScreenData;
  initialMeasure: Measure;
}) {
  const [measure, setMeasure] = React.useState<Measure>(initialMeasure);
  const [zoom, setZoom] = React.useState<ZoomRange>(12);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const isDesktop = useIsDesktop();

  // Selection is cleared whenever the measure changes; a point on the weight
  // curve means nothing on the length curve.
  const changeMeasure = (next: Measure) => {
    setMeasure(next);
    setSelectedId(null);
  };

  const points = data.series[measure];
  const selected = points.find((point) => point.measurementId === selectedId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3.5 px-4 py-4 lg:gap-4 lg:px-8 lg:py-7">
      <Link
        href={`/barn/${data.childId}`}
        className="flex min-h-11 items-center self-start text-[15px] font-semibold text-accent lg:hidden"
      >
        ← {data.childName}
      </Link>

      <div className="hidden items-end justify-between gap-5 lg:flex">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[30px] font-semibold">
            {MEASURE_CONFIG[measure].chartTitle}
          </h1>
          <span className="text-[15px] text-ink-muted">
            {data.childName} · {data.childMeta}
          </span>
        </div>
        <ZoomPills zoom={zoom} onChange={setZoom} />
      </div>

      <div>
        <Segmented
          type="single"
          value={measure}
          onValueChange={(value) => {
            if (value) changeMeasure(value as Measure);
          }}
          aria-label="Välj mått"
          className="lg:hidden"
        >
          {MEASURE_ORDER.map((key) => (
            <SegmentedItem key={key} value={key}>
              {MEASURE_CONFIG[key].label}
            </SegmentedItem>
          ))}
        </Segmented>

        <div className="pt-3.5 lg:hidden">
          <ZoomPills zoom={zoom} onChange={setZoom} />
        </div>

        <div className="flex flex-col gap-3.5 pt-3.5 lg:gap-4 lg:pt-0">
          <div className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-surface px-2.5 pt-3 pb-2.5 lg:p-4">
            <Segmented
              type="single"
              value={measure}
              onValueChange={(value) => {
                if (value) changeMeasure(value as Measure);
              }}
              aria-label="Välj mått"
              className="hidden self-start lg:flex"
            >
              {MEASURE_ORDER.map((key) => (
                <SegmentedItem key={key} value={key} className="flex-none px-4">
                  {MEASURE_CONFIG[key].label}
                </SegmentedItem>
              ))}
            </Segmented>

            <GrowthChart
              sex={data.sex}
              measure={measure}
              points={points}
              zoom={zoom}
              width={isDesktop ? 1000 : 344}
              height={isDesktop ? 440 : 300}
              childName={data.childName}
              selectedId={selectedId}
              onSelect={(point) => setSelectedId(point.measurementId)}
            />
            <ChartLegend childName={data.childName} />
            {points.length === 0 ? (
              <p className="prose-copy px-1 text-[13px]/[1.5] text-ink-muted">
                {CHART.emptyForMeasure(MEASURE_CONFIG[measure].label)}
              </p>
            ) : null}
            {Object.entries(data.notPlotted[measure]).map(([reason, count]) => (
              <p key={reason} className="prose-copy px-1 text-[13px]/[1.5] text-ink-muted">
                {CHART.notPlotted(count, OUT_OF_RANGE[reason as OutOfRangeReason])}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-3.5">
            {selected ? (
              <SelectedCard
                point={selected}
                measure={measure}
                ageDays={data.ageDaysByMeasurement[selected.measurementId] ?? 0}
                onClear={() => setSelectedId(null)}
              />
            ) : null}

            <p className="prose-copy m-0 text-[13px]/[1.55] text-ink-muted">{data.footnote}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoomPills({
  zoom,
  onChange,
}: {
  zoom: ZoomRange;
  onChange: (zoom: ZoomRange) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[13px] text-ink-muted">{CHART.show}</span>
      <PillGroup
        type="single"
        aria-label={CHART.show}
        value={String(zoom)}
        onValueChange={(value) => {
          if (value) onChange(Number(value) as ZoomRange);
        }}
      >
        {ZOOMS.map((option) => (
          <Pill key={option.value} value={String(option.value)}>
            {option.label}
          </Pill>
        ))}
      </PillGroup>
    </div>
  );
}

function SelectedCard({
  point,
  measure,
  ageDays,
  onClear,
}: {
  point: CurvePoint;
  measure: Measure;
  ageDays: number;
  onClear: () => void;
}) {
  const config = MEASURE_CONFIG[measure];
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-border-strong bg-surface p-4 lg:max-w-sm">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="nums text-[22px] font-semibold">
            {formatNumber(point.value, config.decimals)} {config.unit}
          </span>
          <span className="text-sm text-ink-secondary">
            {formatDate(point.measuredOn)} · {formatAge(ageDays)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Stäng"
          className="min-h-11 min-w-11 cursor-pointer text-xl text-ink-muted"
        >
          ×
        </button>
      </div>
      <span className="text-sm text-ink-secondary">{sdPhrase(point.sds)}</span>
    </div>
  );
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
