/**
 * Putting a particular child's measurement on the reference.
 *
 * Everything here goes through the same two gates, in order:
 *   1. Was the child born at 37+0 or later?
 *   2. Is the age since birth inside the reference's 0–24 months?
 * Either gate can refuse, and refusing is a result the UI renders — never a
 * clamp, never a silent zero.
 */

import { ageMonths, isPreterm, gestationDays } from "./age";
import { AGE_MAX_MONTHS, AGE_MIN_MONTHS, referenceAt } from "./reference";
import { sdsFromReference, valueFromReference } from "./sds";
import {
  inRange,
  outOfRange,
  type Measure,
  type Ranged,
  type Sex,
} from "./types";

export type ChildRef = {
  sex: Sex;
  /** ISO calendar day, `YYYY-MM-DD`. */
  birthDate: string;
  gestationWeeks: number;
  gestationDays: number;
};

/** Age in months since birth, refusing preterm children and ages off the chart. */
export function plottableAgeMonths(child: ChildRef, onDate: string): Ranged<number> {
  if (isPreterm(child.gestationWeeks, child.gestationDays)) {
    return outOfRange("gestation-preterm", {
      gestationDays: gestationDays(child.gestationWeeks, child.gestationDays),
    });
  }
  const months = ageMonths(child.birthDate, onDate);
  if (months < AGE_MIN_MONTHS) return outOfRange("age-before-range", { ageMonths: months });
  if (months > AGE_MAX_MONTHS) return outOfRange("age-after-range", { ageMonths: months });
  return inRange(months);
}

export type PlottedValue = {
  /** Age in months since birth — the chart's x position. */
  ageMonths: number;
  /** The measured value in the measure's own unit (kg or cm) — the y position. */
  value: number;
  sds: number;
};

/**
 * Where a measured value sits for this child.
 * `value` is kg for weight, cm for length and head.
 */
export function plotMeasurement(
  child: ChildRef,
  measure: Measure,
  onDate: string,
  value: number,
): Ranged<PlottedValue> {
  const age = plottableAgeMonths(child, onDate);
  if (!age.ok) return age;
  const point = referenceAt(child.sex, measure, age.value);
  if (!point.ok) return point;
  return inRange({
    ageMonths: age.value,
    value,
    sds: sdsFromReference(point.value, value),
  });
}

/**
 * Sample one SD curve across an age range, for drawing.
 * Ages are clamped to the reference's domain by the caller choosing the range;
 * any age outside it throws rather than quietly producing a number.
 */
export function sampleSdCurve(
  sex: Sex,
  measure: Measure,
  z: number,
  ages: readonly number[],
): number[] {
  return ages.map((ageMonths) => {
    const point = referenceAt(sex, measure, ageMonths);
    if (!point.ok) {
      throw new Error(
        `sampleSdCurve: age ${ageMonths} is outside the reference (${point.reason})`,
      );
    }
    return valueFromReference(point.value, z);
  });
}

/** Evenly spaced ages across `[from, to]`, inclusive, for curve sampling. */
export function sampleAges(from: number, to: number, count: number): number[] {
  const ages: number[] = [];
  for (let i = 0; i < count; i++) {
    ages.push(from + ((to - from) * i) / (count - 1));
  }
  return ages;
}
