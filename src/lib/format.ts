/**
 * Swedish formatting and parsing.
 *
 * Input accepts both comma and period; output always renders a comma. Weight is
 * shown to the gram, lengths to the millimetre — the precision the BVC card is
 * written in.
 */

import { DAYS_PER_MONTH } from "./growth";

const MONTH_NAMES = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];

/** A number with a Swedish decimal comma, to a fixed number of decimals. */
export function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(".", ",");
}

/**
 * Parse what a parent typed. Accepts "4,250" and "4.250", and returns null for
 * an empty field, `undefined` for something that is not a number at all — the
 * caller distinguishes "left blank" from "typed nonsense".
 *
 * Whitespace is trimmed at the edges only, including the non-breaking and thin
 * spaces a paste can carry. A space in the middle is left to fail: "4 250"
 * could be 4250 grams or 4,250 kilos, and guessing at a medical value is worse
 * than asking the parent to type it again.
 */
export function parseDecimal(raw: string): number | null | undefined {
  const cleaned = raw.replace(/^[\s\u00a0\u2009]+|[\s\u00a0\u2009]+$/g, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

/** "10 augusti 2025" */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * The Swedish calendar day a timestamp fell on. Memberships are stored as
 * timestamps but read as days ("har tillgång sedan 3 mars"), and the day a
 * thing happened is the local one, not UTC's.
 */
export function isoDay(timestamp: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

/**
 * A child's age in words, from days lived. This is chronological age — what a
 * parent means by "how old is she" — not the corrected age the curve uses.
 */
export function formatAge(days: number): string {
  if (days < 0) return "0 dagar";
  if (days < 14) return `${days} ${days === 1 ? "dag" : "dagar"}`;
  if (days < 84) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${weeks === 1 ? "vecka" : "veckor"}`;
  }
  const months = Math.floor(days / DAYS_PER_MONTH);
  const remainder = days - Math.round(months * DAYS_PER_MONTH);
  const weeks = Math.floor(remainder / 7);
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const restMonths = months % 12;
    return `${years} år${restMonths ? ` ${restMonths} mån` : ""}`;
  }
  return `${months} mån${weeks ? ` ${weeks} v` : ""}`;
}

/** "39+2" */
export function formatGestation(weeks: number, days: number): string {
  return `${weeks}+${days}`;
}

/** Today as an ISO calendar day in Swedish local time. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
