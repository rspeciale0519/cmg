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
 * How many proxies sit between the internet and this app, all of which are
 * ours and therefore trusted to have appended honestly.
 *
 * One by default, which is the Vercel deployment this product targets: the
 * platform's edge is the single hop. Set `TRUSTED_PROXY_HOPS` if a CDN or a
 * load balancer is put in front of it — the number must match the real chain,
 * because it is the count of entries at the *right* of the header that were
 * written by something we control.
 */
export const TRUSTED_PROXY_HOPS = readTrustedHops();

function readTrustedHops(): number {
  const parsed = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 8 ? parsed : 1;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}(%[0-9a-z]{1,16})?$/i;

/**
 * One `x-forwarded-for` entry, reduced to a bare address or rejected.
 *
 * Entries legally carry a port (`192.0.2.1:443`, `[2001:db8::1]:443`), and
 * anything that is not an address at all is thrown away rather than passed on:
 * the value becomes part of `rate_limits.key`, and an unvalidated header is an
 * unbounded key space in a table that is written to on every form post.
 */
function normaliseIp(raw: string): string | null {
  let value = raw.trim();
  if (value.length === 0 || value.length > 64) return null;

  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(value);
  if (bracketed) value = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/.test(value)) value = value.split(":")[0];

  // Postgres accepts `::ffff:203.0.113.9` as inet, but two spellings of one
  // address are two rate-limit buckets, so the mapped form is unwrapped.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) value = mapped[1];

  if (IPV4.test(value)) return value;
  if (value.includes(":") && IPV6.test(value)) return value.toLowerCase();
  return null;
}

/**
 * The client address, taken from the last hop this deployment actually trusts.
 *
 * `x-forwarded-for` grows left to right: each proxy *appends* the peer it
 * received the request from, so the rightmost entries are the ones written by
 * infrastructure and the leftmost is whatever the original client sent —
 * including a client that invented the whole prefix. Reading `split(",")[0]`
 * therefore reads the one entry nobody vouched for. It was reproducible: a
 * request carrying `X-Forwarded-For: 203.0.113.77, 10.0.0.5, 10.0.0.6` wrote
 * `audit_log.ip = 203.0.113.77`, and behind any appending proxy an attacker
 * gets a fresh rate-limit bucket per request simply by rotating the header.
 *
 * (The comment this replaces had the direction exactly backwards — it said the
 * left was attacker-controlled and then read the left.)
 *
 * So the address is counted in from the right by the number of hops we own:
 * with one trusted proxy the entry it appended is the last one, and everything
 * a client sent ahead of it is ignored. When the header is shorter than the
 * configured chain the leftmost entry is all there is; that means the request
 * did not arrive the way the deployment says it does, and the value is still
 * validated before it is used as a key.
 */
export function clientIpFromHeaders(
  headers: Headers,
  trustedHops: number = TRUSTED_PROXY_HOPS,
): string {
  const forwarded = headers.get("x-forwarded-for");

  if (forwarded) {
    const entries = forwarded.split(",");
    const index = Math.max(0, entries.length - trustedHops);
    // Walk left from the trusted position: a proxy that appended something
    // unparseable should cost one hop of precision, not the whole check.
    for (let at = index; at >= 0; at -= 1) {
      const candidate = normaliseIp(entries[at] ?? "");
      if (candidate) return candidate;
    }
  }

  /* `x-real-ip` only when the trusted chain wrote nothing at all. It is a
     single value set by nginx-style proxies, and on a deployment where the
     chain is present and correct it never has to be consulted — which is the
     point: if it is being read, no proxy of ours has spoken, so it is treated
     as one more unvouched-for claim and merely has to look like an address. */
  const real = normaliseIp(headers.get("x-real-ip") ?? "");
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
