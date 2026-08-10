import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitRule = {
  /** Bucket namespace, e.g. `intake:ip`. Keeps the two forms' budgets apart. */
  scope: string;
  max: number;
  /** Postgres interval literal, e.g. `1 hour`. */
  window: string;
};

export const RATE_LIMITS = {
  contactIp: { scope: "contact:ip", max: 5, window: "1 hour" },
  contactEmail: { scope: "contact:email", max: 3, window: "1 hour" },
  intakeIp: { scope: "intake:ip", max: 5, window: "1 hour" },
  intakeEmail: { scope: "intake:email", max: 3, window: "1 hour" },

  /* Auth surfaces. Two budgets per attempt, and they answer different attacks:
     the per-IP one bounds a spray across many accounts from one source, the
     per-identifier one bounds a guessing run against one account from many
     sources. Either alone leaves the other wide open.

     15 minutes rather than an hour: a real person mistyping a password twice
     should not be locked out for the rest of the morning, and the window only
     has to be long enough to make online guessing pointless — which at 10
     attempts per quarter hour it already is.

     The invite budgets are tighter because the secret is longer. 43 characters
     of base64url is not guessable at any rate; what these bound is somebody
     grinding the accept endpoint to learn which tokens exist, and 20 shape-valid
     attempts an hour makes that measurement worthless while leaving room for a
     homeowner who fumbles the password rules a few times. */
  loginIp: { scope: "login:ip", max: 20, window: "15 minutes" },
  loginEmail: { scope: "login:email", max: 10, window: "15 minutes" },
  inviteAcceptIp: { scope: "invite-accept:ip", max: 20, window: "1 hour" },
  inviteAcceptToken: { scope: "invite-accept:token", max: 10, window: "1 hour" },
  mfaVerifyUser: { scope: "mfa-verify:user", max: 10, window: "15 minutes" },
} as const satisfies Record<string, RateLimitRule>;

/**
 * An unresolvable client IP is a bucket of its own, never a skipped check —
 * otherwise stripping `x-forwarded-for` is all it takes to opt out of the limit.
 */
export const UNKNOWN_IP = "unknown";

/**
 * First entry of `x-forwarded-for` (the client as seen by the edge), falling
 * back to `x-real-ip`. Later entries are proxy hops and are attacker-controlled
 * on the left, so only the first is read.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  return UNKNOWN_IP;
}

/**
 * `null` when the header is absent or unparseable — `leads.ip` / `consents.ip`
 * are `inet`, and Postgres rejects a literal `unknown`.
 */
export function inetOrNull(ip: string): string | null {
  if (!ip || ip === UNKNOWN_IP) return null;
  const bare = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(bare);
  const isIpv6 = /^[0-9a-fA-F:]+$/.test(ip) && ip.includes(":");
  return isIpv4 || isIpv6 ? ip : null;
}

/**
 * Wraps the SECURITY DEFINER `public.check_rate_limit(p_key, p_max, p_window)`.
 * Returns true when the call is within budget. Fails closed: an RPC error
 * counts as "over limit" rather than waving the request through.
 */
export async function checkRateLimit(
  rule: RateLimitRule,
  identifier: string,
): Promise<boolean> {
  const key = `${rule.scope}:${identifier.trim().toLowerCase()}`;
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max: rule.max,
    p_window: rule.window,
  });

  if (error) {
    console.error("[rate-limit] rpc failed", { scope: rule.scope, error: error.message });
    return false;
  }

  return data === true;
}

/**
 * Per-IP then per-email, in that order and short-circuiting: a request already
 * refused on its IP must not also spend the address's budget, or an attacker
 * could lock a stranger out of the form from a single throwaway address.
 */
export async function checkFormRateLimits(input: {
  ipRule: RateLimitRule;
  emailRule: RateLimitRule;
  ip: string;
  email: string | null;
}): Promise<boolean> {
  const ipOk = await checkRateLimit(input.ipRule, input.ip);
  if (!ipOk) return false;

  if (!input.email) return true;

  return checkRateLimit(input.emailRule, input.email);
}
