import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Keeps signed-out visitors out of the app, and refreshes the session while it
 * is here. Anything under /barn requires a session; the reference and the
 * sign-in page do not.
 *
 * Only the paths that gate on a session are inspected at all — see the early
 * return below. That means the session is refreshed on those paths rather than
 * on every request, which is enough: they are the only ones that read data.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isProtected = path === "/" || path.startsWith("/barn");
  const isSignIn = path === "/logga-in";

  // Everything else — the reference pages, invite links, the manifest, and
  // every RSC prefetch of them — never branches on who is asking, so asking
  // would compute an answer and throw it away. The matcher in proxy.ts is
  // deliberately wide (it has to be, to catch every route that *is* gated),
  // which makes this the line that keeps the auth check off the majority of
  // requests rather than a micro-optimisation.
  if (!isProtected && !isSignIn) return response;

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

  // `getClaims()` rather than `getUser()`: it verifies the token's signature
  // locally against a cached JWKS, where `getUser()` is a network round trip to
  // the auth server by design — one that ran ahead of every page render.
  //
  // The cost is that this gate no longer notices a session revoked mid-window;
  // someone signed out on another device keeps getting past the redirect until
  // their access token expires. They see nothing: every table is behind RLS and
  // PostgREST re-validates the token server-side on every query, so what
  // weakens here is the redirect, not the boundary. The token lifetime in
  // `supabase/config.toml` is what bounds that window.
  //
  // This requires the project to sign with an asymmetric key. Against a
  // symmetric secret `getClaims()` falls back to asking the server, which is
  // correct but gives back none of the latency.
  //
  // If Supabase cannot be reached we cannot prove anyone is signed in, so the
  // safe reading is that nobody is.
  let signedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    signedIn = data?.claims.sub != null;
  } catch {
    signedIn = false;
  }

  if (!signedIn && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/logga-in";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  if (signedIn && isSignIn) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/barn";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}
