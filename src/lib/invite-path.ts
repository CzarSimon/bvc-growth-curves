/**
 * Where invite links live. Its own module because `next.config.ts` needs it to
 * attach headers to the route, and `lib/invite.ts` — which is the natural home
 * for it — is `server-only` and pulls in `next/headers` and `node:crypto`,
 * neither of which belongs in the build config.
 */
export const INVITE_PATH = "/i";
