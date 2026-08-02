/**
 * The home screen's written reading, and the single escalation card.
 *
 * The order of the branches is the product: the first match wins, and each one
 * exists to stop a later, more confident sentence from being written on
 * evidence that does not support it. In particular a lone point never gets a
 * trend sentence, and weight is never interpreted without length.
 *
 * The only two triggers for the attention card are the ones Swedish BVC
 * actually escalates on: weight drifting more than 1 SDS across the relevant
 * window, and length below −2 SD at the latest measurement. Nothing else
 * triggers anything.
 */

import { READING } from "./copy";
import {
  ageDays,
  latestMeasurement,
  seriesFor,
  type Child,
  type CurvePoint,
  type Measurement,
} from "./child-data";
import { MEASURE_CONFIG } from "./measures";
import { sdShort } from "./copy";
import type { Measure } from "./growth";

export type Reading = {
  title: string;
  body: string;
  /** Copy for the attention card, or null when there is nothing to raise. */
  attention: string | null;
};

/** The BVC follow-up window: 3 months under a year old, 6 months from one to two. */
export function driftWindowMonths(child: Child, onDate: string): 3 | 6 {
  return ageDays(child, onDate) < 365 ? 3 : 6;
}

/**
 * How far weight has moved in SDS across the window, or null when there is no
 * earlier point far enough back. A missing comparison is stated, never guessed.
 */
export function weightDrift(
  points: CurvePoint[],
  windowMonths: number,
): { drift: number; from: CurvePoint; to: CurvePoint } | null {
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  // "Far enough back" is 85% of the window, so a visit a few days early still
  // counts as the previous checkpoint.
  const minimumSpan = windowMonths * 0.85;
  for (let i = points.length - 2; i >= 0; i--) {
    if (latest.ageMonths - points[i].ageMonths >= minimumSpan) {
      return { drift: latest.sds - points[i].sds, from: points[i], to: latest };
    }
  }
  return null;
}

export function buildReading(child: Child, measurements: Measurement[]): Reading {
  if (measurements.length === 0) {
    return { title: READING.empty.title, body: READING.empty.body, attention: null };
  }

  const latest = latestMeasurement(measurements)!;

  if (measurements.length === 1) {
    const newborn = ageDays(child, latest.measuredOn) < 14;
    return {
      title: READING.single.title,
      body:
        READING.single.body(child.name) +
        (newborn ? READING.single.newbornWeightLoss : ""),
      attention: null,
    };
  }

  const weight = seriesFor(child, measurements, "weight");
  const length = seriesFor(child, measurements, "length");
  const weightValues = measurements.filter((m) => m.weightKg !== null).length;
  const lengthValues = measurements.filter((m) => m.lengthCm !== null).length;

  // Weight is never read alone.
  if (weightValues >= 3 && lengthValues <= 1) {
    return {
      title: READING.weightOnly.title,
      body: READING.weightOnly.body(weightValues),
      attention: null,
    };
  }

  const latestLength = length.points.at(-1) ?? null;
  const lengthAttention =
    latestLength && latestLength.sds < -2 ? READING.attention.lengthLow : null;

  // Nothing at all sits inside the reference — say that rather than describing
  // a position we do not have.
  if (weight.points.length === 0 && length.points.length === 0) {
    const head = seriesFor(child, measurements, "head");
    if (head.points.length === 0) {
      return {
        title: READING.unplottable.title,
        body: READING.unplottable.body,
        attention: null,
      };
    }
  }

  // Several measurements but no weight among them: the design's states all
  // open on weight, so this branch describes what is actually there.
  if (weight.points.length === 0) {
    const parts: string[] = [];
    for (const measure of ["length", "head"] as Measure[]) {
      const point = seriesFor(child, measurements, measure).points.at(-1);
      if (point) {
        parts.push(`${MEASURE_CONFIG[measure].label} ligger ${sdShort(point.sds)}`);
      }
    }
    return {
      title: READING.noWeight.title,
      body: READING.noWeight.body(parts),
      attention: lengthAttention,
    };
  }

  const latestWeight = weight.points[weight.points.length - 1];
  const windowMonths = driftWindowMonths(child, latest.measuredOn);
  const drift = weightDrift(weight.points, windowMonths);

  let body = READING.current.position(latestWeight.sds, latestLength?.sds ?? null);
  let attention = lengthAttention;

  if (drift === null) {
    body += READING.current.noDrift;
  } else if (Math.abs(drift.drift) < 0.7) {
    body += READING.current.steady(child.name, windowMonths);
  } else if (Math.abs(drift.drift) < 1) {
    body += READING.current.moved(drift.drift, windowMonths);
  } else {
    body += READING.current.movedFar(drift.drift, windowMonths);
    // Weight drift takes the card when both triggers fire: it is the one that
    // moved, and the card carries one message.
    attention = READING.attention.weightDrift(windowMonths);
  }

  return { title: READING.current.title, body, attention };
}
