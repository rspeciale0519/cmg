import "server-only";

import { randomUUID } from "node:crypto";
import { writeAudit } from "@/lib/audit";
import {
  RECOVERY_LINK_TTL_MINUTES,
  recoveryConfirmUrl,
} from "@/lib/auth/recovery";
import { isAppRole, landingPathFor } from "@/lib/auth/roles";
import { resendSender } from "@/lib/email/outbox";
import { renderPasswordResetEmail } from "@/lib/email/password-reset";
import { PLATFORM_DISABLED_PATH } from "@/lib/site-mode";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What happened to one recovery request. Written to the audit row and never
 * shown to the requester, who always sees the same sentence.
 */
export type PasswordResetOutcome =
  | "sent"
  | "no_account"
  | "inactive"
  | "surface_closed"
  | "link_failed"
  | "lookup_failed"
  | "site_url_missing"
  | "delivery_unconfigured"
  | "send_failed"
  | "error";

/**
 * Generates a recovery link and emails it, when the account may have one.
 *
 * Runs after the response has been sent (`after()` in the request action), so
 * nothing here can change what the requester sees or how long they wait.
 * Without that, "the address exists" would take a Resend round trip longer to
 * answer than "it does not", and the uniform sentence would leak by timing.
 *
 * `generateLink` is the account lookup. There is no service-role way to find a
 * user by address short of listing them all, and for `type: "recovery"` GoTrue
 * answers `user_not_found` without creating anything (verified against the
 * local stack). A link generated for an account that is then refused is never
 * sent; it expires unused.
 *
 * Never throws.
 */
export async function deliverPasswordReset(
  email: string,
  ip: string | null,
): Promise<PasswordResetOutcome> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    console.error("[password-reset] admin client unavailable");
    return "error";
  }

  let outcome: PasswordResetOutcome = "error";
  let userId: string | null = null;

  try {
    ({ outcome, userId } = await attempt(admin, email));
  } catch (cause) {
    // Name only: a message from the auth or mail client can quote its input.
    console.error(
      "[password-reset] request failed",
      cause instanceof Error ? cause.name : "unknown",
    );
    outcome = "error";
  }

  // The token is never part of this row. The address is, as it is on
  // `auth.sign_in_failed`, so repeated requests against one person are visible.
  await writeAudit(admin, {
    action: "auth.password_reset_requested",
    entity: "auth",
    entityId: userId,
    meta: { email, outcome },
    ip,
  });

  return outcome;
}

async function attempt(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<{ outcome: PasswordResetOutcome; userId: string | null }> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const user = data?.user ?? null;
  const tokenHash = data?.properties?.hashed_token ?? null;

  if (error || !user || !tokenHash) {
    if (error?.code === "user_not_found" || error?.status === 404) {
      return { outcome: "no_account", userId: null };
    }
    console.error("[password-reset] generateLink failed", error?.code ?? "no_link");
    return { outcome: "link_failed", userId: null };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[password-reset] profile lookup failed", profileError.code);
    return { outcome: "lookup_failed", userId: user.id };
  }
  if (!profile || !profile.is_active || !isAppRole(profile.role)) {
    return { outcome: "inactive", userId: user.id };
  }

  // The same rule `requireUser` applies at sign-in: in staff mode a customer or
  // partner has no open surface, so a new password would open nothing.
  if (landingPathFor(profile.role) === PLATFORM_DISABLED_PATH) {
    return { outcome: "surface_closed", userId: user.id };
  }

  const resetUrl = recoveryConfirmUrl(tokenHash);
  if (!resetUrl) {
    console.error("[password-reset] NEXT_PUBLIC_SITE_URL is not set");
    return { outcome: "site_url_missing", userId: user.id };
  }

  const send = await resendSender(admin);
  if (!send) {
    console.info("[password-reset] RESEND_API_KEY not set; no email sent");
    return { outcome: "delivery_unconfigured", userId: user.id };
  }

  const rendered = await renderPasswordResetEmail({
    resetUrl,
    expiresInMinutes: RECOVERY_LINK_TTL_MINUTES,
  });

  try {
    await send({
      // A fresh key per request: a repeat request is a new link, and Resend
      // must not deduplicate it into the previous one.
      idempotencyKey: randomUUID(),
      // The address GoTrue holds, not the one typed, so a lookalike spelling
      // that happened to match cannot choose where the link goes.
      to: user.email ?? email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (cause) {
    console.error(
      "[password-reset] send failed",
      cause instanceof Error ? cause.name : "unknown",
    );
    return { outcome: "send_failed", userId: user.id };
  }

  return { outcome: "sent", userId: user.id };
}
