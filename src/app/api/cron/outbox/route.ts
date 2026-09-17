import { authorizeCronRequest } from "@/lib/cron/auth";
import { countOutboxOwed, resendSender, sweepOutbox } from "@/lib/email/outbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverableTemplates } from "@/lib/site-mode";

/**
 * The outbox sweeper (spec §6).
 *
 * SCHEDULE
 *
 * Daily at 14:00 UTC, as configured in `vercel.json` for `/api/cron/outbox`.
 * Retry delays in `delivery.ts` are minimum delays. A due retry waits for a
 * later sweep, so daily processing can delay mail until the following day.
 *
 * Node runtime: the claim goes through the service-role client, and
 * `constantTimeEquals` behind the auth gate is `node:crypto`.
 *
 * SAFE TO RUN CONCURRENTLY WITH ITSELF
 *
 * `claim_outbox_batch` uses `for update skip locked` to partition due rows
 * between workers. Its lease excludes a claimed row until that lease expires.
 * The same claim covers `dispatchOutbox` after commit racing a sweep.
 */
// Expected schedule: 0 14 * * *
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One batch. Bounded so a backlog is drained over several sweeps rather than
 *  in one invocation that runs into the function timeout and loses its leases. */
const BATCH_LIMIT = 12;
const DELIVERY_CONCURRENCY = 3;

export async function GET(request: Request): Promise<Response> {
  const verdict = authorizeCronRequest(request.headers);
  if (!verdict.ok) {
    return Response.json(
      { ok: false, error: verdict.reason },
      { status: verdict.status },
    );
  }

  const admin = createAdminClient();
  const templates = deliverableTemplates();

  /* Read before claiming, so the number reported is the backlog this sweep
     found rather than the backlog it left behind. */
  const owed = await countOutboxOwed(admin, templates);

  const send = await resendSender();

  /**
   * NO RESEND KEY: report, claim nothing, send nothing.
   *
   * The alternative — claim the rows and log that they could not be sent — would
   * increment `attempts` on every sweep, and five sweeps later a queue that had
   * simply never been given a key would be full of `dead` rows. The record of
   * what CMG owed people is the entire point of an outbox, so the sweeper
   * declines to touch it and says why. 200 rather than an error status: the
   * schedule ran and behaved correctly, and a red cron history would be a false
   * alarm about a deliberate configuration.
   */
  if (!send) {
    return Response.json({
      ok: true,
      delivery: "unconfigured",
      owed,
      claimed: 0,
      detail:
        "RESEND_API_KEY is not set, so nothing was claimed and nothing was sent. The queued notifications are intact and will send once a key is configured.",
    });
  }

  const report = await sweepOutbox(
    admin,
    send,
    BATCH_LIMIT,
    DELIVERY_CONCURRENCY,
    templates,
  );

  return Response.json({
    ok: true,
    delivery: "resend",
    owed,
    ...report,
  });
}

/**
 * Vercel Cron issues GET. POST is accepted too so the endpoint can be driven by
 * hand — and by anything else holding the secret — without a second route.
 */
export const POST = GET;
