/**
 * The invite landing page.
 *
 * This is the one screen someone can reach before they have an account, and the
 * only one that has to explain itself from nothing. What matters here: a live
 * link says who shared what and warns about permanence before there is any way
 * to accept, and a dead link says so without naming the child.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import type { InvitePreview } from "@/lib/db";

let preview: InvitePreview = { status: "missing" };
let signedIn = true;

vi.mock("@/lib/db", () => ({
  getInvitePreview: async () => preview,
  isSignedIn: async () => signedIn,
}));

vi.mock("@/app/actions", () => ({ acceptInviteAction: async () => {} }));

const { default: InviteLandingPage } = await import("./page");

const TOKEN = "aaaaaaaaaaaaaaaaaaaaaa";

async function render(token = TOKEN, fel?: string): Promise<string> {
  const element = await InviteLandingPage({
    params: Promise.resolve({ token }),
    searchParams: Promise.resolve({ fel }),
  });
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

const live: InvitePreview = {
  status: "ok",
  childId: "c1",
  childName: "Elsa",
  childSex: "female",
  role: "viewer",
  invitedBy: "Erik",
  alreadyMember: false,
};

describe("an invite link", () => {
  beforeEach(() => {
    preview = live;
    signedIn = true;
  });

  it("says who shared what, and what joining means", async () => {
    const html = await render();
    expect(html).toContain("Erik har delat Elsa med dig");
    expect(html).toContain("hamnar hon i din app");
    expect(html).toContain("Kan se");
    expect(html).toContain("Gå med");
  });

  it("warns that co-management is permanent, before joining", async () => {
    preview = { ...live, role: "owner", childSex: "male", childName: "Vidar" };
    const html = await render();
    expect(html).toContain("Delar ansvaret");
    expect(html).toContain("Att dela ansvaret är permanent");
    expect(html).toContain("hamnar han i din app");
  });

  it("says nothing about permanence for a view-only link", async () => {
    const html = await render();
    expect(html).not.toContain("permanent");
  });

  it("sends someone without an account to sign in, and back", async () => {
    signedIn = false;
    const html = await render();
    expect(html).toContain("Logga in för att gå med");
    expect(html).toContain(`/logga-in?retur=%2Fi%2F${TOKEN}`);
  });

  it("does not name the child behind a used link", async () => {
    preview = { status: "used" };
    const html = await render();
    expect(html).toContain("redan använd");
    expect(html).not.toContain("Elsa");
    expect(html).not.toContain("Gå med");
  });

  it("says a link has run out of time", async () => {
    preview = { status: "expired" };
    const html = await render();
    expect(html).toContain("gått ut");
  });

  it("treats a token that is not shaped like one as a dead link", async () => {
    // Never reaches the database: the preview stub would have said "ok".
    const html = await render("not a token");
    expect(html).toContain("stämmer inte");
  });

  it("points an existing member at the child instead of joining twice", async () => {
    preview = { ...live, alreadyMember: true };
    const html = await render();
    expect(html).toContain("Du har redan tillgång till Elsa");
    expect(html).toContain("/barn/c1");
  });
});
