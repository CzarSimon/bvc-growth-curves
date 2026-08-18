/**
 * A rendering smoke test for the home screen, with the data layer stubbed.
 *
 * The point is not pixel fidelity — it is that the screen a parent lands on
 * survives the awkward states: no measurements, one measurement, values that
 * fall outside the reference, and a child whose weight has drifted enough to
 * raise the card.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import type { Child, Measurement } from "@/lib/child-data";
import type { AccessMember, ChildRole } from "@/lib/access";

const child: Child = {
  id: "c1",
  name: "Elsa",
  sex: "female",
  birthDate: "2025-08-10",
  gestationWeeks: 39,
  gestationDays: 2,
};

let measurements: Measurement[] = [];
let myRole: ChildRole = "owner";

const me: AccessMember = {
  userId: "u1",
  displayName: "Du",
  role: "owner",
  since: "2025-08-10T09:00:00Z",
  isSelf: true,
};
let access: AccessMember[] = [me];

vi.mock("@/lib/db", () => ({
  getChild: async () => child,
  listChildren: async () => [child],
  listMeasurements: async () => measurements,
  getMeasurement: async () => null,
  getMyRole: async () => myRole,
  listChildAccess: async () => access,
}));

const { default: ChildHomePage } = await import("./page");

let counter = 0;
function m(
  measuredOn: string,
  weightKg: number | null = null,
  lengthCm: number | null = null,
  headCm: number | null = null,
): Measurement {
  return {
    id: `m${++counter}`,
    childId: child.id,
    measuredOn,
    weightKg,
    lengthCm,
    headCm,
    createdBy: null,
  };
}

async function renderHome(): Promise<string> {
  const element = await ChildHomePage({ params: Promise.resolve({ childId: child.id }) });
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

describe("the home screen", () => {
  beforeEach(() => {
    myRole = "owner";
    access = [me];
  });

  it("renders the empty state without a chart point or a verdict", async () => {
    measurements = [];
    const html = await renderHome();
    expect(html).toContain("Kurvan är tom än");
    expect(html).toContain("Fråga BVC när du vill");
    expect(html).not.toMatch(/NaN/);
  });

  it("renders one measurement as one point", async () => {
    measurements = [m("2025-10-10", 5.15, 57.0, 38.4)];
    const html = await renderHome();
    expect(html).toContain("En punkt är ingen kurva");
    expect(html).toContain("5,150 kg");
    expect(html).toContain("57,0 cm");
    expect(html).not.toMatch(/NaN/);
  });

  it("shows an em dash for a measure that was not taken", async () => {
    measurements = [m("2025-10-10", 5.15), m("2025-11-10", 5.9)];
    const html = await renderHome();
    expect(html).toContain("—");
    expect(html).not.toMatch(/NaN|undefined/);
  });

  it("says a value is off the curve instead of plotting it somewhere", async () => {
    // Born at 39+2, so the curve starts five days after the birth date. Both of
    // these were measured before the child reaches term.
    measurements = [m("2025-08-10", 3.48, 50.0, 34.0), m("2025-08-12", 3.29, 50.0, 34.0)];
    const html = await renderHome();
    expect(html).toContain("före kurvans början");
    expect(html).toContain("Inget att visa på kurvan än");
    // The values themselves are still shown — they are saved, not discarded.
    expect(html).toContain("3,290 kg");
  });

  it("renders the attention card when weight has drifted", async () => {
    measurements = [
      m("2025-08-15", 4.3, 52.0),
      m("2025-11-10", 5.6, 60.0),
      m("2026-02-10", 6.0, 66.0),
    ];
    const html = await renderHome();
    expect(html).toContain("Något att ta upp på BVC");
    expect(html).toContain("mer än 1 SD");
  });

  it("shows who has access as one line", async () => {
    measurements = [m("2025-10-10", 5.15, 57.0, 38.4)];
    access = [
      me,
      {
        userId: "u2",
        displayName: "Erik",
        role: "owner",
        since: "2025-09-01T09:00:00Z",
        isSelf: false,
      },
    ];
    const html = await renderHome();
    expect(html).toContain("Vem har tillgång");
    expect(html).toContain("2 personer");
    expect(html).toContain("du, Erik");
  });

  it("offers the way into the child's own details, next to sharing", async () => {
    measurements = [m("2025-10-10", 5.15, 57.0, 38.4)];
    const html = await renderHome();
    expect(html).toContain("Barnets uppgifter");
    expect(html).toContain("Flicka · född 10 augusti 2025 · vecka 39+2");
    expect(html).toContain(`href="/barn/c1/andra"`);
  });

  it("gives a view-only user the values but not the reading", async () => {
    myRole = "viewer";
    measurements = [
      m("2025-08-15", 4.3, 52.0),
      m("2025-11-10", 5.6, 60.0),
      m("2026-02-10", 6.0, 66.0),
    ];
    const html = await renderHome();
    // The same measurements raise the attention card for a guardian.
    expect(html).toContain("Du ser Elsas kurvor");
    expect(html).not.toContain("Något att ta upp på BVC");
    expect(html).not.toContain("Så ser kurvan ut nu");
    expect(html).not.toContain("Lägg till mätning");
    expect(html).not.toContain("Barnets uppgifter");
    // What they do get: the numbers, the curves and the way to BVC.
    expect(html).toContain("6,000 kg");
    expect(html).toContain("Fråga BVC när du vill");
  });

  it("never shows a status word, a score or the word percentil", async () => {
    measurements = [
      m("2025-08-15", 4.3, 52.0, 35.0),
      m("2025-11-10", 5.9, 60.0, 39.5),
      m("2026-02-10", 7.2, 66.0, 42.0),
    ];
    const html = await renderHome();
    expect(html).not.toMatch(/percentil/i);
    // No verdict vocabulary about the child. ("bra" is allowed: the BVC card
    // says you need no good reason to call, which is not a rating.)
    expect(html).not.toMatch(
      /\bnormal\b|\bavvikande\b|\bunderviktig|\böverviktig|\bför (liten|stor|lätt|tung)\b/i,
    );
  });
});
