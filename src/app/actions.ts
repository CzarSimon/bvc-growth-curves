"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChild } from "@/lib/db";
import { AUTH, VALIDATION } from "@/lib/copy";
import {
  validateChild,
  validateMeasurement,
  type FieldErrors,
} from "@/lib/validation";

export type FormState = { errors: FieldErrors } | null;

function fail(errors: FieldErrors): FormState {
  return { errors };
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// ------------------------------------------------------------------- auth --

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  if (!email) return fail({ email: AUTH.errors.emailRequired });
  if (!password) return fail({ password: AUTH.errors.passwordRequired });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail({ form: AUTH.errors.invalid });

  revalidatePath("/", "layout");
  redirect("/barn");
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  if (!email) return fail({ email: AUTH.errors.emailRequired });
  if (password.length < 8) return fail({ password: AUTH.errors.passwordShort });

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const alreadyRegistered = /already/i.test(error.message);
    return fail({ form: alreadyRegistered ? AUTH.errors.alreadyRegistered : AUTH.errors.generic });
  }

  revalidatePath("/", "layout");
  redirect("/barn");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/logga-in");
}

// ----------------------------------------------------------------- children --

export async function createChildAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const validated = validateChild({
    name: field(formData, "name"),
    sex: field(formData, "sex"),
    birthDate: field(formData, "birthDate"),
    gestationWeeks: field(formData, "gestationWeeks"),
    gestationDays: field(formData, "gestationDays"),
  });
  if (!validated.ok) return fail(validated.errors);

  const child = validated.value;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_child", {
    p_name: child.name,
    p_sex: child.sex,
    p_birth_date: child.birthDate,
    p_gestation_weeks: child.gestationWeeks,
    p_gestation_days: child.gestationDays,
  });
  if (error || !data) return fail({ form: AUTH.errors.generic });
  const childId = data as string;

  // Birth measurements are optional, and are saved dated the birth date.
  const birthValues = validateMeasurement(
    {
      measuredOn: child.birthDate,
      weight: field(formData, "birthWeight"),
      length: field(formData, "birthLength"),
      head: field(formData, "birthHead"),
    },
    child,
  );
  if (birthValues.ok) {
    await supabase.from("measurements").insert({
      child_id: childId,
      measured_on: birthValues.value.measuredOn,
      weight_grams: birthValues.value.weightGrams,
      length_mm: birthValues.value.lengthMm,
      head_mm: birthValues.value.headMm,
    });
  } else if (!birthValues.errors.values) {
    // "No values at all" is fine here — the card is optional. Anything else is
    // a real mistake and the child has already been created, so report it on
    // the birth-values fields rather than silently dropping the numbers.
    return fail(birthValues.errors);
  }

  revalidatePath("/barn", "layout");
  redirect(`/barn/${childId}`);
}

export async function updateChildAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const childId = field(formData, "childId");
  const validated = validateChild({
    name: field(formData, "name"),
    sex: field(formData, "sex"),
    birthDate: field(formData, "birthDate"),
    gestationWeeks: field(formData, "gestationWeeks"),
    gestationDays: field(formData, "gestationDays"),
  });
  if (!validated.ok) return fail(validated.errors);

  const supabase = await createClient();
  const { error } = await supabase
    .from("children")
    .update({
      name: validated.value.name,
      sex: validated.value.sex,
      birth_date: validated.value.birthDate,
      gestation_weeks: validated.value.gestationWeeks,
      gestation_days: validated.value.gestationDays,
    })
    .eq("id", childId);
  if (error) {
    // The one update the database refuses outright is moving the birth date
    // past an existing measurement.
    return fail({ birthDate: VALIDATION.measurementDateBeforeBirth });
  }

  revalidatePath("/barn", "layout");
  redirect(`/barn/${childId}`);
}

export async function deleteChildAction(formData: FormData) {
  const childId = field(formData, "childId");
  const supabase = await createClient();
  await supabase.from("children").delete().eq("id", childId);
  revalidatePath("/barn", "layout");
  redirect("/barn");
}

// ------------------------------------------------------------- measurements --

export async function saveMeasurementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const childId = field(formData, "childId");
  const measurementId = field(formData, "measurementId");

  const child = await getChild(childId);
  if (!child) return fail({ form: AUTH.errors.generic });

  const validated = validateMeasurement(
    {
      measuredOn: field(formData, "measuredOn"),
      weight: field(formData, "weight"),
      length: field(formData, "length"),
      head: field(formData, "head"),
    },
    child,
  );
  if (!validated.ok) return fail(validated.errors);

  const supabase = await createClient();
  const row = {
    child_id: childId,
    measured_on: validated.value.measuredOn,
    weight_grams: validated.value.weightGrams,
    length_mm: validated.value.lengthMm,
    head_mm: validated.value.headMm,
  };

  // Editing replaces the record in place, keeping the same id.
  const { error } = measurementId
    ? await supabase.from("measurements").update(row).eq("id", measurementId)
    : await supabase.from("measurements").insert(row);
  if (error) return fail({ form: AUTH.errors.generic });

  revalidatePath(`/barn/${childId}`, "layout");
  redirect(field(formData, "returnTo") || `/barn/${childId}`);
}

export async function deleteMeasurementAction(formData: FormData) {
  const childId = field(formData, "childId");
  const measurementId = field(formData, "measurementId");
  const supabase = await createClient();
  await supabase.from("measurements").delete().eq("id", measurementId);
  revalidatePath(`/barn/${childId}`, "layout");
  redirect(field(formData, "returnTo") || `/barn/${childId}/matningar`);
}
