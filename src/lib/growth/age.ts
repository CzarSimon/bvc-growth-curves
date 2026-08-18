/**
 * The age axis.
 *
 * Age is days since birth. Nothing is shifted for gestational length.
 *
 * The Swedish reference is anchored at 40+0 weeks of gestation, and it is
 * tempting to move each child along the axis by how far their own birth sat
 * from that anchor. Swedish child health care does not do this: only preterm
 * children get a corrected age, and they are plotted on a separate reference
 * this app does not have. Correcting a term child here would make the app
 * disagree with the BVC card the parent is holding, so it does not.
 *
 * Gestational age at birth is still asked for, but it decides exactly one
 * thing: whether the app supports this child at all. Below 37+0 it does not.
 *
 * Dates are handled as plain ISO calendar days (`YYYY-MM-DD`) throughout. A
 * measurement date is a calendar fact, not an instant, and going through local
 * `Date` arithmetic would make the age wrong by a day around DST boundaries.
 */

/** 37+0, the preterm cutoff and the only gestational boundary the app has. */
export const TERM_MIN_DAYS = 37 * 7;

/** Mean days in a calendar month (365.25 / 12), the chart's month unit. */
export const DAYS_PER_MONTH = 30.4375;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Convert `YYYY-MM-DD` to a day number (days since the Unix epoch).
 * Returns null for anything that is not a real calendar date.
 */
export function isoToEpochDay(iso: string): number | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  // Rejects 2025-02-30 and friends, which Date.UTC silently rolls over.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.round(ms / 86_400_000);
}

export function isValidIsoDate(iso: string): boolean {
  return isoToEpochDay(iso) !== null;
}

export function epochDayToIso(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = isoToEpochDay(from);
  const b = isoToEpochDay(to);
  if (a === null || b === null) throw new Error(`daysBetween: invalid date (${from}, ${to})`);
  return b - a;
}

export function gestationDays(weeks: number, days: number): number {
  return weeks * 7 + days;
}

/**
 * True below 37+0 — the one gestation the app refuses.
 *
 * There is deliberately no upper bound. A post-term child (from 42+0, what
 * Swedish care calls *överburen*) is plotted from birth like everyone else:
 * no separate curve exists for them and no adjustment is made in practice.
 *
 * Malformed input is not preterm. `validateChild` rejects non-integers and
 * days outside 0–6 in its own earlier branches, so answering "false" here
 * cannot let bad input through — it keeps this function about one question.
 */
export function isPreterm(weeks: number, days: number): boolean {
  if (!Number.isInteger(weeks) || !Number.isInteger(days)) return false;
  if (days < 0 || days > 6) return false;
  return gestationDays(weeks, days) < TERM_MIN_DAYS;
}

/** Chronological days lived, birth date to measurement date. */
export function chronologicalAgeDays(birthDate: string, onDate: string): number {
  return daysBetween(birthDate, onDate);
}

/** Age in months since birth — the chart's x position. */
export function ageMonths(birthDate: string, onDate: string): number {
  return chronologicalAgeDays(birthDate, onDate) / DAYS_PER_MONTH;
}
