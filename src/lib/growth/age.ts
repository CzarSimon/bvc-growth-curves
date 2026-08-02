/**
 * The age axis.
 *
 * The Swedish reference is anchored at 40+0 weeks of gestation, not at birth.
 * A child born at 38+0 has grown two weeks less than one born at 40+0 on the
 * same day of life, so the two plot at different positions on the same curve.
 * This is not prematurity correction — it applies to every child, including
 * post-term ones, whose curve shifts the other way.
 *
 *   ageDaysFromTerm = daysSinceBirth - (280 - gestationDays)
 *                   = daysSinceBirth + gestationDays - 280
 *
 * Equivalently, in the form the build spec states it:
 *
 *   ageWeeksFromTerm = daysSinceBirth / 7 + (gestationalWeeks - 40)
 *
 * Dates are handled as plain ISO calendar days (`YYYY-MM-DD`) throughout. A
 * measurement date is a calendar fact, not an instant, and going through local
 * `Date` arithmetic would make the age wrong by a day around DST boundaries.
 */

/** Gestational days at 40+0, the reference's anchor. */
export const TERM_DAYS = 280;

/** Term as the reference defines it: 37+0 through 42+0 inclusive. */
export const TERM_MIN_DAYS = 37 * 7;
export const TERM_MAX_DAYS = 42 * 7;

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

/** True for 37+0 … 42+0 inclusive. */
export function isTermGestation(weeks: number, days: number): boolean {
  if (!Number.isInteger(weeks) || !Number.isInteger(days)) return false;
  if (days < 0 || days > 6) return false;
  const total = gestationDays(weeks, days);
  return total >= TERM_MIN_DAYS && total <= TERM_MAX_DAYS;
}

/**
 * How far the child's curve shifts, in days. Positive means the child was born
 * before term and the curve moves left; negative means born after term.
 */
export function ageCorrectionDays(weeks: number, days: number): number {
  return TERM_DAYS - gestationDays(weeks, days);
}

/** Chronological days lived, birth date to measurement date. */
export function chronologicalAgeDays(birthDate: string, onDate: string): number {
  return daysBetween(birthDate, onDate);
}

export function ageDaysFromTerm(
  birthDate: string,
  onDate: string,
  weeks: number,
  days: number,
): number {
  return chronologicalAgeDays(birthDate, onDate) - ageCorrectionDays(weeks, days);
}

export function ageWeeksFromTerm(
  birthDate: string,
  onDate: string,
  weeks: number,
  days: number,
): number {
  return ageDaysFromTerm(birthDate, onDate, weeks, days) / 7;
}

export function ageMonthsFromTerm(
  birthDate: string,
  onDate: string,
  weeks: number,
  days: number,
): number {
  return ageDaysFromTerm(birthDate, onDate, weeks, days) / DAYS_PER_MONTH;
}
