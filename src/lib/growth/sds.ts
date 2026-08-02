/**
 * SDS (standard deviation score) and its inverse.
 *
 *   normal:       z = (value - mu) / sigma
 *   log10-normal: z = (log10(value) - mu) / sigma      <- weight
 *
 * Weight's stored mu and sigma are already on the log10 scale. Computing
 * weight's z linearly gives an answer that is nearly right near the mean and
 * badly wrong in the tails — that is, wrong exactly where it matters.
 */

import { referenceAt } from "./reference";
import {
  inRange,
  type Measure,
  type Ranged,
  type ReferencePoint,
  type Sex,
} from "./types";

/** z from a measured value, given the reference point at that age. */
export function sdsFromReference(point: ReferencePoint, value: number): number {
  if (point.distribution === "log10-normal") {
    if (!(value > 0)) throw new Error("sds: log10-normal measures require a positive value");
    return (Math.log10(value) - point.mu) / point.sigma;
  }
  return (value - point.mu) / point.sigma;
}

/** The value that sits exactly `z` SD from the mean at that age. */
export function valueFromReference(point: ReferencePoint, z: number): number {
  if (point.distribution === "log10-normal") {
    return 10 ** (point.mu + z * point.sigma);
  }
  return point.mu + z * point.sigma;
}

/**
 * SDS for a measured value at a corrected age.
 * `value` is in the measure's own unit: kg for weight, cm for length and head.
 */
export function sds(
  sex: Sex,
  measure: Measure,
  ageMonths: number,
  value: number,
): Ranged<number> {
  const point = referenceAt(sex, measure, ageMonths);
  if (!point.ok) return point;
  return inRange(sdsFromReference(point.value, value));
}

/** The reference value at a given SD level — what the chart's bands are drawn from. */
export function valueAtSds(
  sex: Sex,
  measure: Measure,
  ageMonths: number,
  z: number,
): Ranged<number> {
  const point = referenceAt(sex, measure, ageMonths);
  if (!point.ok) return point;
  return inRange(valueFromReference(point.value, z));
}

/**
 * The share of children below this SDS, from the standard normal CDF.
 *
 * Swedish BVC reads the chart in SD and the product never says "percentil", so
 * this is not shown as a centile anywhere. It exists for tests, which need an
 * independent handle on the tails.
 */
export function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26 applied to erf, accurate to ~1.5e-7.
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}
