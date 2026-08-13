/**
 * Who may do what with a child, as data.
 *
 * The database has three roles from the first migration — `owner`, `editor`,
 * `viewer` — and sharing uses two of them:
 *
 *   owner   "Delar ansvaret", co-manage. Every owner row on a child is equal to
 *           every other: there is no primary account, which is the point. The
 *           role is permanent; nothing removes it.
 *   viewer  "Kan se", view-only. Removable by any co-manager.
 *
 * `editor` is unused. It predates the design and would be a third, weaker
 * co-manager — worth keeping in the enum for a role that can add measurements
 * without being permanent, but nothing creates it today. It is treated as a
 * writer everywhere here so a future row cannot silently lose its write access.
 *
 * Everything in this file is pure: no database, no React. The rules that matter
 * are enforced in Postgres (see the sharing migration); these are the same
 * rules restated so the UI can offer the right things rather than offer
 * everything and let the server refuse.
 */

export type ChildRole = "owner" | "editor" | "viewer";

/** The two roles the product names. */
export type SharedRole = "guardian" | "viewer";

export type AccessMember = {
  userId: string;
  displayName: string;
  role: ChildRole;
  /** When the membership was created, as an ISO timestamp. */
  since: string;
  isSelf: boolean;
};

export function sharedRole(role: ChildRole): SharedRole {
  return role === "viewer" ? "viewer" : "guardian";
}

/** The database role an invite of each kind grants. */
export const INVITE_ROLE: Record<SharedRole, ChildRole> = {
  guardian: "owner",
  viewer: "viewer",
};

export function isViewer(role: ChildRole | null): boolean {
  return role === "viewer";
}

/** Adding and editing measurements, and editing the child. */
export function canEdit(role: ChildRole | null): boolean {
  return role === "owner" || role === "editor";
}

/**
 * The reading and the attention card. Deliberately not the same test as
 * `canEdit`: what a view-only user is refused is the *interpretation*, not the
 * numbers, and those are two separate ideas even though one role currently
 * fails both.
 */
export function canRead(role: ChildRole | null): boolean {
  return role !== null && !isViewer(role);
}

/** Inviting others and removing view-only access. Co-managers only. */
export function canManageAccess(role: ChildRole | null): boolean {
  return role === "owner";
}

/**
 * A co-manager can never be removed, by anyone, including themselves. A
 * view-only member can be removed by any co-manager but not by themselves —
 * leaving a child you were shared into is not designed yet.
 */
export function canRemoveMember(viewerRole: ChildRole | null, member: AccessMember): boolean {
  return canManageAccess(viewerRole) && member.role === "viewer" && !member.isSelf;
}

/** A co-manager other than you: the row that says it cannot be undone. */
export function isPermanentMember(member: AccessMember): boolean {
  return member.role !== "viewer" && !member.isSelf;
}

/** Attribution only exists once someone else is actually in here. */
export function isShared(access: AccessMember[]): boolean {
  return access.length > 1;
}

/**
 * Who wrote a measurement, for "lagt in av …". Returns null when the child is
 * not shared (nothing to attribute), when the row predates attribution, or when
 * the author is no longer someone we can name — better silent than wrong.
 */
export function authorName(
  access: AccessMember[],
  createdBy: string | null,
  selfLabel: string,
): string | null {
  if (!isShared(access) || createdBy === null) return null;
  const member = access.find((entry) => entry.userId === createdBy);
  if (!member) return null;
  return member.isSelf ? selfLabel : member.displayName;
}

/** "3 personer · du, Erik, Ingrid" — the summary on the child's home screen. */
export function accessSummary(
  access: AccessMember[],
  labels: { alone: string; count: (people: number) => string; you: string },
): { count: string; names: string } {
  return {
    count: access.length === 1 ? labels.alone : labels.count(access.length),
    names: access.map((entry) => (entry.isSelf ? labels.you : entry.displayName)).join(", "),
  };
}

/** The first letter of a name, for the avatar. */
export function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}
