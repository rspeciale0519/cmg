import "server-only";

import { isIP } from "node:net";

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

/**
 * `net.isIP` and not a regular expression.
 *
 * The hand-rolled IPv6 pattern that used to live here was
 * `^[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}(%[0-9a-z]{1,16})?$`, and `{0,4}` means
 * *every* group may be empty. `:::`, `::::::` and `abcd::::::` all matched. They
 * are not addresses, and they did not stop at this function: the value became
 * `audit_log.ip`, which is `inet`, and Postgres answered `invalid input syntax
 * for type inet`. `writeAudit` swallows its errors by design — an audit write
 * must never fail the user's request — so the outcome was a silently missing
 * audit row for a request an attacker chose, by setting one header.
 *
 * The tempting reply is a stricter regex. A correct IPv6 pattern has to count
 * groups either side of a single `::`, reject a second `::`, and allow a
 * dotted-quad tail — it is long, it is write-only, and it is the third attempt
 * at it in this file. Node already ships the answer: `isIP` returns 4, 6 or 0
 * and is the same parser the runtime uses.
 *
 * `isIP` is necessary and not quite sufficient, which is worth stating because it
 * is the residue of the same bug. Node accepts a zone index — `net.isIP(
 * "fe80::1%eth0")` is 6 on Node 22 — and Postgres does not: `select
 * 'fe80::1%eth0'::inet` is `invalid input syntax for type inet`. Swapping the
 * regex for `isIP` alone would therefore have left one spelling still reaching
 * the column and still being swallowed. So `%` is refused here explicitly.
 *
 * Refused rather than stripped: a scope identifier names an interface on the
 * machine that wrote it, so it cannot be a remote client's address in the first
 * place, and stripping would merge `fe80::1%eth0` and `fe80::1%eth1` into one
 * rate-limit bucket. These fall through to the `unknown` bucket instead, which
 * is a bucket rather than a skipped check.
 */
function ipVersion(value: string): 0 | 4 | 6 {
  if (value.includes("%")) return 0;
  return isIP(value) as 0 | 4 | 6;
}

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

  const version = ipVersion(value);
  if (version === 4) return value;
  if (version === 6) return value.toLowerCase();
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
  /* The same `net.isIP` as `normaliseIp`, because this is the last check before
     an `inet` column and it used to be looser than the one upstream of it:
     `/^[0-9a-fA-F:]+$/` admitted `::::::` and `:::` on its own, so a caller
     handing this function a value that did not come through `normaliseIp` had no
     guard at all. Two spellings of one rule is one rule too many when the
     failure is a swallowed audit write. */
  return ipVersion(ip) === 0 ? null : ip;
}

/**
 * The longest an identifier may contribute to `rate_limits.key`.
 *
 * 254 because that is RFC 5321's maximum for an email address, which is the
 * longest legitimate identifier any caller passes — an IPv6 address with a zone
 * index is under 50 characters and an invite-token digest is fixed-length hex.
 * So the cap never truncates real input; it only bounds hostile input.
 */
const MAX_IDENTIFIER_LENGTH = 254;

/**
 * Normalises and *bounds* the caller-supplied half of a rate-limit key.
 *
 * Every caller of `checkRateLimit` rate-limits before validating — deliberately,
 * because validation is work and the limiter exists to stop an attacker making
 * this process do work. The consequence is that raw form input reaches
 * `rate_limits.key`, which is unbounded `text` and half of the table's primary
 * key, and until now nothing capped it. Two failures followed from that:
 *
 *   * A key seen once was never collected — see the prune in
 *     `public.check_rate_limit()`. Verified against this build: a 3007-character
 *     key was accepted and stored, and an attacker varying the value each post
 *     grows the table one permanent row at a time.
 *   * Past roughly 2700 bytes the row no longer fits a btree tuple, so the
 *     INSERT raises, `checkRateLimit` fails closed as designed, and the login
 *     form tells the person "too many attempts" for what is actually a malformed
 *     submission. The advice that follows — wait and try again — never works,
 *     because the next attempt fails the same way.
 *
 * Truncating rather than rejecting: two hostile identifiers sharing a 254-character
 * prefix collapse into one bucket, which spends one budget instead of two and so
 * errs towards limiting more, not less. Rejecting here would mean deciding what a
 * valid identifier looks like in the one place that must not care.
 */
export function rateLimitIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase().slice(0, MAX_IDENTIFIER_LENGTH);
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
  const key = `${rule.scope}:${rateLimitIdentifier(identifier)}`;
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
