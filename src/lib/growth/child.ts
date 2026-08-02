/**
 * Putting a particular child's measurement on the reference.
 *
 * Everything here goes through the same two gates, in order:
 *   1. Is the child's gestational age at birth inside term (37+0 … 42+0)?
 *   2. Is the corrected age inside the reference's 0–24 months?
 * Either gate can refuse, and refusing is a result the UI renders — never a
 * clamp, never a silent zero.
 */

import { ageMonthsFromTerm, isTermGestation, gestationDays } from "./age";
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

/** Corrected age in months from term, refusing non-term children and ages off the chart. */
export function correctedAgeMonths(child: ChildRef, onDate: string): Ranged<number> {
  if (!isTermGestation(child.gestationWeeks, child.gestationDays)) {
    return outOfRange("gestation-not-term", {
      gestationDays: gestationDays(child.gestationWeeks, child.gestationDays),
    });
  }
  const months = ageMonthsFromTerm(
    child.birthDate,
    onDate,
    child.gestationWeeks,
    child.gestationDays,
  );
  if (months < AGE_MIN_MONTHS) return outOfRange("age-before-range", { ageMonths: months });
  if (months > AGE_MAX_MONTHS) return outOfRange("age-after-range", { ageMonths: months });
  return inRange(months);
}

export type PlottedValue = {
  /** Corrected age in months from term — the chart's x position. */
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
  const age = correctedAgeMonths(child, onDate);
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
