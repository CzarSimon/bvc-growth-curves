import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in — see README.md.`,
    );
  }
  return value;
}

/** A Supabase client bound to the request's cookies. Server components and actions only. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a server component, where cookies are read-only.
            // The middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
