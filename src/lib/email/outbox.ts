import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { renderNotification, type NotificationMessage } from "./render";

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

/**
 * Post-commit delivery attempt. Never throws and never fails the submission:
 * with no `RESEND_API_KEY` the rows are simply left `pending` for
 * `api/cron/outbox` to sweep, which is the configured state in local dev.
 */
export async function dispatchOutbox(admin: Admin, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(
      `[outbox] RESEND_API_KEY not set — ${ids.length} notification(s) left pending for the sweeper`,
    );
    return;
  }

  let send: (args: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }) => Promise<{ error?: { message: string } | null }>;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    send = (args) => resend.emails.send(args) as ReturnType<typeof send>;
  } catch (error) {
    console.error("[outbox] Resend client unavailable", error);
    return;
  }

  const { data: rows, error } = await admin
    .from("notifications_outbox")
    .select("id, recipient_email, template, payload, attempts")
    .in("id", ids)
    .eq("status", "pending");

  if (error || !rows) {
    console.error("[outbox] could not load queued rows", error?.message);
    return;
  }

  for (const row of rows) {
    try {
      const rendered = await renderNotification({
        template: row.template,
        payload: row.payload,
      } as NotificationMessage);

      const result = await send({
        from: fromAddress(),
        to: row.recipient_email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      await admin
        .from("notifications_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: row.attempts + 1,
          last_error: null,
        })
        .eq("id", row.id);
    } catch (sendError) {
      const attempts = row.attempts + 1;
      const backoffMinutes = Math.min(2 ** attempts, 60);

      await admin
        .from("notifications_outbox")
        .update({
          attempts,
          last_error:
            sendError instanceof Error ? sendError.message.slice(0, 500) : "unknown error",
          next_attempt_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
        })
        .eq("id", row.id);

      console.error("[outbox] send failed; left pending for the sweeper", {
        id: row.id,
        template: row.template,
      });
    }
  }
}
