/**
 * Stored units.
 *
 * Weight is stored in whole grams and lengths in whole millimetres. Medical
 * values do not go in floats: 4.25 kg is not representable in binary and a
 * round-trip through the database must not move the gram the parent typed.
 * Conversion to the reference's units (kg, cm) happens here and nowhere else.
 */

export function gramsToKg(grams: number): number {
  return grams / 1000;
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

export function mmToCm(mm: number): number {
  return mm / 10;
}

export function cmToMm(cm: number): number {
  return Math.round(cm * 10);
}
