/**
 * The app's view of a child and its measurements, and how those become points
 * on a curve. Everything numeric here delegates to `lib/growth`.
 */

import {
  plottableAgeMonths,
  daysBetween,
  plotMeasurement,
  type ChildRef,
  type Measure,
  type OutOfRangeReason,
  type Sex,
} from "./growth";

export type Child = {
  id: string;
  name: string;
  sex: Sex;
  /** ISO calendar day. */
  birthDate: string;
  gestationWeeks: number;
  gestationDays: number;
};

export type Measurement = {
  id: string;
  childId: string;
  /** The day the child was measured, not the day the row was written. */
  measuredOn: string;
  weightKg: number | null;
  lengthCm: number | null;
  headCm: number | null;
  /**
   * Who entered it, for "lagt in av Erik" in a shared child. Null for rows
   * written before attribution existed and for an account since deleted.
   */
  createdBy: string | null;
};

export type CurvePoint = {
  measurementId: string;
  measuredOn: string;
  /** Age in months since birth. */
  ageMonths: number;
  /** kg for weight, cm for length and head. */
  value: number;
  sds: number;
};

export type UnplottablePoint = {
  measurementId: string;
  measuredOn: string;
  value: number;
  reason: OutOfRangeReason;
};

export function childRef(child: Child): ChildRef {
  return {
    sex: child.sex,
    birthDate: child.birthDate,
    gestationWeeks: child.gestationWeeks,
    gestationDays: child.gestationDays,
  };
}

export function measurementValue(measurement: Measurement, measure: Measure): number | null {
  switch (measure) {
    case "weight":
      return measurement.weightKg;
    case "length":
      return measurement.lengthCm;
    case "head":
      return measurement.headCm;
  }
}

export function sortByDate(measurements: Measurement[]): Measurement[] {
  return [...measurements].sort((a, b) =>
    a.measuredOn === b.measuredOn ? a.id.localeCompare(b.id) : a.measuredOn < b.measuredOn ? -1 : 1,
  );
}

export type MeasureSeries = {
  points: CurvePoint[];
  /** Values that exist but cannot be placed on the reference. */
  unplottable: UnplottablePoint[];
};

/** Every recorded value for one measure, split into what can be plotted and what cannot. */
export function seriesFor(
  child: Child,
  measurements: Measurement[],
  measure: Measure,
): MeasureSeries {
  const ref = childRef(child);
  const points: CurvePoint[] = [];
  const unplottable: UnplottablePoint[] = [];

  for (const measurement of sortByDate(measurements)) {
    const value = measurementValue(measurement, measure);
    if (value === null) continue;
    const plotted = plotMeasurement(ref, measure, measurement.measuredOn, value);
    if (plotted.ok) {
      points.push({
        measurementId: measurement.id,
        measuredOn: measurement.measuredOn,
        ageMonths: plotted.value.ageMonths,
        value: plotted.value.value,
        sds: plotted.value.sds,
      });
    } else {
      unplottable.push({
        measurementId: measurement.id,
        measuredOn: measurement.measuredOn,
        value,
        reason: plotted.reason,
      });
    }
  }

  return { points, unplottable };
}

/** Chronological days lived on a given date. Negative before birth. */
export function ageDays(child: Child, onDate: string): number {
  return daysBetween(child.birthDate, onDate);
}

/** Age on a date as the chart plots it, or the reason it cannot be placed. */
export function plottableAge(child: Child, onDate: string) {
  return plottableAgeMonths(childRef(child), onDate);
}

export function latestMeasurement(measurements: Measurement[]): Measurement | null {
  const sorted = sortByDate(measurements);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

/** The most recent recorded value for one measure, with the day it was taken. */
export type LatestValue = {
  measurementId: string;
  measuredOn: string;
  value: number;
};

/**
 * The latest value of one measure, which is not the same thing as the latest
 * measurement. A visit where only the weight was taken leaves the length and
 * the head from the visit before as the newest ones there are — they are the
 * child's current numbers, and blanking them out because the last row happened
 * to be weight-only tells the parent less than the app knows.
 *
 * Each value carries its own date, so nothing here implies three measures were
 * taken on the same day when they were not.
 */
export function latestValueFor(
  measurements: Measurement[],
  measure: Measure,
): LatestValue | null {
  const sorted = sortByDate(measurements);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const value = measurementValue(sorted[i], measure);
    if (value !== null) {
      return { measurementId: sorted[i].id, measuredOn: sorted[i].measuredOn, value };
    }
  }
  return null;
}
