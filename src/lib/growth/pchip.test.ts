import { describe, expect, it } from "vitest";
import { buildSpline, evaluateSpline, interpolateMonotone } from "./pchip";

describe("pchip", () => {
  it("passes through every knot exactly", () => {
    const xs = [0, 1.2, 2.4, 6, 12, 24];
    const ys = [3.5, 4.4, 5.5, 8.0, 10.6, 13.4];
    const spline = buildSpline(xs, ys);
    for (let i = 0; i < xs.length; i++) {
      expect(evaluateSpline(spline, xs[i])).toBeCloseTo(ys[i], 12);
    }
  });

  it("is monotone across a wide interval where a natural spline overshoots", () => {
    // The reference's own shape: steep early, then a long flat run. A natural
    // cubic dips below 10.4 somewhere in the 12–24 gap; PCHIP cannot.
    const xs = [0, 1, 2, 3, 12, 24];
    const ys = [3.5, 4.5, 5.5, 6.4, 10.4, 13.4];
    const spline = buildSpline(xs, ys);
    let previous = -Infinity;
    for (let x = 0; x <= 24; x += 0.01) {
      const y = evaluateSpline(spline, x);
      expect(y).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = y;
    }
  });

  it("never leaves the bracketing knot values inside a segment", () => {
    const xs = [0, 1, 2, 3];
    const ys = [0, 10, 10.2, 10.3];
    const spline = buildSpline(xs, ys);
    for (let x = 1; x <= 2; x += 0.005) {
      const y = evaluateSpline(spline, x);
      expect(y).toBeGreaterThanOrEqual(10 - 1e-12);
      expect(y).toBeLessThanOrEqual(10.2 + 1e-12);
    }
  });

  it("flattens at a turning point instead of overshooting it", () => {
    const xs = [0, 1, 2, 3];
    const ys = [0, 5, 5, 0];
    const spline = buildSpline(xs, ys);
    for (let x = 0; x <= 3; x += 0.01) {
      expect(evaluateSpline(spline, x)).toBeLessThanOrEqual(5 + 1e-12);
    }
  });

  it("reproduces a straight line exactly", () => {
    const xs = [0, 3, 7, 24];
    const ys = xs.map((x) => 2 * x + 1);
    const spline = buildSpline(xs, ys);
    for (let x = 0; x <= 24; x += 0.37) {
      expect(evaluateSpline(spline, x)).toBeCloseTo(2 * x + 1, 10);
    }
  });

  it("returns endpoint values outside the knot range rather than extrapolating", () => {
    const xs = [0, 1, 2];
    const ys = [10, 20, 30];
    expect(interpolateMonotone(xs, ys, -5)).toBe(10);
    expect(interpolateMonotone(xs, ys, 99)).toBe(30);
  });

  it("rejects malformed input", () => {
    expect(() => buildSpline([0, 1], [0])).toThrow();
    expect(() => buildSpline([0], [0])).toThrow();
    expect(() => buildSpline([0, 0, 1], [0, 1, 2])).toThrow();
    expect(() => buildSpline([0, 2, 1], [0, 1, 2])).toThrow();
  });
});
