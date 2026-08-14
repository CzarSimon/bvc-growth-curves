import "server-only";

import { cache } from "react";
import { createClient } from "./supabase/server";
import { gramsToKg, mmToCm, type Sex } from "./growth";
import type { AccessMember, ChildRole } from "./access";
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
  created_by: string | null;
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
    createdBy: row.created_by,
  };
}

const CHILD_COLUMNS = "id, name, sex, birth_date, gestation_weeks, gestation_days";
const MEASUREMENT_COLUMNS =
  "id, child_id, measured_on, weight_grams, length_mm, head_mm, created_by";

/**
 * Row-level security scopes this to the signed-in user's children.
 *
 * Memoised per request, like everything else here: the layout needs the list
 * for the child switcher, and /barn needs it to decide where to redirect.
 */
export const listChildren = cache(async (): Promise<Child[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .select(CHILD_COLUMNS)
    .order("birth_date", { ascending: true });
  if (error) throw error;
  return (data as ChildRow[]).map(toChild);
});

/**
 * Memoised because the layout and the screen inside it both need the child —
 * the layout to title the shell, the screen to render it. Without this every
 * navigation under /barn/[childId] fetched the same row twice.
 */
export const getChild = cache(async (childId: string): Promise<Child | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .select(CHILD_COLUMNS)
    .eq("id", childId)
    .maybeSingle();
  if (error) throw error;
  return data ? toChild(data as ChildRow) : null;
});

export const listMeasurements = cache(async (childId: string): Promise<Measurement[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("measurements")
    .select(MEASUREMENT_COLUMNS)
    .eq("child_id", childId)
    .order("measured_on", { ascending: true });
  if (error) throw error;
  return (data as MeasurementRow[]).map(toMeasurement);
});

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

// ------------------------------------------------------------------ access --

/**
 * Whether anyone is signed in. The invite screen is the one screen a person can
 * reach before they have an account, so it has to ask.
 *
 * `getClaims()` verifies the token locally; see the note in
 * `lib/supabase/middleware.ts` for why, and for what that gives up. Nothing
 * here reads data — the answer only picks which of two buttons the invite
 * screen shows — so a token that is valid but revoked costs nothing.
 */
export const isSignedIn = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub != null;
});

/**
 * The signed-in user's role on a child, or null if they have none.
 *
 * A function rather than a select on child_members, so the answer comes from
 * one round trip and from `auth.uid()` on the database side — the caller never
 * gets to say who it is.
 *
 * Memoised per request: the layout asks (to decide whether the add button
 * exists) and so does the screen inside it.
 */
export const getMyRole = cache(async (childId: string): Promise<ChildRole | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_child_role", { p_child_id: childId });
  if (error) throw error;
  return (data as ChildRole | null) ?? null;
});

type AccessRow = {
  user_id: string;
  display_name: string;
  role: ChildRole;
  since: string;
  is_self: boolean;
};

/** Everyone who has access to a child, oldest membership first. */
export const listChildAccess = cache(async (childId: string): Promise<AccessMember[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("child_access", { p_child_id: childId });
  if (error) throw error;
  return (data as AccessRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    since: row.since,
    isSelf: row.is_self,
  }));
});

export type InvitePreview =
  | {
      status: "ok";
      childId: string;
      childName: string;
      childSex: Sex;
      role: ChildRole;
      invitedBy: string;
      alreadyMember: boolean;
    }
  | { status: "used" | "expired" | "missing" };

type InvitePreviewRow = {
  status: string;
  child_id: string | null;
  child_name: string | null;
  child_sex: string | null;
  role: ChildRole | null;
  invited_by: string | null;
  already_member: boolean;
};

/**
 * What an invite link leads to, readable while signed out — the invitee decides
 * before they have an account. A link that is used, expired or wrong comes back
 * as a status and nothing else: a dead link is not a way to learn a child's
 * name.
 */
export async function getInvitePreview(tokenHash: string): Promise<InvitePreview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("child_invite_preview", {
    p_token_hash: tokenHash,
  });
  if (error) throw error;
  const row = (data as InvitePreviewRow[])[0];
  if (!row || row.status !== "ok" || !row.child_id) {
    const status = row?.status;
    return { status: status === "used" || status === "expired" ? status : "missing" };
  }
  return {
    status: "ok",
    childId: row.child_id,
    childName: row.child_name ?? "",
    childSex: (row.child_sex as Sex) ?? "female",
    role: row.role ?? "viewer",
    invitedBy: row.invited_by ?? "Någon",
    alreadyMember: row.already_member,
  };
}
