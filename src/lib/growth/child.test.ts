import { describe, expect, it } from "vitest";
import { plottableAgeMonths, plotMeasurement, sampleAges, sampleSdCurve, type ChildRef } from "./child";
import { cmToMm, gramsToKg, kgToGrams, mmToCm } from "./units";

const term: ChildRef = {
  sex: "female",
  birthDate: "2025-08-10",
  gestationWeeks: 40,
  gestationDays: 0,
};
const early: ChildRef = { ...term, gestationWeeks: 38, gestationDays: 0 };
const late: ChildRef = { ...term, gestationWeeks: 41, gestationDays: 3 };
const postTerm: ChildRef = { ...term, gestationWeeks: 42, gestationDays: 4 };

describe("plottable age", () => {
  it("is zero on the birth date", () => {
    const age = plottableAgeMonths(term, "2025-08-10");
    expect(age.ok).toBe(true);
    if (age.ok) expect(age.value).toBe(0);
  });

  it("is zero on the birth date for an early-term child too", () => {
    // The regression this change exists to prevent: a 38+0 child used to land
    // two weeks short of the reference's start and be refused outright.
    const age = plottableAgeMonths(early, "2025-08-10");
    expect(age.ok).toBe(true);
    if (age.ok) expect(age.value).toBe(0);
  });

  it("ignores gestational length entirely", () => {
    // 38+0, 40+0, 41+3 and 42+4, same birth date, same measurement date: one
    // position on the curve. Age is no longer corrected for gestation.
    const ages = [term, early, late, postTerm].map((child) =>
      plottableAgeMonths(child, "2025-11-10"),
    );
    for (const age of ages) expect(age.ok).toBe(true);
    const values = ages.map((age) => (age.ok ? age.value : NaN));
    for (const value of values) expect(value).toBe(values[0]);
  });

  it("accepts a post-term child", () => {
    const age = plottableAgeMonths(postTerm, "2025-08-10");
    expect(age.ok).toBe(true);
    if (age.ok) expect(age.value).toBe(0);
  });

  it("refuses a preterm child outright, without computing an age", () => {
    const preterm: ChildRef = { ...term, gestationWeeks: 34, gestationDays: 2 };
    const result = plottableAgeMonths(preterm, "2026-02-01");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("gestation-preterm");
      expect(result.gestationDays).toBe(240);
    }
  });

  it("refuses a measurement past 24 months", () => {
    const result = plottableAgeMonths(term, "2027-09-10");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("age-after-range");
  });

  it("refuses a date before birth", () => {
    const result = plottableAgeMonths(term, "2025-08-09");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("age-before-range");
  });
});

describe("plotting a measurement", () => {
  it("gives the same value the same SDS whatever the gestation", () => {
    const onDate = "2025-11-10";
    const a = plotMeasurement(early, "weight", onDate, 6.0);
    const b = plotMeasurement(late, "weight", onDate, 6.0);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.value.ageMonths).toBe(a.value.ageMonths);
      expect(b.value.sds).toBe(a.value.sds);
    }
  });

  it("plots a birth-date measurement at the chart's F tick", () => {
    const result = plotMeasurement(early, "weight", "2025-08-10", 3.2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.ageMonths).toBe(0);
  });

  it("propagates the out-of-range reason instead of returning a number", () => {
    const preterm: ChildRef = { ...term, gestationWeeks: 35, gestationDays: 0 };
    const result = plotMeasurement(preterm, "weight", "2025-11-10", 6.0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("gestation-preterm");
  });
});

describe("curve sampling", () => {
  it("samples inclusive endpoints", () => {
    const ages = sampleAges(0, 12, 91);
    expect(ages[0]).toBe(0);
    expect(ages[ages.length - 1]).toBe(12);
    expect(ages.length).toBe(91);
  });

  it("throws rather than drawing a curve past the reference", () => {
    expect(() => sampleSdCurve("male", "weight", 0, [23, 24, 25])).toThrow();
  });
});

describe("stored units", () => {
  it("round-trips grams and millimetres without drift", () => {
    for (const grams of [3480, 4250, 10605, 1]) {
      expect(kgToGrams(gramsToKg(grams))).toBe(grams);
    }
    for (const mm of [500, 525, 887, 1]) {
      expect(cmToMm(mmToCm(mm))).toBe(mm);
    }
  });

  it("keeps a typed gram exact through the reference's unit", () => {
    expect(gramsToKg(4250)).toBe(4.25);
    expect(mmToCm(525)).toBe(52.5);
  });
});
