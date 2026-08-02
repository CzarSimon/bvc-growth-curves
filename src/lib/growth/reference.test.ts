import { describe, expect, it } from "vitest";
import {
  PUBLISHED_ANCHORS,
  PUBLISHED_ANCHOR_MONTHS,
} from "./__fixtures__/published-anchors";
import {
  AGE_MAX_MONTHS,
  AGE_MIN_MONTHS,
  knotAges,
  measureDistribution,
  rawMeasure,
  referenceAt,
} from "./reference";
import { normalCdf, sds, sdsFromReference, valueAtSds, valueFromReference } from "./sds";
import { MEASURES, type Measure, type Sex } from "./types";

const SEXES: Sex[] = ["male", "female"];
const SD_LABELS: Array<[string, number]> = [
  ["-3SD", -3],
  ["-2SD", -2],
  ["-1SD", -1],
  ["median", 0],
  ["+1SD", 1],
  ["+2SD", 2],
  ["+3SD", 3],
];

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`expected an in-range result, got ${result.reason}`);
  return result.value;
}

describe("reference data as shipped", () => {
  it("covers both sexes and all three measures over 0–24 months", () => {
    for (const sex of SEXES) {
      for (const measure of MEASURES) {
        const ages = knotAges(sex, measure);
        expect(ages.length).toBe(21);
        expect(ages[0]).toBe(AGE_MIN_MONTHS);
        expect(ages[ages.length - 1]).toBe(AGE_MAX_MONTHS);
      }
    }
  });

  it("treats weight as log-normal and length and head as normal", () => {
    for (const sex of SEXES) {
      expect(measureDistribution(sex, "weight")).toBe("log10-normal");
      expect(measureDistribution(sex, "length")).toBe("normal");
      expect(measureDistribution(sex, "head")).toBe("normal");
    }
  });

  it("does not use the same numbers for boys and girls", () => {
    for (const measure of MEASURES) {
      const boy = unwrap(referenceAt("male", measure, 12));
      const girl = unwrap(referenceAt("female", measure, 12));
      expect(boy.mu).not.toBeCloseTo(girl.mu, 6);
    }
  });

  it("reproduces the file's own SD curves at every knot", () => {
    // The file publishes the seven drawn curves as values. Rebuilding them from
    // mu and sigma exercises the back-transform, including 10^x for weight.
    for (const sex of SEXES) {
      for (const measure of MEASURES) {
        const raw = rawMeasure(sex, measure);
        const ages = knotAges(sex, measure);
        for (const [label, z] of SD_LABELS) {
          const published = raw.curves[label];
          for (let i = 0; i < ages.length; i++) {
            const computed = unwrap(valueAtSds(sex, measure, ages[i], z));
            expect(
              Math.abs(computed - published[i]) / published[i],
              `${sex}/${measure} ${label} at ${ages[i]} months`,
            ).toBeLessThan(1e-4);
          }
        }
      }
    }
  });

  it("keeps the median rising with age for every measure", () => {
    for (const sex of SEXES) {
      for (const measure of MEASURES) {
        let previous = -Infinity;
        for (let age = 0; age <= 24; age += 0.05) {
          const median = unwrap(valueAtSds(sex, measure, age, 0));
          expect(median, `${sex}/${measure} at ${age} months`).toBeGreaterThanOrEqual(
            previous - 1e-9,
          );
          previous = median;
        }
      }
    }
  });
});

describe("published anchors", () => {
  /**
   * The chart and Table 4 disagree, most of all at birth and three months, and
   * the extraction recorded that disagreement per anchor. So the assertion is
   * not "equals the table" — it is "equals the table displaced by exactly the
   * divergence the extraction measured". A sex swap, a measure swap, a unit
   * error, a linear-instead-of-log weight, or a broken interpolation all move
   * the result far outside this tolerance.
   *
   * The residual tolerance is interpolation method: the divergences were
   * computed with linear interpolation between the chart's 1.2-month vertices,
   * and we interpolate with PCHIP. The two differ by at most 0.55% at three
   * months, where weight is steepest, and by under 0.15% everywhere else.
   */
  const TOLERANCE_PCT = 0.3;

  for (const sex of SEXES) {
    for (const measure of MEASURES) {
      it(`${sex} ${measure} lands on the published anchors plus the recorded divergence`, () => {
        const raw = rawMeasure(sex, measure);
        for (const month of PUBLISHED_ANCHOR_MONTHS) {
          const anchor = PUBLISHED_ANCHORS[sex][month][measure];
          const publishedMedian = measure === "weight" ? 10 ** anchor[0] : anchor[0];
          const divergencePct = raw.table4DivergencePct[String(month)];
          expect(divergencePct, `no divergence recorded at ${month} months`).toBeTypeOf("number");

          const expected = publishedMedian * (1 + divergencePct / 100);
          const actual = unwrap(valueAtSds(sex, measure, month, 0));
          const errorPct = Math.abs((actual / expected - 1) * 100);
          expect(errorPct, `${sex}/${measure} at ${month} months`).toBeLessThan(TOLERANCE_PCT);
        }
      });
    }
  }

  it("keeps the chart's disagreement with the table visible rather than correcting it", () => {
    // Weight at three months is where the chart and the table differ most.
    // If someone ever "fixes" the curves to match the table, this fails.
    const raw = rawMeasure("male", "weight");
    expect(Math.abs(raw.table4DivergencePct["3"])).toBeGreaterThan(3);
    const published = 10 ** PUBLISHED_ANCHORS.male[3].weight[0];
    const chart = unwrap(valueAtSds("male", "weight", 3, 0));
    expect(Math.abs(chart - published)).toBeGreaterThan(0.15);
  });
});

describe("SDS", () => {
  it("round-trips through value and back for every measure", () => {
    for (const sex of SEXES) {
      for (const measure of MEASURES) {
        for (const age of [0, 0.4, 1.7, 6, 11.3, 18, 24]) {
          for (const z of [-3, -2, -1, -0.25, 0, 0.25, 1, 2, 3]) {
            const value = unwrap(valueAtSds(sex, measure, age, z));
            const back = unwrap(sds(sex, measure, age, value));
            expect(back, `${sex}/${measure} z=${z} at ${age}mo`).toBeCloseTo(z, 9);
          }
        }
      }
    }
  });

  it("computes weight on the log10 scale", () => {
    const point = unwrap(referenceAt("male", "weight", 12));
    const value = 10.6;
    expect(sdsFromReference(point, value)).toBeCloseTo(
      (Math.log10(value) - point.mu) / point.sigma,
      12,
    );
    // The hand check in verify.py: a 12-month boy at 10.6 kg is about +0.03 SD.
    expect(sdsFromReference(point, 10.6)).toBeCloseTo(0.03, 1);
  });

  it("is exact in the tails, where a linear weight formula goes wrong", () => {
    // Treating weight's log10 mu/sigma as if they were kg is the failure mode
    // that is nearly invisible at the mean and large at the edges. At -3 SD the
    // linear reading of the same constants is not even the right order of
    // magnitude, so this documents the size of the trap.
    const point = unwrap(referenceAt("male", "weight", 12));
    const correct = valueFromReference(point, -3);
    const linear = point.mu + -3 * point.sigma;
    expect(correct).toBeGreaterThan(7);
    expect(correct).toBeLessThan(9);
    expect(Math.abs(correct - linear)).toBeGreaterThan(5);

    // And the tail SD levels themselves are right: 3 SD out is a fraction of a
    // percent of children, and the value must match the drawn ±3 SD curve.
    expect(normalCdf(-3)).toBeCloseTo(0.00135, 4);
    const raw = rawMeasure("male", "weight");
    const ages = knotAges("male", "weight");
    for (let i = 0; i < ages.length; i++) {
      const low = unwrap(valueAtSds("male", "weight", ages[i], -3));
      const high = unwrap(valueAtSds("male", "weight", ages[i], 3));
      expect(Math.abs(low / raw.curves["-3SD"][i] - 1)).toBeLessThan(1e-4);
      expect(Math.abs(high / raw.curves["+3SD"][i] - 1)).toBeLessThan(1e-4);
    }
  });

  it("stays asymmetric for weight, because the distribution is log-normal", () => {
    // A log-normal measure's +1 SD is further from the median in kg than its
    // -1 SD. If this ever becomes symmetric, weight has been linearised.
    const median = unwrap(valueAtSds("female", "weight", 6, 0));
    const plus = unwrap(valueAtSds("female", "weight", 6, 1));
    const minus = unwrap(valueAtSds("female", "weight", 6, -1));
    expect(plus - median).toBeGreaterThan(median - minus + 0.05);
  });

  it("stays symmetric for length and head, because they are normal", () => {
    for (const measure of ["length", "head"] as Measure[]) {
      const median = unwrap(valueAtSds("female", measure, 6, 0));
      const plus = unwrap(valueAtSds("female", measure, 6, 1));
      const minus = unwrap(valueAtSds("female", measure, 6, -1));
      expect(plus - median).toBeCloseTo(median - minus, 10);
    }
  });

  it("refuses a non-positive weight rather than returning NaN", () => {
    expect(() => sds("male", "weight", 6, 0)).toThrow();
    expect(() => sds("male", "weight", 6, -1)).toThrow();
  });
});

describe("out of range", () => {
  it("refuses ages before and after the reference instead of clamping", () => {
    const before = referenceAt("male", "weight", -0.5);
    expect(before.ok).toBe(false);
    if (!before.ok) expect(before.reason).toBe("age-before-range");

    const after = referenceAt("male", "weight", 24.1);
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.reason).toBe("age-after-range");
  });

  it("accepts the exact endpoints", () => {
    expect(referenceAt("female", "length", 0).ok).toBe(true);
    expect(referenceAt("female", "length", 24).ok).toBe(true);
  });

  it("does not silently produce a value just outside the range", () => {
    const inside = unwrap(referenceAt("male", "head", 24));
    const outside = referenceAt("male", "head", 24.000001);
    expect(outside.ok).toBe(false);
    expect(inside.mu).toBeGreaterThan(0);
  });
});
