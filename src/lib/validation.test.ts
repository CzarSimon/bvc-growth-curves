import { describe, expect, it } from "vitest";
import { validateChild, validateMeasurement } from "./validation";
import { formatAge, formatNumber, parseDecimal, todayIso } from "./format";

const child = { birthDate: "2025-08-10" };

function measurementForm(over: Partial<Record<string, string>> = {}) {
  return {
    measuredOn: "2025-09-07",
    weight: "",
    length: "",
    head: "",
    ...over,
  } as { measuredOn: string; weight: string; length: string; head: string };
}

describe("measurement input", () => {
  it("accepts a single value on its own", () => {
    const result = validateMeasurement(measurementForm({ weight: "4,250" }), child);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.weightGrams).toBe(4250);
      expect(result.value.lengthMm).toBeNull();
      expect(result.value.headMm).toBeNull();
    }
  });

  it("accepts a comma or a period", () => {
    const comma = validateMeasurement(measurementForm({ length: "52,5" }), child);
    const period = validateMeasurement(measurementForm({ length: "52.5" }), child);
    expect(comma.ok && period.ok).toBe(true);
    if (comma.ok && period.ok) {
      expect(comma.value.lengthMm).toBe(525);
      expect(period.value.lengthMm).toBe(525);
    }
  });

  it("stores to the gram and the millimetre", () => {
    const result = validateMeasurement(
      measurementForm({ weight: "4,253", length: "52,7", head: "37,1" }),
      child,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ weightGrams: 4253, lengthMm: 527, headMm: 371 });
    }
  });

  it("rejects an empty measurement", () => {
    const result = validateMeasurement(measurementForm(), child);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.values).toBe("Fyll i minst ett värde.");
  });

  it("catches 45 typed where 4,5 was meant", () => {
    const result = validateMeasurement(measurementForm({ weight: "45" }), child);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.vikt).toMatch(/decimalkommat/);
  });

  it("rejects a date before the birth date", () => {
    const result = validateMeasurement(
      measurementForm({ measuredOn: "2025-08-09", weight: "3,5" }),
      child,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.measuredOn).toMatch(/före barnets födelsedatum/);
  });

  it("rejects a date in the future", () => {
    const result = validateMeasurement(
      measurementForm({ measuredOn: "2099-01-01", weight: "8,0" }),
      child,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.measuredOn).toMatch(/framtiden/);
  });

  it("rejects a date that does not exist", () => {
    const result = validateMeasurement(
      measurementForm({ measuredOn: "2025-02-30", weight: "5,0" }),
      child,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects something that is not a number at all", () => {
    const result = validateMeasurement(measurementForm({ weight: "fyra kilo" }), child);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.vikt).toMatch(/går inte att läsa/);
  });
});

describe("child input", () => {
  const base = {
    name: "Elsa",
    sex: "female",
    birthDate: "2025-08-10",
    gestationWeeks: "39",
    gestationDays: "2",
  };

  it("accepts a term child", () => {
    const result = validateChild(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.gestationWeeks).toBe(39);
  });

  it("defaults the days field to zero when left blank", () => {
    const result = validateChild({ ...base, gestationDays: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.gestationDays).toBe(0);
  });

  it("says plainly that preterm is out of scope rather than failing silently", () => {
    const result = validateChild({ ...base, gestationWeeks: "35" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.gestation).toMatch(/fullgången tid/);
  });

  it("rejects 42+1 and accepts 42+0", () => {
    expect(validateChild({ ...base, gestationWeeks: "42", gestationDays: "1" }).ok).toBe(false);
    expect(validateChild({ ...base, gestationWeeks: "42", gestationDays: "0" }).ok).toBe(true);
  });

  it("rejects a birth date in the future", () => {
    const result = validateChild({ ...base, birthDate: "2099-01-01" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.birthDate).toMatch(/framtiden/);
  });

  it("accepts today as a birth date", () => {
    expect(validateChild({ ...base, birthDate: todayIso() }).ok).toBe(true);
  });

  it("requires a name", () => {
    const result = validateChild({ ...base, name: "   " });
    expect(result.ok).toBe(false);
  });
});

describe("Swedish numbers", () => {
  it("renders a decimal comma", () => {
    expect(formatNumber(4.25, 3)).toBe("4,250");
    expect(formatNumber(52.5, 1)).toBe("52,5");
  });

  it("tells a blank field apart from nonsense", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("   ")).toBeNull();
    expect(parseDecimal("abc")).toBeUndefined();
    expect(parseDecimal("4,250")).toBe(4.25);
    expect(parseDecimal("4 250")).toBeUndefined();
  });

  it("reads ages the way a parent says them", () => {
    expect(formatAge(1)).toBe("1 dag");
    expect(formatAge(5)).toBe("5 dagar");
    expect(formatAge(21)).toBe("3 veckor");
    expect(formatAge(120)).toBe("3 mån 4 v");
    expect(formatAge(400)).toBe("1 år 1 mån");
  });
});
