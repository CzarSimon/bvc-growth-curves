import { describe, expect, it } from "vitest";
import {
  DAYS_PER_MONTH,
  ageMonths,
  chronologicalAgeDays,
  daysBetween,
  gestationDays,
  isPreterm,
  isValidIsoDate,
  isoToEpochDay,
} from "./age";

describe("ISO calendar days", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isValidIsoDate("2025-08-10")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2025-02-29")).toBe(false);
    expect(isValidIsoDate("2025-13-01")).toBe(false);
    expect(isValidIsoDate("2025-8-10")).toBe(false);
    expect(isValidIsoDate("igår")).toBe(false);
  });

  it("counts days across a DST boundary", () => {
    // Sweden moves to summer time on 2026-03-29. Local Date arithmetic would
    // give 30.958… days here and round the age wrong.
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
    expect(daysBetween("2026-10-01", "2026-11-01")).toBe(31);
  });

  it("counts backwards for dates before birth", () => {
    expect(daysBetween("2025-08-10", "2025-08-09")).toBe(-1);
  });

  it("is stable across a leap day", () => {
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
    expect(isoToEpochDay("1970-01-01")).toBe(0);
  });
});

describe("the preterm gate", () => {
  it("refuses below 37+0 and nothing above it", () => {
    expect(isPreterm(36, 6)).toBe(true);
    expect(isPreterm(34, 2)).toBe(true);
    expect(isPreterm(37, 0)).toBe(false);
    expect(isPreterm(39, 2)).toBe(false);
    expect(isPreterm(40, 0)).toBe(false);
  });

  it("has no upper bound — a post-term child is supported", () => {
    // Överburen, from 42+0. Swedish care plots these children from birth like
    // any other; there is no separate curve and no adjustment.
    expect(isPreterm(42, 0)).toBe(false);
    expect(isPreterm(42, 1)).toBe(false);
    expect(isPreterm(43, 2)).toBe(false);
  });

  it("does not treat malformed input as preterm", () => {
    // validateChild rejects these in its own earlier branches.
    expect(isPreterm(40, 7)).toBe(false);
    expect(isPreterm(40, -1)).toBe(false);
    expect(isPreterm(39.5, 0)).toBe(false);
  });

  it("counts gestation in days", () => {
    expect(gestationDays(39, 2)).toBe(275);
    expect(gestationDays(37, 0)).toBe(259);
  });
});

describe("age from birth", () => {
  it("is zero on the birth date, whatever the gestation", () => {
    expect(chronologicalAgeDays("2025-08-10", "2025-08-10")).toBe(0);
    expect(ageMonths("2025-08-10", "2025-08-10")).toBe(0);
  });

  it("does not depend on gestational length at all", () => {
    // The whole point of the change: age takes only two dates as input.
    expect(ageMonths("2025-08-10", "2025-11-10")).toBeCloseTo(92 / DAYS_PER_MONTH, 12);
  });

  it("counts calendar days, not weeks of gestation", () => {
    for (const days of [0, 70, 365]) {
      const onDate = isoPlus("2025-01-01", days);
      expect(ageMonths("2025-01-01", onDate)).toBeCloseTo(days / DAYS_PER_MONTH, 10);
    }
  });
});

function isoPlus(iso: string, days: number): string {
  const day = isoToEpochDay(iso);
  if (day === null) throw new Error("bad date");
  return new Date((day + days) * 86_400_000).toISOString().slice(0, 10);
}
