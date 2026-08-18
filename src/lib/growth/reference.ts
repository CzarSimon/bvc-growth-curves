/**
 * The Swedish 0–24 month reference, loaded as static data at build time.
 *
 * `src/data/{boys,girls}-curves.json` are the extraction's deliverable and are
 * treated as a validated interface: `SCHEMA.md` is the contract and
 * `extraction/` is the pipeline that produced them. They never change at
 * runtime and are deliberately not in the database — a corrected reference is a
 * redeploy, not a migration.
 */

import boysCurves from "@/data/boys-curves.json";
import girlsCurves from "@/data/girls-curves.json";
import { buildSpline, evaluateSpline, type MonotoneSpline } from "./pchip";
import {
  MEASURES,
  inRange,
  outOfRange,
  type Distribution,
  type Measure,
  type Ranged,
  type ReferencePoint,
  type Sex,
} from "./types";

type RawMeasure = {
  unit: string;
  distribution: string;
  zscore: string;
  muUnit: string;
  ageMonths: number[];
  mu: number[];
  sigma: number[];
  curves: Record<string, number[]>;
  calibration: {
    space: string;
    pxPerDecade: number;
    gridlinePairs: number;
    r2Log: number;
    r2Linear: number;
    ticks: number[][];
  };
  validation: Record<string, unknown>;
  table4DivergencePct: Record<string, number>;
};

type RawFile = {
  sex: string;
  source: {
    pdf: string;
    chartCitation: string;
    method: string;
    ageRangeMonths: number[];
  };
  measures: Record<string, RawMeasure>;
};

const RAW: Record<Sex, RawFile> = {
  male: boysCurves as RawFile,
  female: girlsCurves as RawFile,
};

/** The reference's declared domain, in months of age. */
export const AGE_MIN_MONTHS = 0;
export const AGE_MAX_MONTHS = 24;

/**
 * The first vertex is the chart's birth vertex. It is read off the vector path
 * at 0.0015 months (about four minutes) because of where the polyline starts in
 * page coordinates; the declared domain in `source.ageRangeMonths` is [0, 24].
 * Snapping it to exactly 0 makes the knot range and the declared domain agree,
 * and moves `mu` by far less than the extraction's own sub-pixel tolerance.
 */
const FIRST_KNOT_SNAP_TOLERANCE_MONTHS = 0.01;

function assertDistribution(value: string, where: string): Distribution {
  if (value === "log10-normal" || value === "normal") return value;
  // Falling through to the linear case here is exactly the mistake that
  // produces errors which are small near the mean and large in the tails.
  throw new Error(`reference: unrecognised distribution "${value}" for ${where}`);
}

type CompiledMeasure = {
  unit: string;
  muUnit: string;
  distribution: Distribution;
  ageMonths: readonly number[];
  mu: MonotoneSpline;
  sigma: MonotoneSpline;
};

function compile(sex: Sex, measure: Measure): CompiledMeasure {
  const raw = RAW[sex].measures[measure];
  if (!raw) throw new Error(`reference: no data for ${sex}/${measure}`);

  const ages = raw.ageMonths.slice();
  if (Math.abs(ages[0] - AGE_MIN_MONTHS) > FIRST_KNOT_SNAP_TOLERANCE_MONTHS) {
    throw new Error(`reference: ${sex}/${measure} first knot is ${ages[0]}, expected ~0`);
  }
  if (ages[ages.length - 1] !== AGE_MAX_MONTHS) {
    throw new Error(`reference: ${sex}/${measure} last knot is not ${AGE_MAX_MONTHS}`);
  }
  ages[0] = AGE_MIN_MONTHS;

  if (raw.mu.length !== ages.length || raw.sigma.length !== ages.length) {
    throw new Error(`reference: ${sex}/${measure} mu/sigma length mismatch`);
  }

  return {
    unit: raw.unit,
    muUnit: raw.muUnit,
    distribution: assertDistribution(raw.distribution, `${sex}/${measure}`),
    ageMonths: ages,
    // mu and sigma are interpolated independently: sigma is not monotone in age
    // for every measure, and tying it to mu would invent structure.
    mu: buildSpline(ages, raw.mu),
    sigma: buildSpline(ages, raw.sigma),
  };
}

const COMPILED: Record<Sex, Record<Measure, CompiledMeasure>> = {
  male: {} as Record<Measure, CompiledMeasure>,
  female: {} as Record<Measure, CompiledMeasure>,
};
for (const sex of ["male", "female"] as const) {
  for (const measure of MEASURES) {
    COMPILED[sex][measure] = compile(sex, measure);
  }
}

/** Knot ages for a measure, in months of age. Exposed for tests. */
export function knotAges(sex: Sex, measure: Measure): readonly number[] {
  return COMPILED[sex][measure].ageMonths;
}

export function measureUnit(sex: Sex, measure: Measure): string {
  return COMPILED[sex][measure].unit;
}

export function measureDistribution(sex: Sex, measure: Measure): Distribution {
  return COMPILED[sex][measure].distribution;
}

/**
 * Mean and SD at an age in months. Refuses ages outside 0–24 months rather than
 * clamping: the chart does not define the curves there and weight in particular
 * is steep at both ends.
 */
export function referenceAt(
  sex: Sex,
  measure: Measure,
  ageMonths: number,
): Ranged<ReferencePoint> {
  if (!Number.isFinite(ageMonths)) {
    throw new Error("referenceAt: ageMonths must be finite");
  }
  if (ageMonths < AGE_MIN_MONTHS) return outOfRange("age-before-range", { ageMonths });
  if (ageMonths > AGE_MAX_MONTHS) return outOfRange("age-after-range", { ageMonths });

  const compiled = COMPILED[sex][measure];
  return inRange({
    mu: evaluateSpline(compiled.mu, ageMonths),
    sigma: evaluateSpline(compiled.sigma, ageMonths),
    distribution: compiled.distribution,
    unit: compiled.unit,
    muUnit: compiled.muUnit,
  });
}

/** Provenance, so a clinician can check what is being plotted. */
export function provenance(sex: Sex) {
  const raw = RAW[sex];
  return {
    sex: raw.sex,
    source: raw.source,
    measures: MEASURES.map((measure) => {
      const m = raw.measures[measure];
      return {
        measure,
        unit: m.unit,
        distribution: m.distribution,
        zscore: m.zscore,
        knots: m.ageMonths.length,
        calibration: {
          space: m.calibration.space,
          pxPerDecade: m.calibration.pxPerDecade,
          gridlinePairs: m.calibration.gridlinePairs,
          r2Log: m.calibration.r2Log,
          r2Linear: m.calibration.r2Linear,
        },
        validation: m.validation,
        table4DivergencePct: m.table4DivergencePct,
      };
    }),
  };
}

/** Raw knot arrays, for tests that need to check against the file as shipped. */
export function rawMeasure(sex: Sex, measure: Measure): RawMeasure {
  return RAW[sex].measures[measure];
}
