import "server-only";

import { createHash, randomBytes } from "node:crypto";

/** Spec §7.2 / §4: 32 bytes of randomness, 72-hour life, single use. */
export const INVITE_TOKEN_BYTES = 32;
export const INVITE_TTL_HOURS = 72;

/** base64url of 32 bytes. Unpadded, so it is 43 characters and URL-safe. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type IssuedToken = { token: string; tokenHash: string };

/**
 * The raw token exists in exactly two places: this return value, which goes
 * straight into the emailed link, and the recipient's inbox. `invites` stores
 * only the digest, so a dump of that table — or an owner reading it through
 * `invites_all_owner` — yields nothing that can be redeemed.
 *
 * SHA-256 without a work factor is the right choice here and would be the wrong
 * one for a password: the preimage is 256 bits of CSPRNG output, so there is no
 * dictionary to run and stretching would only slow the lookup down.
 */
export function createInviteToken(): IssuedToken {
  const token = randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Cheap shape check before the digest is computed and the table is queried. It
 * is not a security boundary — a well-formed guess is still refused by the
 * lookup — it just keeps arbitrary path segments from becoming database work.
 */
export function isWellFormedInviteToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function inviteExpiryFrom(now: Date = new Date()): string {
  return new Date(now.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

export function inviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/invite/${token}`;
}
