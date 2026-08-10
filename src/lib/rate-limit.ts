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
