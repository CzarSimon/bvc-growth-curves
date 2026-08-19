/**
 * Sign-up, with Supabase and Next's navigation stubbed.
 *
 * What is worth pinning here is the one thing the form cannot show and the
 * validation tests cannot see: which name, if any, reaches the auth call. An
 * empty field must send none at all, because the database's derived name is the
 * fallback and a blank string sent as metadata would sit in front of it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type SignUpArgs = {
  email: string;
  password: string;
  options?: { data?: { display_name?: string } };
};

const signUp = vi.fn<(args: SignUpArgs) => Promise<{ error: null }>>(async () => ({
  error: null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// Next's redirect throws to unwind the action; the tests below run past the
// call, so this one only records that it happened.
vi.mock("next/navigation", () => ({ redirect: () => {} }));

const { signUpAction } = await import("./actions");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

const account = { email: "erik@example.com", password: "lösenord123" };

describe("creating an account", () => {
  beforeEach(() => {
    signUp.mockClear();
  });

  it("sends the name the parent typed", async () => {
    await signUpAction(null, form({ ...account, displayName: " Erik  Svensson " }));
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: { data: { display_name: "Erik Svensson" } } }),
    );
  });

  it("sends no name at all when the field is left empty", async () => {
    await signUpAction(null, form({ ...account, displayName: "   " }));
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ options: undefined }));
  });

  it("lets two people register the same name", async () => {
    await signUpAction(null, form({ ...account, displayName: "Anna Nilsson" }));
    await signUpAction(
      null,
      form({ email: "anna@example.com", password: "lösenord123", displayName: "Anna Nilsson" }),
    );
    expect(signUp).toHaveBeenCalledTimes(2);
    for (const [args] of signUp.mock.calls) {
      expect(args.options?.data?.display_name).toBe("Anna Nilsson");
    }
  });

  it("refuses a name longer than the profile stores, before creating anything", async () => {
    const state = await signUpAction(null, form({ ...account, displayName: "N".repeat(61) }));
    expect(state?.errors.displayName).toBe("Namnet får vara högst 60 tecken.");
    expect(signUp).not.toHaveBeenCalled();
  });
});
