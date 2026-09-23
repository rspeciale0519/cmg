import "server-only";

import type { AMREntry } from "@supabase/supabase-js";
import { landingPathFor, type AppRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/authz";
import { PLATFORM_DISABLED_PATH } from "@/lib/site-mode";
import { createClient } from "@/lib/supabase/server";

/**
 * Password recovery, the parts shared by the request action, the
 * `/auth/confirm` handler and the reset screen.
 *
 * THE TOKEN'S PATH
 *
 * `auth.admin.generateLink({ type: "recovery" })` returns `hashed_token`, and
 * nothing else from that response leaves the server. The token goes into one
 * URL, into one email, sent once through Resend. `/auth/confirm` passes it to
 * `verifyOtp()` on the user-scoped client, which consumes it and writes the
 * recovery session into cookies. The token is never written to a table, to the
 * outbox, to an audit row or to a log line.
 */

/** Mirrors GoTrue's `otp_expiry` (3600 s locally and on hosted by default). */
export const RECOVERY_LINK_TTL_MINUTES = 60;

/**
 * How long after verifying the link the reset screen stays usable. The session
 * the link creates lasts as long as any other session, so this window is what
 * keeps a recovery session left open in a browser from working as a
 * "change the password without the old one" key later on.
 */
export const RECOVERY_SESSION_MAX_AGE_SECONDS = 15 * 60;

/**
 * The AMR methods GoTrue writes when `verifyOtp({ type: "recovery" })` creates
 * a session. Verified against the local stack: the claim is
 * `[{ method: "otp", timestamp }]`. Nothing else in this application creates an
 * `otp` session — there is no magic-link or email-code sign-in — so an `otp`
 * entry can only come from a recovery link. `recovery` is accepted in case a
 * later GoTrue names it directly; it can mean nothing else.
 */
const RECOVERY_AMR_METHODS: ReadonlySet<string> = new Set(["otp", "recovery"]);

/** Every refusal on these routes lands here, with one message. */
export const RECOVERY_EXPIRED_PATH = "/forgot-password?notice=link-expired";

/**
 * GoTrue's hashed token is lowercase hex (a SHA-224 digest, 56 characters,
 * today). The range leaves room for a digest change without admitting
 * anything that is not hex, so a hostile query string never reaches Auth.
 */
const TOKEN_HASH_PATTERN = /^[0-9a-f]{32,128}$/;

export function isWellFormedTokenHash(value: string): boolean {
  return TOKEN_HASH_PATTERN.test(value);
}

/**
 * The emailed link. `null` when the site origin is not configured in
 * production: a credential link pointed at `localhost` would be a dead link at
 * best and, on a shared machine, a link into someone else's development server.
 */
export function recoveryConfirmUrl(tokenHash: string): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base =
    configured && configured.length > 0
      ? configured
      : process.env.NODE_ENV === "production"
        ? null
        : "http://localhost:3000";
  if (!base) return null;

  const url = new URL("/auth/confirm", base.replace(/\/+$/, ""));
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "recovery");
  return url.toString();
}

/**
 * True when the session's AMR claim carries a recovery entry that is recent
 * enough. The string form of `amr` carries no timestamp, so it cannot prove
 * recency and is refused.
 */
export function hasRecentRecovery(
  amr: readonly (AMREntry | string)[] | undefined,
  now: number = Date.now(),
): boolean {
  if (!Array.isArray(amr)) return false;
  const nowSeconds = Math.floor(now / 1000);

  return amr.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      RECOVERY_AMR_METHODS.has(entry.method) &&
      typeof entry.timestamp === "number" &&
      entry.timestamp <= nowSeconds + 60 &&
      nowSeconds - entry.timestamp <= RECOVERY_SESSION_MAX_AGE_SECONDS,
  );
}

export type RecoverySession = {
  userId: string;
  email: string;
  aal: string;
  role: AppRole;
  /** The verified TOTP factor, when the account has one. */
  factorId: string | null;
  /**
   * GoTrue refuses a password change at aal1 once a verified factor exists
   * (`insufficient_aal`, verified against the local stack), so the reset
   * screen asks for a code first.
   */
  needsCode: boolean;
};

/**
 * The recovery session, or `null` for anything that is not one.
 *
 * Composed on `getSession()`, so the profile read runs under the caller's own
 * JWT and a deactivated account falls out exactly as it does everywhere else.
 * An ordinary signed-in session is refused: without the recovery AMR entry,
 * this screen would let a borrowed session change the password without the
 * current one.
 */
export async function getRecoverySession(
  now: number = Date.now(),
): Promise<RecoverySession | null> {
  const session = await getSession();
  if (!session || !session.email) return null;

  // The account's own surface must be open in this mode. In staff mode a
  // customer or partner holds a password for a portal that does not exist
  // here, so there is nothing for this screen to do for them.
  if (landingPathFor(session.role) === PLATFORM_DISABLED_PATH) return null;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims || claims.sub !== session.userId) return null;
  if (!hasRecentRecovery(claims.amr, now)) return null;

  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;

  const verified =
    factors?.totp?.find((factor) => factor.status === "verified") ?? null;

  return {
    userId: session.userId,
    email: session.email,
    aal: session.aal,
    role: session.role,
    factorId: verified?.id ?? null,
    needsCode: verified !== null && session.aal !== "aal2",
  };
}
