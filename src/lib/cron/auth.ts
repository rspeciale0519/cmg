import { constantTimeEquals } from "@/lib/esign/constant-time";

/**
 * The shared-secret gate on `/api/cron/*`.
 *
 * Kept apart from the route so its three refusals can be demonstrated against a
 * fabricated environment. The header format is `Authorization: Bearer <secret>`
 * because that is what Vercel Cron sends unprompted when `CRON_SECRET` is set on
 * the project — matching it means the schedule needs no custom header and the
 * secret never travels in a URL, where it would be logged by every proxy between
 * the scheduler and the function.
 */

export type CronVerdict =
  | { ok: true }
  | { ok: false; status: 401 | 503; reason: string };

/**
 * Refuses loudly when the secret is missing from the environment, and that is
 * the important case rather than the pedantic one.
 *
 * The tempting shape — "no secret configured, so let it through" — turns a
 * deployment that forgot one environment variable into an open endpoint that
 * drains a mail queue for anyone who guesses the path. The opposite default
 * fails visibly: the schedule starts returning 503, nothing is sent, and the
 * backlog on `/admin/settings` grows until someone looks. A stalled queue is
 * recoverable. An endpoint that anyone can drive is not.
 *
 * 503 and not 401, because the fault is ours and not the caller's, and the two
 * need to be distinguishable in a log when a schedule starts failing.
 */
export function authorizeCronRequest(headers: Headers): CronVerdict {
  const configured = process.env.CRON_SECRET?.trim();

  if (!configured) {
    console.error(
      "[cron] CRON_SECRET is not set — refusing every request to the scheduled endpoints",
    );
    return {
      ok: false,
      status: 503,
      reason: "This endpoint has no shared secret configured, so it refuses every request.",
    };
  }

  const header = headers.get("authorization") ?? "";
  const [scheme, ...rest] = header.split(" ");
  const presented = rest.join(" ").trim();

  if (scheme?.toLowerCase() !== "bearer" || presented.length === 0) {
    return {
      ok: false,
      status: 401,
      reason: "Expected an Authorization: Bearer header.",
    };
  }

  const encoder = new TextEncoder();
  if (!constantTimeEquals(encoder.encode(presented), encoder.encode(configured))) {
    return { ok: false, status: 401, reason: "That secret is not the one this endpoint holds." };
  }

  return { ok: true };
}
