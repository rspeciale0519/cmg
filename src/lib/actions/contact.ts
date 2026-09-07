"use server";

import { headers } from "next/headers";
import { dispatchOutbox, outboxRows, staffInbox } from "@/lib/email/outbox";
import type { OutboxEntry } from "@/lib/email/outbox";
import {
  checkFormRateLimits,
  clientIpFromHeaders,
  inetOrNull,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitContactUnit } from "./submission-transactions";
import { verifyTurnstile } from "@/lib/turnstile";
import { CONTACT_CONSENT_TEXT, contactSchema } from "@/lib/validators/contact";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  invalid,
  RATE_LIMIT_ERROR,
  VERIFICATION_ERROR,
  type FormState,
} from "./types";

const SUCCESS_MESSAGE = "Request received.";

export async function submitContact(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);

  const rawEmail = String(formData.get("email") ?? "").trim();
  const withinLimits = await checkFormRateLimits({
    ipRule: RATE_LIMITS.contactIp,
    emailRule: RATE_LIMITS.contactEmail,
    ip,
    email: rawEmail.length > 0 ? rawEmail : null,
  });
  if (!withinLimits) {
    console.warn("[contact] rate limited");
    return { status: "error", message: RATE_LIMIT_ERROR };
  }

  const turnstile = await verifyTurnstile(
    formData.get("cf-turnstile-response"),
    inetOrNull(ip),
  );
  if (!turnstile.ok) {
    console.warn("[contact] turnstile rejected", { reason: turnstile.reason });
    return { status: "error", message: VERIFICATION_ERROR };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    message: formData.get("message") ?? "",
    turnstileToken: formData.get("cf-turnstile-response") ?? "",
  });

  if (!parsed.success) {
    return invalid(fieldErrorsFrom(parsed.error));
  }

  const input = parsed.data;
  const admin = createAdminClient();

  /* `consents.email` is NOT NULL and this form collects no SMS consent, so a
     phone-only submission records the lead with no consent row. There is no
     address to name and no SMS agreement to record; inventing either would put
     a consent on file the submitter never gave. */
  const firstName = input.name.split(/\s+/)[0] || input.name;
  const entries: OutboxEntry[] = [
    {
      recipientEmail: staffInbox(),
      message: {
        template: "lead_staff_alert",
        payload: {
          name: input.name,
          phone: input.phone,
          email: input.email,
          message: input.message,
          submittedAt: new Date().toISOString(),
        },
      },
    },
  ];

  if (input.email) {
    entries.push({
      recipientEmail: input.email,
      message: { template: "lead_auto_reply", payload: { firstName } },
    });
  }

  const committed = await submitContactUnit(admin, {
    lead: {
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      message: input.message ?? null,
      ip: inetOrNull(ip),
      user_agent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
    },
    consent: input.email
      ? {
          email: input.email,
          phone: input.phone,
          kind: "email",
          consent_text: CONTACT_CONSENT_TEXT,
          ip: inetOrNull(ip),
        }
      : null,
    outbox: outboxRows(entries),
  });
  if (!committed) return { status: "error", message: GENERIC_ERROR };

  await dispatchOutbox(
    admin,
    committed.outbox_ids,
  );

  return { status: "success", message: SUCCESS_MESSAGE };
}
