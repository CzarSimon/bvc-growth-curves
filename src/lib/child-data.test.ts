/**
 * The latest value of a measure is not the latest measurement.
 *
 * A parent who weighs the child at home between visits leaves rows with a
 * weight and nothing else. The length and the head from the last visit are
 * still the newest ones there are, and this is what says so.
 */
import { describe, expect, it } from "vitest";
import { latestValueFor, sortByDate, type Measurement } from "./child-data";

let counter = 0;
function m(
  measuredOn: string,
  weightKg: number | null = null,
  lengthCm: number | null = null,
  headCm: number | null = null,
): Measurement {
  return {
    id: `m${++counter}`,
    childId: "c1",
    measuredOn,
    weightKg,
    lengthCm,
    headCm,
    createdBy: null,
  };
}

describe("latestValueFor", () => {
  it("has nothing to give for a child with no measurements", () => {
    expect(latestValueFor([], "weight")).toBeNull();
  });

  it("reaches past a newer measurement that left the measure blank", () => {
    const full = m("2026-08-25", 4.89, 58.0, 40.0);
    const weightOnly = m("2026-08-26", 4.95);

    expect(latestValueFor([full, weightOnly], "weight")).toEqual({
      measurementId: weightOnly.id,
      measuredOn: "2026-08-26",
      value: 4.95,
    });
    expect(latestValueFor([full, weightOnly], "length")).toEqual({
      measurementId: full.id,
      measuredOn: "2026-08-25",
      value: 58.0,
    });
    expect(latestValueFor([full, weightOnly], "head")).toEqual({
      measurementId: full.id,
      measuredOn: "2026-08-25",
      value: 40.0,
    });
  });

  it("is null for a measure that has never been filled in", () => {
    expect(latestValueFor([m("2026-08-26", 4.95)], "head")).toBeNull();
  });

  it("reads the dates rather than the order the rows arrived in", () => {
    const later = m("2026-08-26", 4.95);
    const earlier = m("2026-08-11", 4.5);
    expect(latestValueFor([later, earlier], "weight")?.measuredOn).toBe("2026-08-26");
  });

  it("takes the last row of a day when two share a date", () => {
    const first = m("2026-08-26", 4.95);
    const second = m("2026-08-26", 4.97);
    const ordered = sortByDate([second, first]);
    expect(latestValueFor([second, first], "weight")?.measurementId).toBe(
      ordered[ordered.length - 1].id,
    );
  });
});
