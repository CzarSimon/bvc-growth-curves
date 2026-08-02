import "server-only";

import { createClient } from "./supabase/server";
import { gramsToKg, mmToCm, type Sex } from "./growth";
import type { Child, Measurement } from "./child-data";

type ChildRow = {
  id: string;
  name: string;
  sex: string;
  birth_date: string;
  gestation_weeks: number;
  gestation_days: number;
};

type MeasurementRow = {
  id: string;
  child_id: string;
  measured_on: string;
  weight_grams: number | null;
  length_mm: number | null;
  head_mm: number | null;
};

function toChild(row: ChildRow): Child {
  return {
    id: row.id,
    name: row.name,
    sex: row.sex as Sex,
    birthDate: row.birth_date,
    gestationWeeks: row.gestation_weeks,
    gestationDays: row.gestation_days,
  };
}

function toMeasurement(row: MeasurementRow): Measurement {
  return {
    id: row.id,
    childId: row.child_id,
    measuredOn: row.measured_on,
    weightKg: row.weight_grams === null ? null : gramsToKg(row.weight_grams),
    lengthCm: row.length_mm === null ? null : mmToCm(row.length_mm),
    headCm: row.head_mm === null ? null : mmToCm(row.head_mm),
  };
}

const CHILD_COLUMNS = "id, name, sex, birth_date, gestation_weeks, gestation_days";
const MEASUREMENT_COLUMNS = "id, child_id, measured_on, weight_grams, length_mm, head_mm";

/** Row-level security scopes this to the signed-in user's children. */
export async function listChildren(): Promise<Child[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .select(CHILD_COLUMNS)
    .order("birth_date", { ascending: true });
  if (error) throw error;
  return (data as ChildRow[]).map(toChild);
}

export async function getChild(childId: string): Promise<Child | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .select(CHILD_COLUMNS)
    .eq("id", childId)
    .maybeSingle();
  if (error) throw error;
  return data ? toChild(data as ChildRow) : null;
}

export async function listMeasurements(childId: string): Promise<Measurement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("measurements")
    .select(MEASUREMENT_COLUMNS)
    .eq("child_id", childId)
    .order("measured_on", { ascending: true });
  if (error) throw error;
  return (data as MeasurementRow[]).map(toMeasurement);
}

export async function getMeasurement(measurementId: string): Promise<Measurement | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("measurements")
    .select(MEASUREMENT_COLUMNS)
    .eq("id", measurementId)
    .maybeSingle();
  if (error) throw error;
  return data ? toMeasurement(data as MeasurementRow) : null;
}
