import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database-app";
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
import { deliverableTemplates } from "@/lib/site-mode";

type Admin = SupabaseClient<Database>;

export type OutboxEntry = {
  recipientEmail: string;
  message: NotificationMessage;
  dedupeKey?: string;
};

// Reserved marker only: the database claim function must hold these rows.
export const UNRESOLVED_STAFF_RECIPIENT = "unresolved-staff@invalid";

export const staffInbox = () => {
  const address = process.env.EMAIL_STAFF_INBOX?.trim() ?? "";
  if (address.toLowerCase() === UNRESOLVED_STAFF_RECIPIENT) {
    return UNRESOLVED_STAFF_RECIPIENT;
  }
  return z.email().safeParse(address).success
    ? address
    : UNRESOLVED_STAFF_RECIPIENT;
};

/** False means blocked or invalid; null means the policy could not be read. */
export async function staffRecipientAllowed(admin: Admin): Promise<boolean | null> {
  const recipient = staffInbox();
  if (recipient === UNRESOLVED_STAFF_RECIPIENT) return false;
  try {
    const { data, error } = await admin.rpc("email_recipient_allowed", { p_recipient: recipient });
    return error || typeof data !== "boolean" ? null : data;
  } catch {
    return null;
  }
}

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
    dedupe_key: entry.dedupeKey ?? null,
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
    async claim(limit, ids, templates) {
      const { data, error } = await admin.rpc("claim_outbox_batch_v2", {
        p_limit: limit,
        p_lease_seconds: OUTBOX_LEASE_SECONDS,
        p_ids: ids ?? undefined,
        p_templates: templates ? [...templates] : undefined,
      });
      if (error) throw new Error("Outbox claim failed.");
      const rows = data ?? [];
      if (rows.some((row) => !row.lease_token)) throw new Error("Outbox claim has no lease token.");
      return rows as ClaimedRow[];
    },
    async settle(result: SettleInput) {
      const { data, error } = await admin.rpc("settle_outbox_claim_v2", {
        p_id: result.id,
        p_token: result.leaseToken,
        p_outcome: result.outcome,
        p_error: result.error,
        p_retry_seconds: result.retryInSeconds,
      });
      if (error || data !== true) throw new Error("Outbox settlement failed or the claim is no longer owned.");
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
export async function resendSender(admin: Admin): Promise<SendMessage | null> {
  const apiKey = resendApiKey();
  if (!apiKey) return null;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    return async (message) => {
      let allowed = false;
      try {
        const result = message.leaseToken
          ? await admin.rpc("outbox_claim_ready_v2", { p_id: message.idempotencyKey, p_token: message.leaseToken, p_recipient: message.to })
          : await admin.rpc("email_recipient_allowed", { p_recipient: message.to });
        allowed = !result.error && result.data === true;
      } catch {
        allowed = false;
      }
      if (!allowed) {
        throw Object.assign(new Error("Recipient policy unavailable or refused."), { code: "RECIPIENT_POLICY_HOLD" });
      }
      if (message.signal?.aborted) {
        throw Object.assign(new Error("Provider outcome is unknown."), { code: "PROVIDER_OUTCOME_UNKNOWN" });
      }
      let result;
      try {
        result = await resend.emails.send({
          from: fromAddress(), to: message.to, subject: message.subject,
          replyTo: "collin@cmgpropertysolutions.net",
          html: message.html, text: message.text,
        }, { idempotencyKey: message.idempotencyKey });
      } catch {
        throw Object.assign(new Error("Provider outcome is unknown."), { code: "PROVIDER_OUTCOME_UNKNOWN" });
      }
      if (result.error) {
        const status = result.error.statusCode;
        if (typeof status !== "number" || status < 400 || status >= 500 || status === 408 || status === 409) {
          throw Object.assign(new Error("Provider outcome is unknown."), { code: "PROVIDER_OUTCOME_UNKNOWN" });
        }
        throw new Error("Provider refused the message.");
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

  let allowedIds = ids;

  /* "Which templates may this mode put on the wire" — `undefined` only in
     platform mode, where every template is deliverable and the lookup is
     skipped entirely. Simple mode permits the four public-form templates;
     staff mode adds the three alerts addressed to the CMG inbox. */
  const templates = deliverableTemplates();
  if (templates) {
    const { data, error } = await admin
      .from("notifications_outbox")
      .select("id, template")
      .in("id", ids);

    if (error) {
      console.error("[outbox] deliverable-template check failed", error.message);
      return;
    }

    const allowed = new Set<string>(templates);
    allowedIds = (data ?? [])
      .filter((row) => allowed.has(row.template))
      .map((row) => row.id);
  }

  if (allowedIds.length === 0) return;

  const send = await resendSender(admin);
  if (!send) {
    console.info(
      `[outbox] RESEND_API_KEY not set — ${allowedIds.length} notification(s) queued, not sent`,
    );
    return;
  }

  try {
    await deliverClaimed(supabaseOutboxStore(admin), send, {
      limit: allowedIds.length,
      ids: allowedIds,
      templates,
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
  concurrency = 1,
  templates?: readonly string[],
): Promise<DeliveryReport> {
  return deliverClaimed(supabaseOutboxStore(admin), send, {
    limit, concurrency, templates,
  });
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
export async function countOutboxOwed(
  admin: Admin,
  templates?: readonly string[],
): Promise<number | null> {
  let query = admin
    .from("notifications_outbox")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "failed"]);

  if (templates) query = query.in("template", [...templates]);

  const { count, error } = await query;

  if (error) {
    console.error("[outbox] owed count failed", error.message);
    return null;
  }

  return count ?? 0;
}

/** Count only the unresolved recipients that still need a reviewed correction. */
export async function countOutboxHeld(admin: Admin): Promise<number | null> {
  const { data, error } = await admin.rpc("count_outbox_held");
  if (error) return null;
  return data ?? 0;
}
