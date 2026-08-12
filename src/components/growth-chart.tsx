"use client";

import * as React from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { CHART, PROJECTION } from "@/lib/copy";
import { MEASURE_CONFIG } from "@/lib/measures";
import { formatNumber } from "@/lib/format";
import {
  AGE_MAX_MONTHS,
  sampleAges,
  sampleSdCurve,
  type Measure,
  type Projection,
  type Sex,
} from "@/lib/growth";
import type { CurvePoint } from "@/lib/child-data";

export type ZoomRange = 3 | 12 | 24;

/**
 * The official paper chart gives roughly a third of its width to the first
 * three months, which is clinically right and has to be preserved. A
 * piecewise-linear scale does that, but its slope jumps at every segment
 * border, which puts a visible kink into all seven reference curves and into
 * the child's own line at 3 and 12 months — a break the printed sheet does not
 * have. So the compression is continuous instead.
 *
 * k = 2.5 reproduces the printed sheet's proportions (≈0.33 / 0.41 / 0.26 of
 * the width for 0–3 / 3–12 / 12–24 months) while being C1-continuous
 * everywhere, so the curves keep their slope end to end. Zooming re-normalises
 * within the same function, so the compression is identical at every zoom
 * level.
 *
 * Exported for the tests that assert the continuity and the proportions.
 */
export const AGE_COMPRESSION_K = 2.5;

export function normalisedAge(months: number): number {
  return (
    Math.log(1 + Math.max(0, months) / AGE_COMPRESSION_K) /
    Math.log(1 + AGE_MAX_MONTHS / AGE_COMPRESSION_K)
  );
}

const SD_LEVELS = [-3, -2, -1, 0, 1, 2, 3] as const;

/**
 * Seven curves, told apart without colour: band shading and stroke width and
 * dash pattern and an edge label. The chart has to survive greyscale.
 */
const SD_STYLE: Record<number, { dash?: string; width: number; label: string }> = {
  [-3]: { dash: "1,3", width: 1, label: "−3" },
  [-2]: { width: 1, label: "−2" },
  [-1]: { dash: "4,3", width: 1.2, label: "−1" },
  0: { width: 1.7, label: "M" },
  1: { dash: "4,3", width: 1.2, label: "+1" },
  2: { width: 1, label: "+2" },
  3: { dash: "1,3", width: 1, label: "+3" },
};

const SAMPLE_COUNT = 91;

/**
 * The dash that marks the projection as provisional. It has to be visibly
 * longer than every grey dash on the chart (`4,3` and `1,3`), because the ink
 * and the weight are the child's own and only the rhythm tells them apart.
 */
const PROJECTION_DASH = "9,7";

/**
 * Below this drawn width the endpoint marker and its label are suppressed. Two
 * or three weeks since the last visit is the normal state of this app, which
 * makes a very short line the default case — at that length the hollow endpoint
 * circle and the filled measured dot overlap into one smudge. Dashes alone read
 * fine.
 */
const PROJECTION_MARKER_MIN_PX = 14;
const PROJECTION_MARKER_MIN_PX_MINI = 9;

export type GrowthChartProps = {
  sex: Sex;
  measure: Measure;
  points: CurvePoint[];
  zoom: ZoomRange;
  width: number;
  height: number;
  /** Mini charts are previews: smaller dots, sparser labels, no interaction. */
  mini?: boolean;
  childName: string;
  selectedId?: string | null;
  onSelect?: (point: CurvePoint) => void;
  /**
   * The opt-in continuation to today's age. Only ever passed on the detail
   * curve view — never on the home screen's previews, where nobody asked for it.
   */
  projection?: Projection | null;
};

export function GrowthChart({
  sex,
  measure,
  points,
  zoom,
  width,
  height,
  mini = false,
  childName,
  selectedId = null,
  onSelect,
  projection = null,
}: GrowthChartProps) {
  const config = MEASURE_CONFIG[measure];
  const domainFrom = 0;
  const domainTo = zoom;

  const padLeft = mini ? 26 : 34;
  const padRight = mini ? 12 : 26;
  const padTop = mini ? 8 : 12;
  const padBottom = mini ? 16 : 22;

  const ages = React.useMemo(
    () => sampleAges(domainFrom, domainTo, SAMPLE_COUNT),
    [domainFrom, domainTo],
  );

  const curves = React.useMemo(() => {
    const out: Record<number, number[]> = {};
    for (const z of SD_LEVELS) out[z] = sampleSdCurve(sex, measure, z, ages);
    return out;
  }, [sex, measure, ages]);

  const visiblePoints = React.useMemo(
    () =>
      points.filter(
        (point) => point.ageMonths >= domainFrom - 0.01 && point.ageMonths <= domainTo + 0.5,
      ),
    [points, domainFrom, domainTo],
  );

  const x = React.useMemo(() => {
    const from = normalisedAge(domainFrom);
    const to = normalisedAge(domainTo);
    return (months: number) => {
      const clamped = Math.max(domainFrom, Math.min(domainTo, months));
      return (
        padLeft +
        ((width - padRight - padLeft) * (normalisedAge(clamped) - from)) / (to - from)
      );
    };
  }, [domainFrom, domainTo, padLeft, padRight, width]);

  const projected = projection?.drawn ? projection : null;

  // The domain is the ±3 SD envelope over the visible ages, widened to hold the
  // child's own points, padded 4%. It holds the projection too, so turning the
  // toggle on can rescale the axis — clipping the projection at the old extent
  // would be worse.
  let low = Math.min(...curves[-3]);
  let high = Math.max(...curves[3]);
  for (const point of visiblePoints) {
    low = Math.min(low, point.value);
    high = Math.max(high, point.value);
  }
  for (const point of projected?.points ?? []) {
    low = Math.min(low, point.value);
    high = Math.max(high, point.value);
  }
  const pad = (high - low) * 0.04;
  low -= pad;
  high += pad;

  const y = React.useMemo(() => {
    // Weight is logarithmic, which is what makes its SD bands visually uneven.
    // That is the truth of the data, not a rendering artefact.
    const scale = config.logScale
      ? scaleLog().domain([low, high]).range([height - padBottom, padTop])
      : scaleLinear().domain([low, high]).range([height - padBottom, padTop]);
    return (value: number) => scale(value);
  }, [config.logScale, low, high, height, padBottom, padTop]);

  const linePath = (values: number[]) =>
    ages
      .map((age, i) => `${i ? "L" : "M"}${x(age).toFixed(1)} ${y(values[i]).toFixed(1)}`)
      .join(" ");

  const bandPath = (lower: number, upper: number) => {
    const forward = linePath(curves[upper]);
    const back = ages
      .map((_, i) => {
        const index = ages.length - 1 - i;
        return `L${x(ages[index]).toFixed(1)} ${y(curves[lower][index]).toFixed(1)}`;
      })
      .join(" ");
    return `${forward} ${back} Z`;
  };

  const xTicks =
    domainTo === 3
      ? [0, 1, 2, 3]
      : domainTo === 12
        ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : [0, 1, 2, 3, 4, 5, 6, 9, 12, 15, 18, 21, 24];
  const narrow = width < 460;
  const showTick = (tick: number) => {
    if (mini) return tick === 0 || tick % (domainTo === 24 ? 6 : 3) === 0;
    if (narrow && domainTo === 12) return tick === 0 || tick % 2 === 0;
    if (narrow && domainTo === 24)
      return tick === 0 || tick === 2 || tick === 4 || tick === 6 || tick >= 9;
    return true;
  };

  const labelSize = mini ? 8 : 10;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      className="block overflow-visible"
      role="img"
      aria-label={`${config.label} mot referenskurvor för ${childName}`}
    >
      <path d={bandPath(-3, 3)} fill="var(--color-chart-band-3)" />
      <path d={bandPath(-2, 2)} fill="var(--color-chart-band-2)" />
      <path d={bandPath(-1, 1)} fill="var(--color-chart-band-1)" />

      {xTicks.map((tick) => (
        <g key={`x${tick}`}>
          <line
            x1={x(tick)}
            x2={x(tick)}
            y1={padTop}
            y2={height - padBottom}
            stroke="#FFFFFF"
            strokeWidth={0.8}
            opacity={0.85}
          />
          {showTick(tick) ? (
            <text
              x={x(tick)}
              y={height - padBottom + (mini ? 11 : 15)}
              textAnchor="middle"
              fontSize={labelSize}
              fill="var(--color-ink-muted)"
            >
              {tick === 0 ? "F" : tick}
            </text>
          ) : null}
        </g>
      ))}

      {config.yTicks.map((tick) => {
        if (tick < low || tick > high) return null;
        const ty = y(tick);
        // Keep gridlines clear of the unit label in the top-left corner.
        if (!mini && ty < padTop + 13) return null;
        return (
          <g key={`y${tick}`}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={ty}
              y2={ty}
              stroke="#FFFFFF"
              strokeWidth={0.8}
              opacity={0.7}
            />
            <text
              x={padLeft - 5}
              y={ty + 3}
              textAnchor="end"
              fontSize={labelSize}
              fill="var(--color-ink-muted)"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {SD_LEVELS.map((z) => {
        const style = SD_STYLE[z];
        return (
          <g key={`c${z}`}>
            <path
              d={linePath(curves[z])}
              fill="none"
              stroke={z === 0 ? "var(--color-chart-mean)" : "var(--color-chart-sd)"}
              strokeWidth={style.width}
              strokeDasharray={style.dash}
            />
            {!mini ? (
              <text
                x={width - padRight + 3}
                y={y(curves[z][curves[z].length - 1]) + 3}
                fontSize={9}
                fill="var(--color-ink-muted)"
              >
                {style.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* One point is a point. A line needs two. */}
      {visiblePoints.length > 1 ? (
        <path
          d={visiblePoints
            .map(
              (point, i) =>
                `${i ? "L" : "M"}${x(point.ageMonths).toFixed(1)} ${y(point.value).toFixed(1)}`,
            )
            .join(" ")}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={mini ? 1.8 : 2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}

      {/*
        The child's own ink, dashed. Not a lighter grey: an earlier pass drew it
        at 40 % opacity over the band fill, which landed on roughly #98928B —
        tonally identical to the SD reference lines, so a child sitting near
        −1 SD had a projection that read as a fourth reference curve.
      */}
      {projected ? (
        <ProjectionPath
          projection={projected}
          x={x}
          y={y}
          mini={mini}
          unit={config.unit}
          decimals={config.approxDecimals}
          rightEdge={width - padRight}
        />
      ) : null}

      {visiblePoints.map((point) => {
        const selected = selectedId === point.measurementId;
        return (
          <g key={point.measurementId}>
            <circle
              cx={x(point.ageMonths)}
              cy={y(point.value)}
              r={mini ? 2.4 : selected ? 6 : 4.2}
              fill={selected ? "#FFFFFF" : "var(--color-ink)"}
              stroke="var(--color-ink)"
              strokeWidth={selected ? 3 : 1.4}
            />
            {onSelect && !mini ? (
              // The dot is far below a touch target, so the hit area is not the
              // dot. It is focusable so the points are reachable by keyboard.
              <circle
                cx={x(point.ageMonths)}
                cy={y(point.value)}
                r={16}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`${config.label} ${point.value} ${config.unit}, ${point.measuredOn}`}
                className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => onSelect(point)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(point);
                  }
                }}
              />
            ) : null}
          </g>
        );
      })}

      {!mini ? (
        <text
          x={padLeft - 4}
          y={padTop + 2}
          textAnchor="end"
          fontSize={9}
          fill="var(--color-ink-muted)"
        >
          {config.unit}
        </text>
      ) : null}
    </svg>
  );
}

function ProjectionPath({
  projection,
  x,
  y,
  mini,
  unit,
  decimals,
  rightEdge,
}: {
  projection: Extract<Projection, { drawn: true }>;
  x: (months: number) => number;
  y: (value: number) => number;
  mini: boolean;
  unit: string;
  decimals: number;
  /** Where the plot ends. Past it live the ±SD edge labels, which the value must not sit on. */
  rightEdge: number;
}) {
  const path = projection.points
    .map(
      (point, i) =>
        `${i ? "L" : "M"}${x(point.ageMonths).toFixed(1)} ${y(point.value).toFixed(1)}`,
    )
    .join(" ");
  const endX = x(projection.to.ageMonths);
  const endY = y(projection.to.value);
  const spanPx = endX - x(projection.from.ageMonths);
  const showMarker =
    spanPx > (mini ? PROJECTION_MARKER_MIN_PX_MINI : PROJECTION_MARKER_MIN_PX);

  const label = `≈ ${formatNumber(projection.to.value, decimals)} ${unit}`;
  // The endpoint is today's age, which on a tight zoom sits right at the plot's
  // edge. Rather than let the value run into the SD edge labels, it swaps to the
  // other side of the endpoint — still clear of the measured point, which is
  // always to its left.
  const labelWidth = 8 + label.length * 6;
  const labelFits = endX + labelWidth <= rightEdge;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={mini ? 1.8 : 2.4}
        strokeDasharray={PROJECTION_DASH}
        strokeLinecap="round"
        opacity={0.8}
      />
      {showMarker ? (
        <>
          <circle
            cx={endX}
            cy={endY}
            r={mini ? 2.4 : 4.2}
            fill="var(--color-bg)"
            stroke="var(--color-ink)"
            strokeWidth={1.8}
            opacity={0.85}
          />
          {!mini ? (
            <text
              x={labelFits ? endX + 7 : endX - 7}
              y={endY - 7}
              textAnchor={labelFits ? "start" : "end"}
              fontSize={11}
              fontWeight={600}
              fill="var(--color-ink-secondary)"
            >
              {label}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

export function ChartLegend({
  childName,
  showProjection = false,
}: {
  childName: string;
  /** Only when a projection is actually drawn — never merely when the toggle is on. */
  showProjection?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3 px-1">
      <span className="w-full text-xs text-ink-muted">{CHART.axisCaption}</span>
      <LegendItem label={childName}>
        <span className="block h-0 w-[22px] border-t-[2.5px] border-solid border-ink" />
      </LegendItem>
      {showProjection ? (
        <LegendItem label={PROJECTION.legend}>
          <span className="block h-0 w-[22px] border-t-[2.5px] border-dashed border-ink opacity-80" />
        </LegendItem>
      ) : null}
      <LegendItem label={CHART.legendMean}>
        <span className="block h-0 w-[22px] border-t-[1.5px] border-solid border-chart-mean" />
      </LegendItem>
      <LegendItem label={CHART.legendOne}>
        <span className="block h-0 w-[22px] border-t-[1.5px] border-dashed border-chart-sd" />
      </LegendItem>
      <LegendItem label={CHART.legendTwoThree}>
        <span className="block h-0 w-[22px] border-t-[1.5px] border-dotted border-chart-sd" />
      </LegendItem>
    </div>
  );
}

function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
      {children}
      {label}
    </span>
  );
}
