/**
 * Shared types for the growth reference maths.
 *
 * This module (and everything else under `src/lib/growth`) is pure and
 * dependency-free: no React, no network, no database, no date library. Every
 * number the parent is shown comes from here, so it must be trivially testable
 * in isolation.
 */

export type Sex = "female" | "male";

export type Measure = "weight" | "length" | "head";

export const MEASURES: readonly Measure[] = ["weight", "length", "head"];

/**
 * How a measure is distributed around its mean. Weight is log-normal: its
 * stored `mu`/`sigma` are in log10(kg) and the z-score is computed on the
 * log10 scale. Length and head are normal, in centimetres.
 *
 * Being *drawn* on a logarithmic axis is a property of the chart's ink and is
 * not the same thing — all three measures are drawn on log axes.
 */
export type Distribution = "log10-normal" | "normal";

/** Why a value could not be placed on the reference. */
export type OutOfRangeReason =
  /** Corrected age is before the reference's first point (0 months from term). */
  | "age-before-range"
  /** Corrected age is past the reference's last point (24 months from term). */
  | "age-after-range"
  /** Gestational age at birth is outside term, 37+0 to 42+0. */
  | "gestation-not-term";

export type OutOfRange = {
  ok: false;
  reason: OutOfRangeReason;
  /** The corrected age in months that fell outside the reference, when known. */
  ageMonths?: number;
  /** The gestational age in days that fell outside term, when known. */
  gestationDays?: number;
};

export type InRange<T> = { ok: true; value: T };

/**
 * The result of anything that can fall off the reference. There is deliberately
 * no clamping variant: outside 0–24 months from term, or outside 37–42 weeks of
 * gestation, callers get `ok: false` and the UI says so plainly.
 */
export type Ranged<T> = InRange<T> | OutOfRange;

export function inRange<T>(value: T): InRange<T> {
  return { ok: true, value };
}

export function outOfRange(
  reason: OutOfRangeReason,
  detail: { ageMonths?: number; gestationDays?: number } = {},
): OutOfRange {
  return { ok: false, reason, ...detail };
}

/** The mean and one standard deviation at a given age, plus how to read them. */
export type ReferencePoint = {
  /** Mean, in `muUnit`. For weight this is log10(kg), not kg. */
  mu: number;
  /** One standard deviation, in the same unit as `mu`. */
  sigma: number;
  distribution: Distribution;
  /** The unit a *value* is expressed in: "kg" or "cm". */
  unit: string;
  /** The unit `mu` and `sigma` are expressed in: "log10(kg)" or "cm". */
  muUnit: string;
};
