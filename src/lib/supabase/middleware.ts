import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the auth session on every request and keeps signed-out visitors out
 * of the app. Anything under /barn requires a session; the reference and the
 * sign-in page do not.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

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
