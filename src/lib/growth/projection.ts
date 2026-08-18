/**
 * "Visa fortsättning" — the opt-in dashed continuation of the child's own line.
 *
 * The rule is to hold the latest SDS constant and read the reference forward,
 * from the latest measurement to the child's age today, and no
 * further. It fills the gap between the last BVC visit and now.
 *
 * It is deliberately *not* a trend fit, and must not become one. Extrapolating a
 * slope from two BVC visits turns ordinary measurement noise into a frightening
 * number — a 100 g weighing difference over three weeks projects to kilos by age
 * two. Constant SDS is the same assumption a nurse makes out loud ("om hon
 * fortsätter i sin kanal"), and it is honest about being an assumption.
 *
 * It also never runs to the end of the visible interval: looking at the 0–2 år
 * view does not make the app project to 24 months. The zoom only ever clips the
 * line short, it never extends it.
 *
 * Pure, like everything else under `lib/growth`: today's age is passed in, never
 * read from the clock here.
 */

import { valueAtSds } from "./sds";
import { AGE_MAX_MONTHS } from "./reference";
import type { Measure, Ranged, Sex } from "./types";

export type ProjectionPoint = {
  /** Age in months since birth. */
  ageMonths: number;
  /** kg for weight, cm for length and head. */
  value: number;
};

/** Why there is no line to draw. Each one has its own sentence in `copy.ts`. */
export type ProjectionUnavailable =
  /** Nothing on the curve to count forward from. */
  | "no-measurement"
  /** Today's age is past the visible interval, so the line would be off-screen. */
  | "today-past-interval"
  /** The child is older than the reference's 24 months; there is no longer interval to pick. */
  | "today-past-reference"
  /** The latest measurement is essentially today — no time in between to count over. */
  | "already-current";

export type Projection =
  | { drawn: false; reason: ProjectionUnavailable }
  | {
      drawn: true;
      /** The SDS held constant across the line — the latest measurement's own. */
      sds: number;
      from: ProjectionPoint;
      /** Where the line ends: the child's age today. */
      to: ProjectionPoint;
      /** The whole line, sampled for drawing. It curves; it is a reference curve. */
      points: ProjectionPoint[];
    };

/**
 * The projection is a reference curve rather than a straight line, so it is
 * sampled rather than drawn as a segment.
 */
const SAMPLE_COUNT = 49;

/**
 * Shorter than this and there is nothing to say: a couple of days of reference
 * curve is not a continuation, it is the same point drawn twice.
 */
export const PROJECTION_MIN_MONTHS = 0.1;

export type ProjectionInput = {
  sex: Sex;
  measure: Measure;
  /** The most recent plotted point for this measure, or null if there is none. */
  latest: { ageMonths: number; sds: number } | null;
  /** The child's age today, which is where the line stops. */
  todayAgeMonths: Ranged<number>;
  /** The visible interval's end, in months. The zoom clips the line, never extends it. */
  visibleToMonths: number;
};

export function projectForward({
  sex,
  measure,
  latest,
  todayAgeMonths,
  visibleToMonths,
}: ProjectionInput): Projection {
  if (!latest) return { drawn: false, reason: "no-measurement" };

  if (!todayAgeMonths.ok) {
    // A child with a plotted point was born at 37+0 or later and is past 0
    // months old, so the only reason today's age can fall outside the reference
    // is that the child has passed 24 months.
    if (todayAgeMonths.reason === "age-after-range") {
      return { drawn: false, reason: "today-past-reference" };
    }
    return { drawn: false, reason: "no-measurement" };
  }

  const today = todayAgeMonths.value;
  if (today > visibleToMonths + PROJECTION_MIN_MONTHS) {
    return { drawn: false, reason: "today-past-interval" };
  }

  const end = Math.min(today, visibleToMonths, AGE_MAX_MONTHS);
  if (latest.ageMonths >= end - PROJECTION_MIN_MONTHS) {
    return { drawn: false, reason: "already-current" };
  }

  const points: ProjectionPoint[] = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const ageMonths = latest.ageMonths + ((end - latest.ageMonths) * i) / (SAMPLE_COUNT - 1);
    const value = valueAtSds(sex, measure, ageMonths, latest.sds);
    if (!value.ok) {
      throw new Error(
        `projectForward: age ${ageMonths} is outside the reference (${value.reason})`,
      );
    }
    points.push({ ageMonths, value: value.value });
  }

  return {
    drawn: true,
    sds: latest.sds,
    from: points[0],
    to: points[points.length - 1],
    points,
  };
}
