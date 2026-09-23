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
export const OUTBOX_MAX_CONCURRENCY = 4;
export const OUTBOX_SEND_TIMEOUT_MS = 10_000;

/**
 * How old a queued notification may be and still be sent, in days.
 *
 * SEVEN, AND WHY IT IS NOT LONGER
 *
 * Every template in this system is transactional: a claim changed state, a
 * document was signed, somebody asked a question. Each one is a statement about
 * a moment, and a week is the outside edge of the window in which such a
 * statement is still true enough to send. Past it the mail is not merely late —
 * it tells the recipient something about their claim that has since moved on,
 * and they act on it.
 *
 * WHAT IT IS ACTUALLY GUARDING
 *
 * A widening of the deliverable-template set. `deliverableTemplates()` holds
 * rows back by template, not by marking them undeliverable, so every row a mode
 * refuses stays `pending` and stays *due* — `next_attempt_at` was never pushed
 * out, because nothing ever claimed it. The moment a mode change adds that
 * template to the list, the entire held-back history becomes claimable in one
 * sweep. Production holds rows from August in exactly this state. Without this
 * guard, editing one environment variable would mail them.
 *
 * DEAD, NOT SKIPPED
 *
 * A stale row is settled `dead` rather than left alone. Skipping would leave it
 * due for ever, so the next sweep would claim it again, burn an attempt and skip
 * it again, five times over, until the attempt limit dead-lettered it with a
 * misleading `last_error` about a delivery failure that never happened.
 * Dead-lettering here is the same terminal state reached honestly, on the first
 * claim, with a reason an operator reading `/admin/settings` can act on. The
 * payload is retained, so a notification that genuinely still needs to go out
 * can be re-queued deliberately.
 */
export const OUTBOX_MAX_AGE_DAYS_DEFAULT = 7;

/**
 * The configured threshold. `0` and any negative value disable the guard, which
 * is the escape hatch for a deliberate backlog flush; anything unparseable falls
 * back to the default rather than disabling it, because a typo in an environment
 * variable must not be a way to release month-old mail.
 */
export function outboxMaxAgeDays(
  value = process.env.OUTBOX_MAX_AGE_DAYS,
): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return OUTBOX_MAX_AGE_DAYS_DEFAULT;
  }
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return OUTBOX_MAX_AGE_DAYS_DEFAULT;
  }
  return parsed;
}

/**
 * Whether a row queued at `createdAt` is past the threshold.
 *
 * A missing or unparseable `created_at` is **not** stale. The column is `not
 * null` in the table, so the only way to arrive here without one is a claim
 * function that predates the migration adding it — and in that situation the
 * honest answer is "age unknown", which must not silently dead-letter a queue.
 */
export function isStaleOutboxRow(
  createdAt: string | null | undefined,
  maxAgeDays = outboxMaxAgeDays(),
  now = Date.now(),
): boolean {
  if (maxAgeDays <= 0) return false;
  if (typeof createdAt !== "string") return false;
  const queuedAt = Date.parse(createdAt);
  if (Number.isNaN(queuedAt)) return false;
  return now - queuedAt > maxAgeDays * 86_400_000;
}

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
  /** When the row was queued. Optional only for the pre-migration claim shape. */
  created_at?: string | null;
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
  idempotencyKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) => Promise<void>;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("provider send timed out")), timeoutMs);
  });
  try {
    return await Promise.race([promise, expired]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export type DeliveryReport = {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
  /** Rows dead-lettered by the age guard. A subset of `dead`, reported so an
   *  operator can tell a stale backlog from a failing provider at a glance. */
  stale: number;
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
  options: { limit: number; ids?: string[]; concurrency?: number },
): Promise<DeliveryReport> {
  const rows = await store.claim(options.limit, options.ids);
  const report: DeliveryReport = {
    claimed: rows.length,
    sent: 0,
    failed: 0,
    dead: 0,
    stale: 0,
  };

  const maxAgeDays = outboxMaxAgeDays();

  const deliver = async (row: ClaimedRow) => {
    /* Before the render, and before any provider call. A row this old is not
       going to be sent by any later attempt either, so there is nothing to
       gain by rendering it first and a recipient to protect by not sending
       it at all. */
    if (isStaleOutboxRow(row.created_at, maxAgeDays)) {
      await store.settle({
        id: row.id,
        outcome: "dead",
        error: `Not sent: queued more than ${maxAgeDays} day(s) ago, past OUTBOX_MAX_AGE_DAYS. The payload is retained; re-queue it deliberately if it is still owed.`,
        retryInSeconds: null,
      });
      report.dead += 1;
      report.stale += 1;
      return;
    }

    let sendFailure: unknown = null;
    try {
      const rendered = await renderNotification({
        template: row.template,
        payload: row.payload,
      } as NotificationMessage);

      await withTimeout(send({
        idempotencyKey: row.id,
        to: row.recipient_email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }), OUTBOX_SEND_TIMEOUT_MS);

    } catch (cause) {
      sendFailure = cause;
    }

    if (sendFailure !== null) {
      const { outcome, retryInSeconds } = outcomeAfterFailure(row.attempts);

      await store.settle({
        id: row.id,
        outcome,
        /* Truncated because `last_error` is read in the workspace and a provider
           can return a whole HTML error page. The first 500 characters carry the
           status and the reason; the rest is a stylesheet. */
        error:
          sendFailure instanceof Error
            ? sendFailure.message.slice(0, 500)
            : "unknown delivery error",
        retryInSeconds,
      });

      report[outcome] += 1;
      return;
    }

    /* A successful provider call is not a provider failure merely because the
       database could not record it. Let the settlement error reject the sweep;
       the row retains its lease and Resend's row-id idempotency key makes the
       later retry safe. Never attempt a second, false `failed` settlement. */
    await store.settle({
      id: row.id,
      outcome: "sent",
      error: null,
      retryInSeconds: null,
    });
    report.sent += 1;
  };

  const concurrency = Math.min(
    Math.max(Math.floor(options.concurrency ?? 1), 1),
    OUTBOX_MAX_CONCURRENCY,
  );
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, rows.length) },
    async () => {
      while (cursor < rows.length) {
        const row = rows[cursor];
        cursor += 1;
        if (row) await deliver(row);
      }
    },
  );
  await Promise.all(workers);

  return report;
}
