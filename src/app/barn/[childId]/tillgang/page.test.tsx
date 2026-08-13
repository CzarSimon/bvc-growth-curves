/**
 * The access screen, with the data layer stubbed.
 *
 * What is worth asserting here is not the layout but the asymmetry: a
 * co-manager's row says it can never be removed, a view-only row offers the
 * removal, and a view-only *reader* of this screen is offered neither that nor
 * the invite button.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import type { Child } from "@/lib/child-data";
import type { AccessMember, ChildRole } from "@/lib/access";

const child: Child = {
  id: "c1",
  name: "Elsa",
  sex: "female",
  birthDate: "2025-08-10",
  gestationWeeks: 39,
  gestationDays: 2,
};

const me: AccessMember = {
  userId: "u1",
  displayName: "Du",
  role: "owner",
  since: "2025-08-10T09:00:00Z",
  isSelf: true,
};
const erik: AccessMember = {
  userId: "u2",
  displayName: "Erik",
  role: "owner",
  since: "2025-09-01T09:00:00Z",
  isSelf: false,
};
const ingrid: AccessMember = {
  userId: "u3",
  displayName: "Ingrid",
  role: "viewer",
  since: "2026-01-15T09:00:00Z",
  isSelf: false,
};

let myRole: ChildRole = "owner";
let access: AccessMember[] = [me];

vi.mock("@/lib/db", () => ({
  getChild: async () => child,
  getMyRole: async () => myRole,
  listChildAccess: async () => access,
}));

// The revoke form's action. Next replaces this import with a reference across
// the client boundary; outside the bundler it would drag the whole server-only
// data layer into a client component.
vi.mock("@/app/actions", () => ({ revokeAccessAction: async () => {} }));

const { default: AccessPage } = await import("./page");

async function render(): Promise<string> {
  const element = await AccessPage({ params: Promise.resolve({ childId: child.id }) });
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

describe("the access screen", () => {
  beforeEach(() => {
    myRole = "owner";
    access = [me, erik, ingrid];
  });

  it("says a co-manager cannot be removed, and by whom", async () => {
    const html = await render();
    expect(html).toContain("Delar ansvaret");
    expect(html).toContain("Kan inte tas bort — varken av dig eller av Erik");
  });

  it("offers to remove a view-only person", async () => {
    const html = await render();
    expect(html).toContain("Kan se");
    expect(html).toContain("Ta bort tillgång");
  });

  it("never offers to remove you from your own child", async () => {
    access = [me];
    const html = await render();
    expect(html).not.toContain("Ta bort tillgång");
    expect(html).not.toContain("Kan inte tas bort");
  });

  it("gives a view-only reader the list and nothing to do with it", async () => {
    myRole = "viewer";
    access = [erik, ingrid, { ...me, role: "viewer" }];
    const html = await render();
    // They see who else is here — that is what the screen is for.
    expect(html).toContain("Erik");
    expect(html).toContain("Ingrid");
    // But no way to invite anyone or to remove the other view-only guest.
    expect(html).not.toContain("Bjud in någon");
    expect(html).not.toContain("Ta bort tillgång");
  });
});
