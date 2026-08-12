import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  deliverClaimed,
  OUTBOX_LEASE_SECONDS,
  type ClaimedRow,
  type DeliveryReport,
  type OutboxStore,
  type SendMessage,
  type SettleInput,
} from "./delivery";
import type { NotificationMessage } from "./render";

type Admin = SupabaseClient<Database>;

export type OutboxEntry = {
  recipientEmail: string;
  message: NotificationMessage;
};

export const staffInbox = () =>
  process.env.EMAIL_STAFF_INBOX ?? "Austin@CMGPropertySolutions.net";

const fromAddress = () =>
  process.env.EMAIL_FROM ??
  "CMG Property Solutions <claims@cmgpropertysolutions.net>";

/**
 * Rows for `notifications_outbox`. Returned rather than inserted so the caller
 * can insert them inside the same unit as the data write (spec §6).
 */
export function outboxRows(entries: OutboxEntry[]) {
  return entries.map((entry) => ({
    recipient_email: entry.recipientEmail,
    template: entry.message.template,
    payload: entry.message.payload as unknown as Json,
  }));
}

/** Trimmed, because `RESEND_API_KEY=""` is how "not configured" is written. */
export function resendApiKey(): string | null {
  const value = process.env.RESEND_API_KEY;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The store the engine writes through, backed by the service-role client.
 *
 * `claim` is the RPC and not a select: two sweepers, or a sweeper and a
 * post-commit dispatch, must not both take the same row. See
 * `20260814120000_outbox_claim.sql` for the mechanism.
 */
export function supabaseOutboxStore(admin: Admin): OutboxStore {
  return {
    async claim(limit, ids) {
      const { data, error } = await admin.rpc("claim_outbox_batch", {
        p_limit: limit,
        p_lease_seconds: OUTBOX_LEASE_SECONDS,
        p_ids: ids ?? undefined,
      });

      if (error) {
        console.error("[outbox] claim failed", error.message);
        return [];
      }

      return (data ?? []) as ClaimedRow[];
    },

    async settle(result: SettleInput) {
      /* `next_attempt_at` is left alone for `sent` and `dead`. Neither is ever
         due again, the claim already pushed it past the lease, and writing a
         retry time onto a row that will never be retried would make the column
         lie to whoever reads the table looking for the backlog. */
      const patch: Database["public"]["Tables"]["notifications_outbox"]["Update"] = {
        status: result.outcome,
        last_error: result.error,
      };

      if (result.outcome === "sent") {
        patch.sent_at = new Date().toISOString();
      }

      if (result.retryInSeconds !== null) {
        patch.next_attempt_at = new Date(
          Date.now() + result.retryInSeconds * 1000,
        ).toISOString();
      }

      const { error } = await admin
        .from("notifications_outbox")
        .update(patch)
        .eq("id", result.id);

      if (error) {
        /* The row keeps its lease and comes back on a later sweep. At-least-once
           is the contract, so a lost settle costs a duplicate rather than a lost
           notification — the right way round for this queue. */
        console.error("[outbox] settle failed", { id: result.id, error: error.message });
      }
    },
  };
}

/**
 * The transport, or `null` when this environment cannot send.
 *
 * Returning null rather than a no-op sender is deliberate: a sender that
 * silently resolves would let the engine mark rows `sent` that were never sent,
 * which is the one outcome this system must never produce. Callers check for
 * null and decline to claim anything.
 */
export async function resendSender(): Promise<SendMessage | null> {
  const apiKey = resendApiKey();
  if (!apiKey) return null;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    return async (message) => {
      const result = await resend.emails.send({
        from: fromAddress(),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }
    };
  } catch (cause) {
    console.error("[outbox] Resend client unavailable", cause);
    return null;
  }
}

/**
 * Post-commit delivery attempt. Never throws and never fails the submission
 * that queued the rows.
 *
 * With no `RESEND_API_KEY` this claims nothing at all. That matters more than it
 * looks: claiming would increment `attempts` on rows that were never offered to
 * a provider, so an environment with delivery switched off would walk its whole
 * backlog to `dead` in five sweeps and destroy the record of what was owed. The
 * rows stay `pending` and due, and `/admin/settings` reports the backlog.
 */
export async function dispatchOutbox(admin: Admin, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const send = await resendSender();
  if (!send) {
    console.info(
      `[outbox] RESEND_API_KEY not set — ${ids.length} notification(s) queued, not sent`,
    );
    return;
  }

  try {
    await deliverClaimed(supabaseOutboxStore(admin), send, {
      limit: ids.length,
      ids,
    });
  } catch (cause) {
    console.error("[outbox] immediate dispatch failed", cause);
  }
}

/**
 * The cron sweep. Same engine, same claim, no id filter — whatever is due.
 */
export async function sweepOutbox(
  admin: Admin,
  send: SendMessage,
  limit: number,
): Promise<DeliveryReport> {
  return deliverClaimed(supabaseOutboxStore(admin), send, { limit });
}

/**
 * How many notifications are still owed a send — `pending` or `failed`,
 * whenever they are next scheduled. Read for the sweeper's report and for
 * `/admin/settings`, so an owner running without a Resend key can see the size
 * of what is waiting rather than infer it.
 *
 * Deliberately *not* "due now". A row backed off to next hour is still owed, and
 * an operator reading `owed: 12, claimed: 0` needs that to mean "twelve are
 * waiting, none were ready this minute" rather than "the sweeper is broken".
 */
export async function countOutboxOwed(admin: Admin): Promise<number | null> {
  const { count, error } = await admin
    .from("notifications_outbox")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "failed"]);

  if (error) {
    console.error("[outbox] owed count failed", error.message);
    return null;
  }

  return count ?? 0;
}
