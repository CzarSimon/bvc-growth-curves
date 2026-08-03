import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the auth session on every request and keeps signed-out visitors out
 * of the app. Anything under /barn requires a session; the reference and the
 * sign-in page do not.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Spelled out rather than read through a helper taking a name: Next inlines
  // literal `process.env.NEXT_PUBLIC_*` references into this bundle at build
  // time, and a computed lookup would come back undefined once deployed.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // With no Supabase to ask, the gate below cannot tell a signed-in visitor
    // from anyone else and waves everybody through. A half-configured checkout
    // can live with that; a deployment serving other families' measurements
    // cannot, so refuse loudly instead of quietly unlocking /barn.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. " +
          "Without them nobody can be authenticated and every child's data would " +
          "be readable. See README.md.",
      );
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // If Supabase cannot be reached we cannot prove anyone is signed in, so the
  // safe reading is that nobody is.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  const path = request.nextUrl.pathname;
  const isProtected = path === "/" || path.startsWith("/barn");

  if (!user && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/logga-in";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  if (user && path === "/logga-in") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/barn";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}
