import { describe, expect, it } from "vitest";
import {
  accessSummary,
  authorName,
  canEdit,
  canManageAccess,
  canRead,
  canRemoveMember,
  initial,
  isPermanentMember,
  sharedRole,
  type AccessMember,
} from "./access";

function member(overrides: Partial<AccessMember> = {}): AccessMember {
  return {
    userId: "u1",
    displayName: "Erik",
    role: "owner",
    since: "2026-03-03T10:00:00Z",
    isSelf: false,
    ...overrides,
  };
}

const LABELS = { alone: "Bara du", count: (n: number) => `${n} personer`, you: "du" };

describe("roles", () => {
  it("names the two roles the product has", () => {
    expect(sharedRole("owner")).toBe("guardian");
    expect(sharedRole("editor")).toBe("guardian");
    expect(sharedRole("viewer")).toBe("viewer");
  });

  it("lets a co-manager do everything and a view-only user read", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canRead("owner")).toBe(true);
    expect(canManageAccess("owner")).toBe(true);

    expect(canEdit("viewer")).toBe(false);
    expect(canRead("viewer")).toBe(false);
    expect(canManageAccess("viewer")).toBe(false);
  });

  it("gives someone with no membership nothing", () => {
    expect(canEdit(null)).toBe(false);
    expect(canRead(null)).toBe(false);
    expect(canManageAccess(null)).toBe(false);
  });
});

describe("removing someone", () => {
  it("never offers to remove a co-manager", () => {
    expect(canRemoveMember("owner", member({ role: "owner" }))).toBe(false);
    expect(isPermanentMember(member({ role: "owner" }))).toBe(true);
  });

  it("lets a co-manager remove a view-only person", () => {
    expect(canRemoveMember("owner", member({ role: "viewer" }))).toBe(true);
  });

  it("does not let a view-only user remove anyone, including themselves", () => {
    expect(canRemoveMember("viewer", member({ role: "viewer" }))).toBe(false);
    expect(canRemoveMember("viewer", member({ role: "viewer", isSelf: true }))).toBe(false);
  });

  it("does not offer you a way out of your own co-management", () => {
    expect(canRemoveMember("owner", member({ role: "owner", isSelf: true }))).toBe(false);
    // Your own row never carries the "cannot be removed" sentence either — it
    // is about the other person's rights, not yours.
    expect(isPermanentMember(member({ role: "owner", isSelf: true }))).toBe(false);
  });
});

describe("attribution", () => {
  const me = member({ userId: "u1", displayName: "Du", isSelf: true });
  const erik = member({ userId: "u2", displayName: "Erik" });

  it("says nothing at all when the child is not shared", () => {
    expect(authorName([me], "u1", "dig")).toBeNull();
  });

  it("names the other person, and calls you you", () => {
    expect(authorName([me, erik], "u2", "dig")).toBe("Erik");
    expect(authorName([me, erik], "u1", "dig")).toBe("dig");
  });

  it("stays silent rather than guessing for an unknown author", () => {
    // Rows written before attribution existed, and rows by an account since
    // deleted. Falling back to "dig" would put someone else's entry in your
    // name.
    expect(authorName([me, erik], null, "dig")).toBeNull();
    expect(authorName([me, erik], "u3", "dig")).toBeNull();
  });
});

describe("the access summary", () => {
  it("says 'bara du' for a child nobody else can see", () => {
    expect(accessSummary([member({ isSelf: true, displayName: "Du" })], LABELS)).toEqual({
      count: "Bara du",
      names: "du",
    });
  });

  it("counts the household and lists it in membership order", () => {
    const summary = accessSummary(
      [
        member({ userId: "u1", displayName: "Du", isSelf: true }),
        member({ userId: "u2", displayName: "Erik" }),
        member({ userId: "u3", displayName: "Ingrid", role: "viewer" }),
      ],
      LABELS,
    );
    expect(summary).toEqual({ count: "3 personer", names: "du, Erik, Ingrid" });
  });
});

describe("initials", () => {
  it("takes the first letter, uppercased", () => {
    expect(initial("erik")).toBe("E");
    expect(initial(" Åsa")).toBe("Å");
  });

  it("does not split an emoji or crash on an empty name", () => {
    expect(initial("")).toBe("?");
  });
});
