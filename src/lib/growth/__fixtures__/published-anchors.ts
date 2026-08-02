/**
 * Table 4 of Niklasson & Albertsson-Wikland, BMC Pediatrics 2008;8:8 — the
 * published anchors, at birth and every three months.
 *
 * Transcribed from `TABLE4` in `extract_growth_curves.py`, where it is
 * diagnostic-only and never enters the calibration. Weight is in log10(kg),
 * length and head in cm; each entry is `[mean, sd]`.
 *
 * These are the *table*, and the chart is what BVC actually plots on. The two
 * disagree — the extraction measured the disagreement per anchor and recorded
 * it as `table4DivergencePct` in the curve files. The anchor test asserts that
 * our interpolation lands where the published anchor plus the recorded
 * divergence says it should, which is what ties the app's arithmetic back to
 * the published reference.
 */

export const PUBLISHED_ANCHOR_MONTHS = [0, 3, 6, 9, 12, 15, 18, 21, 24] as const;

export type PublishedAnchor = { weight: [number, number]; length: [number, number]; head: [number, number] };

export const PUBLISHED_ANCHORS: Record<"male" | "female", Record<number, PublishedAnchor>> = {
  male: {
    0: { weight: [0.57, 0.053], length: [51.6, 1.6], head: [35.8, 1.3] },
    3: { weight: [0.798, 0.048], length: [61.3, 1.8], head: [41.1, 1.2] },
    6: { weight: [0.909, 0.044], length: [68.1, 2.0], head: [44.1, 1.2] },
    9: { weight: [0.974, 0.042], length: [72.5, 2.2], head: [46.0, 1.1] },
    12: { weight: [1.018, 0.041], length: [76.1, 2.4], head: [47.2, 1.3] },
    15: { weight: [1.053, 0.041], length: [79.6, 2.6], head: [48.1, 1.4] },
    18: { weight: [1.081, 0.041], length: [82.8, 2.8], head: [48.9, 1.3] },
    21: { weight: [1.106, 0.042], length: [85.7, 2.9], head: [49.5, 1.3] },
    24: { weight: [1.128, 0.043], length: [88.3, 3.1], head: [50.0, 1.3] },
  },
  female: {
    0: { weight: [0.551, 0.054], length: [50.8, 1.5], head: [35.0, 1.3] },
    3: { weight: [0.775, 0.048], length: [60.0, 1.8], head: [40.1, 1.2] },
    6: { weight: [0.884, 0.045], length: [66.6, 2.0], head: [43.0, 1.1] },
    9: { weight: [0.947, 0.044], length: [71.0, 2.2], head: [44.8, 1.1] },
    12: { weight: [0.991, 0.043], length: [74.7, 2.4], head: [46.0, 1.3] },
    15: { weight: [1.026, 0.043], length: [78.2, 2.6], head: [46.9, 1.3] },
    18: { weight: [1.056, 0.043], length: [81.5, 2.8], head: [47.6, 1.4] },
    21: { weight: [1.082, 0.043], length: [84.5, 3.0], head: [48.2, 1.3] },
    24: { weight: [1.105, 0.042], length: [87.2, 3.1], head: [48.7, 1.3] },
  },
};
