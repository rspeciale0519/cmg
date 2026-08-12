import { renderNotification, type NotificationMessage } from "./render";

/**
 * The retry policy, and the engine that applies it, with no Supabase and no
 * Resend in sight.
 *
 * Everything here is a function of its arguments. `outbox.ts` supplies the
 * store, the route supplies the transport, and this file decides only *when* a
 * notification is owed another attempt and *when* it stops being owed one —
 * which is the part with numbers in it, and therefore the part worth pinning in
 * a test rather than discovering in production.
 */

/**
 * Seconds to wait before attempt N+1, indexed by the attempt that just failed.
 *
 * Exponential with a factor of five from a one-minute base: 1m, 5m, 25m, ~2h.
 * The factor is five rather than two because the failures this actually sees are
 * provider outages and DNS, which resolve in minutes to hours — doubling from a
 * minute would spend all five attempts inside the first quarter hour and declare
 * a notification dead while the outage was still being acknowledged. The last
 * gap is deliberately the long one: by then the fault is not transient.
 *
 * A floor, not a timetable. The sweeper runs on a fixed cron, so the real delay
 * is this rounded up to the next sweep.
 */
export const OUTBOX_BACKOFF_SECONDS: readonly number[] = [60, 300, 1500, 7500];

/**
 * Spec §6: "max 5 → `dead`". Counted as deliveries *started*, which is what
 * `claim_outbox_batch` increments — see that migration for why a send that kills
 * the process still has to cost an attempt.
 */
export const OUTBOX_MAX_ATTEMPTS = 5;

/**
 * How long a claimed row stays invisible to other sweepers. Only ever reached
 * when a sweeper dies holding a row: a live one overwrites `next_attempt_at`
 * with the backoff on failure, or sets `sent` on success.
 */
export const OUTBOX_LEASE_SECONDS = 300;

export type OutboxOutcome = "sent" | "failed" | "dead";

/**
 * What happens to a row whose attempt number is `attempts` and whose send just
 * failed. The fifth failure is the last one: there is no sixth attempt to wait
 * for, so it carries no delay.
 */
export function outcomeAfterFailure(attempts: number): {
  outcome: Extract<OutboxOutcome, "failed" | "dead">;
  retryInSeconds: number | null;
} {
  if (attempts >= OUTBOX_MAX_ATTEMPTS) {
    return { outcome: "dead", retryInSeconds: null };
  }

  /* `attempts` is 1-based and the table is 0-based, so attempt 1 reads slot 0.
     Clamped rather than indexed blind: the table is shorter than the attempt
     limit by exactly one, and an out-of-range read here would put `undefined`
     into a timestamp. */
  const index = Math.min(
    Math.max(attempts, 1) - 1,
    OUTBOX_BACKOFF_SECONDS.length - 1,
  );

  return { outcome: "failed", retryInSeconds: OUTBOX_BACKOFF_SECONDS[index] };
}

export type ClaimedRow = {
  id: string;
  recipient_email: string;
  template: string;
  payload: unknown;
  attempts: number;
};

export type SettleInput = {
  id: string;
  outcome: OutboxOutcome;
  error: string | null;
  retryInSeconds: number | null;
};

/**
 * The two operations the engine needs from storage. Narrow on purpose: a fake
 * that hands out each row exactly once is all it takes to demonstrate that two
 * sweepers cannot send the same notification twice.
 */
export type OutboxStore = {
  claim: (limit: number, ids?: string[]) => Promise<ClaimedRow[]>;
  settle: (result: SettleInput) => Promise<void>;
};

export type SendMessage = (message: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) => Promise<void>;

export type DeliveryReport = {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
};

/**
 * Claim a batch, render each row, send it, and record what happened.
 *
 * A row is claimed before it is rendered, so a payload that cannot be rendered
 * burns an attempt and reaches `dead` like any other permanent failure rather
 * than being retried until the heat death of the queue. That is why the render
 * is inside the try.
 *
 * Rows are handled in sequence rather than in parallel. The batch is small, the
 * provider rate-limits, and a serial loop means a thrown error can only ever
 * affect the row that threw it.
 */
export async function deliverClaimed(
  store: OutboxStore,
  send: SendMessage,
  options: { limit: number; ids?: string[] },
): Promise<DeliveryReport> {
  const rows = await store.claim(options.limit, options.ids);
  const report: DeliveryReport = {
    claimed: rows.length,
    sent: 0,
    failed: 0,
    dead: 0,
  };

  for (const row of rows) {
    try {
      const rendered = await renderNotification({
        template: row.template,
        payload: row.payload,
      } as NotificationMessage);

      await send({
        to: row.recipient_email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      await store.settle({
        id: row.id,
        outcome: "sent",
        error: null,
        retryInSeconds: null,
      });
      report.sent += 1;
    } catch (cause) {
      const { outcome, retryInSeconds } = outcomeAfterFailure(row.attempts);

      await store.settle({
        id: row.id,
        outcome,
        /* Truncated because `last_error` is read in the workspace and a provider
           can return a whole HTML error page. The first 500 characters carry the
           status and the reason; the rest is a stylesheet. */
        error:
          cause instanceof Error
            ? cause.message.slice(0, 500)
            : "unknown delivery error",
        retryInSeconds,
      });

      report[outcome] += 1;
    }
  }

  return report;
}
