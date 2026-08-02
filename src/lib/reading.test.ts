import { describe, expect, it } from "vitest";
import { buildReading, weightDrift } from "./reading";
import { seriesFor, type Child, type Measurement } from "./child-data";
import { READING } from "./copy";

const child: Child = {
  id: "c1",
  name: "Elsa",
  sex: "female",
  birthDate: "2025-08-10",
  gestationWeeks: 40,
  gestationDays: 0,
};

let counter = 0;
function m(
  measuredOn: string,
  weightKg: number | null = null,
  lengthCm: number | null = null,
  headCm: number | null = null,
): Measurement {
  return { id: `m${++counter}`, childId: child.id, measuredOn, weightKg, lengthCm, headCm };
}

describe("the home reading", () => {
  it("says the curve is empty when there is nothing", () => {
    expect(buildReading(child, []).title).toBe(READING.empty.title);
  });

  it("treats one measurement as its own state, with no trend sentence", () => {
    const reading = buildReading(child, [m("2025-10-10", 5.1, 57)]);
    expect(reading.title).toBe(READING.single.title);
    expect(reading.body).not.toMatch(/kanal/);
    expect(reading.attention).toBeNull();
  });

  it("explains the normal newborn weight loss under 14 days", () => {
    const early = buildReading(child, [m("2025-08-14", 3.29)]);
    const later = buildReading(child, [m("2025-09-14", 4.2)]);
    expect(early.body).toContain("6 %");
    expect(later.body).not.toContain("6 %");
  });

  it("refuses to interpret weight without length", () => {
    const reading = buildReading(child, [
      m("2025-08-10", 3.48),
      m("2025-09-10", 4.3),
      m("2025-10-10", 5.2),
      m("2025-11-10", 6.0),
    ]);
    expect(reading.title).toBe(READING.weightOnly.title);
    expect(reading.body).toContain("Vikt utan längd");
    expect(reading.attention).toBeNull();
  });

  it("says outright when the history is too short to give a direction", () => {
    const reading = buildReading(child, [
      m("2025-08-10", 3.48, 50.0),
      m("2025-09-07", 4.22, 53.0),
    ]);
    expect(reading.title).toBe(READING.current.title);
    expect(reading.body).toContain("tillräckligt lång tid");
    expect(reading.attention).toBeNull();
  });

  it("names channel-crossing in the first year as common, without a card", () => {
    // 0.8 SD down across three months: worth describing, not escalating.
    const reading = buildReading(child, [
      m("2025-08-10", 3.9, 51.0),
      m("2025-11-10", 6.2, 60.0),
      m("2026-02-10", 7.6, 66.0),
    ]);
    expect(reading.body).toMatch(/flyttat sig/);
    expect(reading.body).toContain("behöver inte betyda något");
    expect(reading.attention).toBeNull();
  });

  it("raises the card, once, when weight drifts more than 1 SD", () => {
    const reading = buildReading(child, [
      m("2025-08-10", 4.3, 52.0),
      m("2025-11-10", 5.6, 60.0),
      m("2026-02-10", 6.0, 66.0),
    ]);
    expect(reading.attention).not.toBeNull();
    expect(reading.attention).toContain("mer än 1 SD");
    // It never diagnoses and never instructs.
    expect(reading.attention).not.toMatch(/diagnos|sjuk|du måste|du ska/i);
  });

  it("raises the card when the latest length is below −2 SD", () => {
    const reading = buildReading(child, [
      m("2025-08-10", 3.4, 47.0),
      m("2025-11-10", 5.6, 55.0),
    ]);
    expect(reading.attention).toBe(READING.attention.lengthLow);
  });

  it("does not fall over when there are measurements but no weight", () => {
    const reading = buildReading(child, [
      m("2025-09-10", null, 53.0, 36.0),
      m("2025-11-10", null, 60.0, 39.5),
    ]);
    expect(reading.title).toBe(READING.noWeight.title);
    expect(reading.body).toContain("Vikt saknas");
  });

  it("says nothing can be plotted when every point is off the reference", () => {
    // Born at 38+0, both measurements taken before the child reaches term.
    const early: Child = { ...child, gestationWeeks: 38, gestationDays: 0 };
    const reading = buildReading(early, [
      m("2025-08-10", 3.2, 49.0),
      m("2025-08-15", 3.1, 49.0),
    ]);
    expect(reading.title).toBe(READING.unplottable.title);
  });

  it("never uses the word percentil", () => {
    const readings = [
      buildReading(child, []),
      buildReading(child, [m("2025-10-10", 5.1, 57)]),
      buildReading(child, [
        m("2025-08-10", 3.48, 50.0),
        m("2025-11-10", 5.9, 59.8),
        m("2026-02-10", 7.0, 64.2),
      ]),
    ];
    for (const reading of readings) {
      expect(`${reading.title} ${reading.body} ${reading.attention ?? ""}`).not.toMatch(
        /percentil/i,
      );
    }
  });
});

describe("weight drift", () => {
  it("returns null when no earlier point is far enough back", () => {
    const measurements = [m("2025-08-10", 3.48), m("2025-09-07", 4.22)];
    const { points } = seriesFor(child, measurements, "weight");
    expect(weightDrift(points, 3)).toBeNull();
  });

  it("accepts a visit a few days early as the previous checkpoint", () => {
    // 2.6 months apart, which is 85% of a three-month window.
    const measurements = [m("2025-08-10", 3.48), m("2025-10-27", 5.6)];
    const { points } = seriesFor(child, measurements, "weight");
    expect(weightDrift(points, 3)).not.toBeNull();
  });

  it("compares against the most recent point that is far enough back", () => {
    const measurements = [
      m("2025-08-10", 3.48),
      m("2025-10-10", 5.15),
      m("2026-01-12", 6.98),
    ];
    const { points } = seriesFor(child, measurements, "weight");
    const drift = weightDrift(points, 3);
    expect(drift?.from.measuredOn).toBe("2025-10-10");
    expect(drift?.to.measuredOn).toBe("2026-01-12");
  });
});
