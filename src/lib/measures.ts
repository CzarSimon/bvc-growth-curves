import type { Measure } from "./growth";
import { cmToMm, gramsToKg, kgToGrams, mmToCm } from "./growth";

export type MeasureSlug = "vikt" | "langd" | "huvudomfang";

export type MeasureConfig = {
  key: Measure;
  slug: MeasureSlug;
  /** How the measure is named in a sentence and on a form. */
  label: string;
  /** The name of its own chart. There is no combined "tillväxtkurva". */
  chartTitle: string;
  unit: "kg" | "cm";
  decimals: number;
  /** The database column holding this measure, in grams or millimetres. */
  column: "weight_grams" | "length_mm" | "head_mm";
  /** Display value (kg or cm) to the stored integer. */
  toStored: (value: number) => number;
  fromStored: (stored: number) => number;
  /** Plausible range in display units, checked at the boundary. */
  plausible: { min: number; max: number };
  /** Gridline values, drawn only where they fall inside the domain. */
  yTicks: number[];
  /** True where the y axis is logarithmic. */
  logScale: boolean;
  placeholder: string;
};

export const MEASURE_CONFIG: Record<Measure, MeasureConfig> = {
  weight: {
    key: "weight",
    slug: "vikt",
    label: "Vikt",
    chartTitle: "Viktkurva",
    unit: "kg",
    decimals: 3,
    column: "weight_grams",
    toStored: kgToGrams,
    fromStored: gramsToKg,
    // A newborn under 0.3 kg or a two-year-old over 30 kg is a typo, not a
    // measurement. This is what catches 45 typed for 4,5.
    plausible: { min: 0.3, max: 30 },
    yTicks: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20],
    logScale: true,
    placeholder: "4,250",
  },
  length: {
    key: "length",
    slug: "langd",
    label: "Längd",
    chartTitle: "Längdkurva",
    unit: "cm",
    decimals: 1,
    column: "length_mm",
    toStored: cmToMm,
    fromStored: mmToCm,
    plausible: { min: 25, max: 120 },
    yTicks: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95],
    logScale: false,
    placeholder: "52,5",
  },
  head: {
    key: "head",
    slug: "huvudomfang",
    label: "Huvudomfång",
    chartTitle: "Huvudomfångskurva",
    unit: "cm",
    decimals: 1,
    column: "head_mm",
    toStored: cmToMm,
    fromStored: mmToCm,
    plausible: { min: 20, max: 70 },
    yTicks: [32, 34, 36, 38, 40, 42, 44, 46, 48, 50],
    logScale: false,
    placeholder: "41,2",
  },
};

export const MEASURE_ORDER: Measure[] = ["weight", "length", "head"];

export function measureFromSlug(slug: string): Measure | null {
  const found = MEASURE_ORDER.find((key) => MEASURE_CONFIG[key].slug === slug);
  return found ?? null;
}
