import { describe, expect, it } from "vitest";
import { PROJECTION_MIN_MONTHS, projectForward, type Projection } from "./projection";
import { sds } from "./sds";
import { inRange, outOfRange } from "./types";

function drawn(projection: Projection): Extract<Projection, { drawn: true }> {
  if (!projection.drawn) throw new Error(`expected a drawn projection, got ${projection.reason}`);
  return projection;
}

const latest = { ageMonths: 4, sds: -0.4 };

function project(over: Partial<Parameters<typeof projectForward>[0]> = {}) {
  return projectForward({
    sex: "female",
    measure: "weight",
    latest,
    todayAgeMonths: inRange(5.1),
    visibleToMonths: 12,
    ...over,
  });
}

describe("the projection", () => {
  it("holds the latest SDS constant instead of fitting a trend", () => {
    const line = drawn(project());
    for (const point of line.points) {
      const z = sds("female", "weight", point.ageMonths, point.value);
      expect(z.ok).toBe(true);
      if (z.ok) expect(z.value).toBeCloseTo(latest.sds, 9);
    }
  });

  it("starts at the latest measurement and stops at the child's age today", () => {
    const line = drawn(project());
    expect(line.from.ageMonths).toBeCloseTo(4, 9);
    expect(line.to.ageMonths).toBeCloseTo(5.1, 9);
  });

  it("does not run to the end of the visible interval", () => {
    // Looking at the 0–2 år view must not make the app project to 24 months.
    const line = drawn(project({ visibleToMonths: 24 }));
    expect(line.to.ageMonths).toBeCloseTo(5.1, 9);
  });

  it("is a reference curve, not a straight line", () => {
    const line = drawn(project({ latest: { ageMonths: 1, sds: 0 }, todayAgeMonths: inRange(11) }));
    const first = line.points[0];
    const last = line.points[line.points.length - 1];
    const middle = line.points[Math.floor(line.points.length / 2)];
    const straight =
      first.value +
      ((last.value - first.value) * (middle.ageMonths - first.ageMonths)) /
        (last.ageMonths - first.ageMonths);
    // Weight's own curve bends away from the chord by a clearly visible amount.
    expect(Math.abs(middle.value - straight)).toBeGreaterThan(0.2);
  });

  it("draws nothing when there is no measurement to count forward from", () => {
    expect(project({ latest: null })).toEqual({ drawn: false, reason: "no-measurement" });
  });

  it("draws nothing when today is past the visible interval", () => {
    expect(project({ visibleToMonths: 3 })).toEqual({
      drawn: false,
      reason: "today-past-interval",
    });
  });

  it("draws nothing when the child is past the reference's two years", () => {
    expect(
      project({
        latest: { ageMonths: 23, sds: 0.2 },
        todayAgeMonths: outOfRange("age-after-range", { ageMonths: 25.4 }),
        visibleToMonths: 24,
      }),
    ).toEqual({ drawn: false, reason: "today-past-reference" });
  });

  it("draws nothing when the latest measurement is essentially today", () => {
    expect(
      project({ todayAgeMonths: inRange(4 + PROJECTION_MIN_MONTHS / 2) }),
    ).toEqual({ drawn: false, reason: "already-current" });
  });

  it("works the same way for length and head, which are not log-normal", () => {
    for (const measure of ["length", "head"] as const) {
      const line = drawn(project({ measure, latest: { ageMonths: 4, sds: 1.2 } }));
      const z = sds("female", measure, line.to.ageMonths, line.to.value);
      expect(z.ok).toBe(true);
      if (z.ok) expect(z.value).toBeCloseTo(1.2, 9);
    }
  });

  it("grows as the gap since the last measurement grows", () => {
    const fresh = drawn(project({ todayAgeMonths: inRange(4.5) }));
    const stale = drawn(project({ todayAgeMonths: inRange(9) }));
    expect(stale.to.ageMonths - stale.from.ageMonths).toBeGreaterThan(
      fresh.to.ageMonths - fresh.from.ageMonths,
    );
  });
});
