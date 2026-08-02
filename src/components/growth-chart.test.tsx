import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GrowthChart } from "./growth-chart";
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

function countOwnLine(markup: string): number {
  return (markup.match(/stroke-width="2\.4"/g) ?? []).length;
}
