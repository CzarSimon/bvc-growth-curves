"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChild } from "@/lib/db";
import { AUTH, SHARE, VALIDATION } from "@/lib/copy";
import { INVITE_ROLE, type SharedRole } from "@/lib/access";
import { hashInviteToken, inviteUrl, newInviteToken } from "@/lib/invite";
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

/**
 * Where to go after signing in. An invite link sends a signed-out visitor here
 * and wants them back afterwards, so this value comes off a query string and is
 * only ever a path on this site — anything else is somebody else's idea of
 * where the user should end up.
 */
function safeReturnTo(raw: string, fallback: string): string {
  const ok = raw.startsWith("/") && !raw.startsWith("//") && !/[\\\s]/.test(raw);
  return ok ? raw : fallback;
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
  redirect(safeReturnTo(field(formData, "retur"), "/barn"));
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
  redirect(safeReturnTo(field(formData, "retur"), "/barn"));
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

  // Birth measurements are optional, but check them before creating anything:
  // reporting a typo after the child exists would make resubmitting the form
  // create a second child.
  const birthValues = validateMeasurement(
    {
      measuredOn: child.birthDate,
      weight: field(formData, "birthWeight"),
      length: field(formData, "birthLength"),
      head: field(formData, "birthHead"),
    },
    child,
  );
  // "No values at all" is fine here — the card is optional. Anything else is a
  // real mistake and belongs on the field that caused it.
  if (!birthValues.ok && !birthValues.errors.values) return fail(birthValues.errors);

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

  // Saved as a measurement dated the birth date.
  if (birthValues.ok) {
    await supabase.from("measurements").insert({
      child_id: childId,
      measured_on: birthValues.value.measuredOn,
      weight_grams: birthValues.value.weightGrams,
      length_mm: birthValues.value.lengthMm,
      head_mm: birthValues.value.headMm,
    });
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
    // The update the database refuses outright is moving the birth date past an
    // existing measurement, which would strand it before the child was born.
    return fail({ birthDate: VALIDATION.birthDateAfterMeasurement });
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

// ------------------------------------------------------------------ sharing --

export type InviteState = { link: string; role: SharedRole } | { error: string } | null;

/**
 * Make an invite link. The role is written into the invite row here and read
 * back out of it when someone joins, so the person opening the link never gets
 * to say what they are joining as — forwarding a link cannot escalate it.
 *
 * The token is returned to this screen and stored only as a hash. Making a new
 * link kills the caller's previous unused one for this child, which is what
 * "Ny länk" means to a parent who sent the first one to the wrong number.
 */
export async function createInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const childId = field(formData, "childId");
  const role: SharedRole = field(formData, "role") === "guardian" ? "guardian" : "viewer";
  const token = newInviteToken();

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_child_invite", {
    p_child_id: childId,
    p_role: INVITE_ROLE[role],
    p_token_hash: hashInviteToken(token),
  });
  // Refused for a child the caller does not co-manage, among other things. The
  // screen says the link could not be made rather than why: a view-only user
  // who reached this form has no business being told more.
  if (error) return { error: SHARE.linkFailed };

  return { link: await inviteUrl(token), role };
}

/**
 * Remove someone's view-only access. The database refuses this for a co-manager
 * whatever the form says, and nobody is notified — the child simply stops
 * appearing in their app.
 */
export async function revokeAccessAction(formData: FormData) {
  const childId = field(formData, "childId");
  const userId = field(formData, "userId");
  const supabase = await createClient();
  await supabase.rpc("revoke_child_access", { p_child_id: childId, p_user_id: userId });
  revalidatePath(`/barn/${childId}`, "layout");
  redirect(`/barn/${childId}/tillgang`);
}

/**
 * Take an invite. Everything that decides the outcome — which child, which
 * role, whether the link is still good — is read from the invite row inside the
 * database; the only thing sent from here is the token itself.
 */
export async function acceptInviteAction(formData: FormData) {
  const token = field(formData, "token");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_child_invite", {
    p_token_hash: hashInviteToken(token),
  });

  if (error || !data) {
    // Back to the link, which re-reads its own state and says what happened. A
    // race — two people opening the same link — lands here as "already used".
    redirect(`/i/${encodeURIComponent(token)}?fel=1`);
  }

  revalidatePath("/barn", "layout");
  redirect(`/barn/${data as string}`);
}
