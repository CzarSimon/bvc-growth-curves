import { describe, expect, it } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import { ChartScreen, type ChartScreenData } from "./chart-screen";
import { inRange, type Measure, type OutOfRangeReason } from "@/lib/growth";
import type { CurvePoint } from "@/lib/child-data";

const emptyNotPlotted = {
  weight: {},
  length: {},
  head: {},
} as Record<Measure, Partial<Record<OutOfRangeReason, number>>>;

const points: CurvePoint[] = [
  { measurementId: "a", measuredOn: "2025-11-10", ageMonths: 3, value: 5.9, sds: 0.1 },
  { measurementId: "b", measuredOn: "2026-02-10", ageMonths: 6, value: 7.4, sds: 0.2 },
];

function data(over: Partial<ChartScreenData> = {}): ChartScreenData {
  return {
    childId: "c1",
    childName: "Elsa",
    childMeta: "Flicka · 11 mån · född 10 augusti 2025",
    sex: "female",
    birthDate: "2025-08-10",
    footnote: "Kurvorna visar medelvärde (M) och standardavvikelser…",
    todayAgeMonths: inRange(7.5),
    series: { weight: points, length: [], head: [] },
    notPlotted: emptyNotPlotted,
    ageDaysByMeasurement: { a: 92, b: 184 },
    ...over,
  };
}

async function render(props: ChartScreenData) {
  const stream = await renderToReadableStream(
    <ChartScreen data={props} initialMeasure="weight" />,
  );
  await stream.allReady;
  return new Response(stream).text();
}

describe("the chart screen", () => {
  it("names the shown measure's own curve and never a combined one", async () => {
    const html = await render(data());
    expect(html).toContain("Viktkurva");
    expect(html).not.toMatch(/>Tillväxtkurva</);
  });

  it("shows only the selected curve, not the other measures", async () => {
    const html = await render(data());
    expect(html).not.toContain("Längdkurva");
    expect(html).not.toContain("Huvudomfångskurva");
  });

  it("carries the axis caption and the age-correction footnote", async () => {
    const html = await render(data());
    expect(html).toContain("Vågrätt: ålder i månader, F = födsel");
    expect(html).toContain("standardavvikelser");
  });

  it("names values that cannot be plotted rather than dropping them", async () => {
    const html = await render(
      data({
        notPlotted: {
          ...emptyNotPlotted,
          weight: { "age-before-range": 2 },
        },
      }),
    );
    expect(html).toContain("2 mätningar visas inte i diagrammet");
    expect(html).toContain("vecka 40+0");
  });

  it("says a measure has no measurements yet instead of showing a blank card", async () => {
    const html = await render(data({ series: { weight: [], length: [], head: [] } }));
    expect(html).toContain("Inga mätningar av vikt än");
  });

  it("offers the projection but leaves it off, with nothing drawn or said", async () => {
    const html = await render(data());
    expect(html).toContain("Visa fortsättning");
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("Linjen räknas fram till i dag");
    expect(html).not.toContain("fram till i dag");
    expect(html).not.toContain('stroke-dasharray="9,7"');
  });
});
