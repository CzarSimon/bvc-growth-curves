import { describe, expect, it } from "vitest";
import {
  DAYS_PER_MONTH,
  ageCorrectionDays,
  ageDaysFromTerm,
  ageMonthsFromTerm,
  ageWeeksFromTerm,
  daysBetween,
  gestationDays,
  isTermGestation,
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

describe("term gestation", () => {
  it("accepts 37+0 through 42+0 and nothing else", () => {
    expect(isTermGestation(37, 0)).toBe(true);
    expect(isTermGestation(42, 0)).toBe(true);
    expect(isTermGestation(39, 2)).toBe(true);
    expect(isTermGestation(36, 6)).toBe(false);
    expect(isTermGestation(42, 1)).toBe(false);
    expect(isTermGestation(40, 7)).toBe(false);
    expect(isTermGestation(40, -1)).toBe(false);
    expect(isTermGestation(39.5, 0)).toBe(false);
  });

  it("shifts the curve by 280 days minus the gestation", () => {
    expect(ageCorrectionDays(40, 0)).toBe(0);
    expect(ageCorrectionDays(38, 0)).toBe(14);
    expect(ageCorrectionDays(37, 0)).toBe(21);
    expect(ageCorrectionDays(42, 0)).toBe(-14);
    expect(gestationDays(39, 2)).toBe(275);
    expect(ageCorrectionDays(39, 2)).toBe(5);
  });
});

describe("age from term", () => {
  it("matches the build spec's week formula", () => {
    // ageWeeksFromTerm = chronologicalAgeDays / 7 + (gestationalWeeks - 40)
    for (const weeks of [37, 38, 39, 40, 41, 42]) {
      for (const days of [0, 70, 365]) {
        const expected = days / 7 + (weeks - 40);
        expect(ageWeeksFromTerm("2025-01-01", isoPlus("2025-01-01", days), weeks, 0)).toBeCloseTo(
          expected,
          10,
        );
      }
    }
  });

  it("puts a 38-week and a 41-week baby of the same age at different positions", () => {
    const earlier = ageDaysFromTerm("2025-08-10", "2025-11-10", 38, 0);
    const later = ageDaysFromTerm("2025-08-10", "2025-11-10", 41, 0);
    expect(later - earlier).toBe(21);
  });

  it("is negative before term for a child born early", () => {
    // A 38+0 baby weighed on its birth date is two weeks short of the
    // reference's first point. This is the case the UI has to speak to.
    expect(ageDaysFromTerm("2025-08-10", "2025-08-10", 38, 0)).toBe(-14);
    expect(ageMonthsFromTerm("2025-08-10", "2025-08-10", 38, 0)).toBeCloseTo(
      -14 / DAYS_PER_MONTH,
      12,
    );
  });

  it("is already positive at birth for a post-term child", () => {
    expect(ageDaysFromTerm("2025-08-10", "2025-08-10", 41, 3), "41+3 is ten days past term").toBe(
      10,
    );
  });
});

function isoPlus(iso: string, days: number): string {
  const day = isoToEpochDay(iso);
  if (day === null) throw new Error("bad date");
  return new Date((day + days) * 86_400_000).toISOString().slice(0, 10);
}
