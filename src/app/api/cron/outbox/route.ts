import { authorizeCronRequest } from "@/lib/cron/auth";
import { countOutboxOwed, resendSender, sweepOutbox } from "@/lib/email/outbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSimpleMode, PUBLIC_FORM_TEMPLATES } from "@/lib/site-mode";

/**
 * The outbox sweeper (spec §6).
 *
 * SCHEDULE
 *
 * Every five minutes, as a `crons` entry in `vercel.json` pointing at
 * `/api/cron/outbox` — the literal expression is on the line below this comment,
 * because it contains the two characters that would end this one. It is wired up
 * in Phase 9 with the rest of the deploy configuration.
 *
 * Five minutes is chosen against the retry ladder in `delivery.ts` — the first
 * backoff is one minute,
 * so a sweep this often means a transient failure is retried on the next tick
 * rather than sitting out its own backoff, and the longest gap (~2h) is still
 * measured in sweeps rather than in days. Nothing here depends on the interval
 * for correctness: the claim is atomic and the backoff is a floor, so a slower
 * schedule delays mail and a faster one wastes invocations, and neither
 * duplicates a send.
 *
 * Node runtime: the claim goes through the service-role client, and
 * `constantTimeEquals` behind the auth gate is `node:crypto`.
 *
 * SAFE TO RUN CONCURRENTLY WITH ITSELF
 *
 * A sweep that overruns its interval will be running when the next one starts,
 * and on Vercel neither knows about the other. `claim_outbox_batch` is what
 * makes that harmless — `for update skip locked` partitions the due rows between
 * whoever asks, so the second sweeper takes the rows the first one did not, and
 * a row that is already claimed has been pushed out of the due window by its
 * lease. The same claim covers the post-commit `dispatchOutbox` racing a sweep.
 */
// Expected schedule:  */5 * * * *
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
  const templates = isSimpleMode() ? PUBLIC_FORM_TEMPLATES : undefined;

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
