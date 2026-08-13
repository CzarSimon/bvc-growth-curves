import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { INVITE_PATH } from "./invite-path";
import { SITE_URL } from "./site";

export { INVITE_PATH };

/**
 * Invite tokens.
 *
 * The token exists in the link and nowhere else. What the database stores is
 * its SHA-256, so a leaked backup, a log line or a stray database dump cannot
 * be replayed into access to a child.
 *
 * 128 bits of randomness, base64url, 22 characters. The design's prototype
 * shows a six-character code, which is short enough to be worth guessing at
 * scale for something that grants permanent access to a child's health data;
 * this is still short enough to survive an SMS.
 */
export function newInviteToken(): string {
  return randomBytes(16).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Tokens arrive from a URL, so anything can be in them. The hash is checked
 * against a `^[0-9a-f]{64}$` constraint in the database, but a token that is
 * not shaped like one of ours never needs to reach it.
 */
export function isPlausibleToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(token);
}

/**
 * Where the link points. The deployment's own origin rather than the
 * configured domain, so a link made on a preview deployment or on localhost
 * leads back to the app the parent is actually looking at — a link to a domain
 * that does not resolve yet is worse than an ugly one.
 */
export async function inviteUrl(token: string): Promise<string> {
  const path = `${INVITE_PATH}/${token}`;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return `${SITE_URL}${path}`;
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}${path}`;
}
