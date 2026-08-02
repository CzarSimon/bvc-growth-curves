import { describe, expect, it } from "vitest";
import { correctedAgeMonths, plotMeasurement, sampleAges, sampleSdCurve, type ChildRef } from "./child";
import { cmToMm, gramsToKg, kgToGrams, mmToCm } from "./units";

const term: ChildRef = {
  sex: "female",
  birthDate: "2025-08-10",
  gestationWeeks: 40,
  gestationDays: 0,
};
const early: ChildRef = { ...term, gestationWeeks: 38, gestationDays: 0 };
const late: ChildRef = { ...term, gestationWeeks: 41, gestationDays: 3 };

describe("corrected age", () => {
  it("is zero on the birth date for a 40+0 child", () => {
    const age = correctedAgeMonths(term, "2025-08-10");
    expect(age.ok).toBe(true);
    if (age.ok) expect(age.value).toBe(0);
  });

  it("refuses a child born before term reaches the reference's start", () => {
    const age = correctedAgeMonths(early, "2025-08-10");
    expect(age.ok).toBe(false);
    if (!age.ok) {
      expect(age.reason).toBe("age-before-range");
      expect(age.ageMonths).toBeLessThan(0);
    }
  });

  it("accepts the same child two weeks later", () => {
    const age = correctedAgeMonths(early, "2025-08-24");
    expect(age.ok).toBe(true);
    if (age.ok) expect(age.value).toBe(0);
  });

  it("starts a post-term child past zero", () => {
    const age = correctedAgeMonths(late, "2025-08-10");
    expect(age.ok).toBe(true);
    if (age.ok) expect(age.value).toBeGreaterThan(0.3);
  });

  it("refuses a non-term child outright, without computing an age", () => {
    const preterm: ChildRef = { ...term, gestationWeeks: 34, gestationDays: 2 };
    const result = correctedAgeMonths(preterm, "2026-02-01");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("gestation-not-term");
      expect(result.gestationDays).toBe(240);
    }
  });

  it("refuses a measurement past 24 months from term", () => {
    const result = correctedAgeMonths(term, "2027-09-10");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("age-after-range");
  });
});

describe("plotting a measurement", () => {
  it("gives the same value a different SDS for two children of different gestation", () => {
    const onDate = "2025-11-10";
    const a = plotMeasurement(early, "weight", onDate, 6.0);
    const b = plotMeasurement(late, "weight", onDate, 6.0);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      // The later-gestation child is further along the curve, so the same
      // weight sits lower for them.
      expect(b.value.ageMonths).toBeGreaterThan(a.value.ageMonths);
      expect(b.value.sds).toBeLessThan(a.value.sds);
    }
  });

  it("propagates the out-of-range reason instead of returning a number", () => {
    const result = plotMeasurement(early, "weight", "2025-08-10", 3.2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("age-before-range");
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
