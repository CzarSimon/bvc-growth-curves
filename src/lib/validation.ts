/**
 * Boundary validation. Impossible input is rejected here, with a reason in
 * Swedish, before anything reaches the database or the maths.
 */

import { VALIDATION } from "./copy";
import { formatNumber, parseDecimal, todayIso } from "./format";
import { isTermGestation, isValidIsoDate, daysBetween, type Sex } from "./growth";
import { MEASURE_CONFIG, MEASURE_ORDER } from "./measures";
import type { Measure } from "./growth";

export type FieldErrors = Record<string, string>;

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export type ChildInput = {
  name: string;
  sex: Sex;
  birthDate: string;
  gestationWeeks: number;
  gestationDays: number;
};

export type RawChildForm = {
  name: string;
  sex: string;
  birthDate: string;
  gestationWeeks: string;
  gestationDays: string;
};

export function validateChild(raw: RawChildForm): Validated<ChildInput> {
  const errors: FieldErrors = {};

  const name = raw.name.trim();
  if (!name) errors.name = VALIDATION.nameRequired;

  const sex = raw.sex === "female" || raw.sex === "male" ? (raw.sex as Sex) : null;
  if (!sex) errors.sex = VALIDATION.sexRequired;

  const birthDate = raw.birthDate.trim();
  if (!birthDate) errors.birthDate = VALIDATION.birthDateRequired;
  else if (!isValidIsoDate(birthDate)) errors.birthDate = VALIDATION.birthDateInvalid;
  else if (daysBetween(birthDate, todayIso()) < 0)
    errors.birthDate = VALIDATION.birthDateFuture;

  const weeks = parseInteger(raw.gestationWeeks);
  const days = raw.gestationDays.trim() === "" ? 0 : parseInteger(raw.gestationDays);
  if (weeks === null) {
    errors.gestation = VALIDATION.gestationRequired;
  } else if (days === null || days < 0 || days > 6) {
    errors.gestation = VALIDATION.gestationDaysRange;
  } else if (!isTermGestation(weeks, days)) {
    errors.gestation = VALIDATION.gestationNotTerm;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      sex: sex!,
      birthDate,
      gestationWeeks: weeks!,
      gestationDays: days!,
    },
  };
}

export type MeasurementInput = {
  measuredOn: string;
  /** Stored units: grams and millimetres, integers. */
  weightGrams: number | null;
  lengthMm: number | null;
  headMm: number | null;
};

export type RawMeasurementForm = {
  measuredOn: string;
  weight: string;
  length: string;
  head: string;
};

export function validateMeasurement(
  raw: RawMeasurementForm,
  child: { birthDate: string },
): Validated<MeasurementInput> {
  const errors: FieldErrors = {};

  const measuredOn = raw.measuredOn.trim();
  if (!measuredOn) errors.measuredOn = VALIDATION.measurementDateRequired;
  else if (!isValidIsoDate(measuredOn)) errors.measuredOn = VALIDATION.measurementDateInvalid;
  else if (daysBetween(measuredOn, todayIso()) < 0)
    errors.measuredOn = VALIDATION.measurementDateFuture;
  else if (daysBetween(child.birthDate, measuredOn) < 0)
    errors.measuredOn = VALIDATION.measurementDateBeforeBirth;

  const stored: Record<Measure, number | null> = { weight: null, length: null, head: null };
  const rawByMeasure: Record<Measure, string> = {
    weight: raw.weight,
    length: raw.length,
    head: raw.head,
  };

  let anyValue = false;
  for (const measure of MEASURE_ORDER) {
    const config = MEASURE_CONFIG[measure];
    const parsed = parseDecimal(rawByMeasure[measure] ?? "");
    if (parsed === null) continue;
    if (parsed === undefined) {
      errors[config.slug] = VALIDATION.notANumber(config.label);
      continue;
    }
    if (parsed < config.plausible.min || parsed > config.plausible.max) {
      // This is what catches 45 typed where 4,5 was meant.
      errors[config.slug] = VALIDATION.outsideRange(
        config.label,
        formatNumber(config.plausible.min, config.decimals === 3 ? 1 : 0),
        formatNumber(config.plausible.max, 0),
        config.unit,
      );
      continue;
    }
    anyValue = true;
    stored[measure] = config.toStored(parsed);
  }

  if (!anyValue && !Object.keys(errors).some((key) => key !== "measuredOn")) {
    errors.values = VALIDATION.atLeastOneValue;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      measuredOn,
      weightGrams: stored.weight,
      lengthMm: stored.length,
      headMm: stored.head,
    },
  };
}

function parseInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}
