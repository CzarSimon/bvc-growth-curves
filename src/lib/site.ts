/**
 * Where the app lives.
 *
 * The domain is barntillväxt.se, which contains `ä` and is therefore an IDN.
 * Everything that consumes a URL programmatically — TLS certificates, DNS,
 * Supabase redirect allowlists, OG tags — wants the punycode form:
 *
 *     barntillväxt.se  ->  xn--barntillvxt-t8a.se
 *
 * (Verified with `new URL("https://barntillväxt.se").hostname`; check it
 * against the registrar's own conversion before configuring anything. Note
 * that the design handoff quotes `xn--barntillvxt-p5a` — that string is not a
 * valid encoding of this label.)
 *
 * `SITE_NAME_DISPLAY` is the Unicode form and is the only one a human should
 * ever see. Keep the split: display Unicode, link punycode, or copy-paste and
 * link previews will disagree.
 *
 * Until DNS points at the deployment, `NEXT_PUBLIC_SITE_URL` overrides this —
 * set it to the Vercel URL so OG previews resolve.
 */
export const SITE_HOST = "xn--barntillvxt-t8a.se";

export const SITE_NAME_DISPLAY = "barntillväxt.se";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${SITE_HOST}`;
