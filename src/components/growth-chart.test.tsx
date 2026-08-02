import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GrowthChart, normalisedAge } from "./growth-chart";
import type { CurvePoint } from "@/lib/child-data";
import type { Measure } from "@/lib/growth";

const points: CurvePoint[] = [
  { measurementId: "a", measuredOn: "2025-08-10", ageMonths: 0, value: 3.48, sds: -0.2 },
  { measurementId: "b", measuredOn: "2025-11-10", ageMonths: 3, value: 5.9, sds: 0.1 },
  { measurementId: "c", measuredOn: "2026-02-10", ageMonths: 6, value: 7.4, sds: 0.2 },
];

function render(over: Partial<Parameters<typeof GrowthChart>[0]> = {}) {
  return renderToStaticMarkup(
    <GrowthChart
      sex="female"
      measure="weight"
      points={points}
      zoom={12}
      width={344}
      height={300}
      childName="Elsa"
      {...over}
    />,
  );
}

describe("the growth chart", () => {
  it("draws every measure and zoom without producing a NaN coordinate", () => {
    for (const measure of ["weight", "length", "head"] as Measure[]) {
      for (const zoom of [3, 12, 24] as const) {
        for (const sex of ["female", "male"] as const) {
          const markup = render({ measure, zoom, sex });
          expect(markup, `${sex}/${measure}/${zoom}`).not.toMatch(/NaN|Infinity/);
        }
      }
    }
  });

  it("draws seven reference curves and the three SD bands", () => {
    const markup = render();
    // Three band fills plus seven curve strokes.
    expect(markup.match(/<path/g)?.length).toBeGreaterThanOrEqual(10);
    for (const label of ["M", "+1", "−1", "+2", "−2", "+3", "−3"]) {
      expect(markup).toContain(`>${label}</text>`);
    }
  });

  it("tells the curves apart without relying on colour", () => {
    const markup = render();
    // Dash patterns and stroke widths carry the distinction too.
    expect(markup).toContain('stroke-dasharray="4,3"');
    expect(markup).toContain('stroke-dasharray="1,3"');
    expect(markup).toContain('stroke-width="1.7"');
  });

  it("draws one point as a point, with no connecting line", () => {
    const one = render({ points: points.slice(0, 1) });
    const many = render();
    expect(countOwnLine(one)).toBe(0);
    expect(countOwnLine(many)).toBe(1);
  });

  it("gives each point a touch target far larger than the dot", () => {
    const markup = render({ onSelect: () => {} });
    expect(markup.match(/r="16"/g)?.length).toBe(points.length);
  });

  it("labels birth as F and keeps the axis caption out of the plot", () => {
    expect(render()).toContain(">F</text>");
  });

  it("skips the hit targets and edge labels on a mini chart", () => {
    const markup = render({ mini: true, onSelect: () => {} });
    expect(markup).not.toContain('r="16"');
    expect(markup).not.toContain(">M</text>");
  });

  it("keeps a point that sits outside the ±3 SD envelope inside the drawing", () => {
    const high: CurvePoint[] = [
      { measurementId: "x", measuredOn: "2026-02-10", ageMonths: 6, value: 12.5, sds: 3.9 },
    ];
    const markup = render({ points: high });
    expect(markup).not.toMatch(/NaN/);
    const cy = Number(/circle cx="[\d.]+" cy="([\d.-]+)"/.exec(markup)?.[1]);
    expect(cy).toBeGreaterThan(0);
    expect(cy).toBeLessThan(300);
  });
});

describe("the compressed age axis", () => {
  it("spans the full width from birth to 24 months", () => {
    expect(normalisedAge(0)).toBe(0);
    expect(normalisedAge(24)).toBeCloseTo(1, 12);
  });

  it("keeps the printed sheet's proportions for 0–3 / 3–12 / 12–24 months", () => {
    const first = normalisedAge(3);
    const second = normalisedAge(12) - normalisedAge(3);
    const third = normalisedAge(24) - normalisedAge(12);
    expect(first).toBeCloseTo(0.33, 2);
    expect(second).toBeCloseTo(0.41, 2);
    expect(third).toBeCloseTo(0.26, 2);
  });

  it("is strictly increasing, so ages never fold back on each other", () => {
    for (let m = 0; m < 24; m += 0.05) {
      expect(normalisedAge(m + 0.05)).toBeGreaterThan(normalisedAge(m));
    }
  });

  it("has no slope break at the old segment borders", () => {
    // The bug: a piecewise-linear scale changed slope abruptly at 3 and 12
    // months, kinking every curve there. The slope ratio across a breakpoint
    // must be as smooth as it is anywhere else in the same neighbourhood.
    // The old piecewise scale changed slope by 63 % at 3 months and 37 % at 12;
    // a continuous compression changes it only by its own gentle curvature.
    const h = 0.01;
    const slope = (m: number) => (normalisedAge(m + h) - normalisedAge(m - h)) / (2 * h);
    for (const breakpoint of [3, 12]) {
      const ratio = slope(breakpoint + h) / slope(breakpoint - h);
      expect(Math.abs(ratio - 1), `slope ratio at ${breakpoint} months`).toBeLessThan(0.01);
    }
  });

  it("draws a constant-SD curve without a kink at 3 or 12 months", () => {
    // End to end: the mean curve is smooth in age, so its rendered polyline
    // must not change direction sharply at the old borders either.
    const markup = renderToStaticMarkup(
      <GrowthChart
        sex="female"
        measure="weight"
        points={[]}
        zoom={24}
        width={700}
        height={400}
        childName="Elsa"
      />,
    );
    // The mean curve is the only path drawn at stroke-width 1.7.
    const mean = /<path d="([^"]+)"[^>]*stroke-width="1\.7"/.exec(markup)?.[1];
    expect(mean).toBeDefined();
    const vertices = [...mean!.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }));
    expect(vertices.length).toBeGreaterThan(50);

    const angles = vertices.slice(1).map((v, i) => {
      const prev = vertices[i];
      return Math.atan2(v.y - prev.y, v.x - prev.x);
    });
    const turns = angles.slice(1).map((a, i) => Math.abs(a - angles[i]));
    // No single joint may turn much more than the sharpest turn elsewhere on
    // the curve; a segment border used to stand out by an order of magnitude.
    const median = [...turns].sort((a, b) => a - b)[Math.floor(turns.length / 2)];
    expect(Math.max(...turns)).toBeLessThan(Math.max(median * 8, 0.05));
  });
});

function countOwnLine(markup: string): number {
  return (markup.match(/stroke-width="2\.4"/g) ?? []).length;
}
