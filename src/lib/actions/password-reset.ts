"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { writeAudit } from "@/lib/audit";
import { isLeakedPassword } from "@/lib/auth/leaked-password";
import { deliverPasswordReset } from "@/lib/auth/password-reset-delivery";
import { getRecoverySession, RECOVERY_EXPIRED_PATH } from "@/lib/auth/recovery";
import { requireOpenPath } from "@/lib/authz";
import {
  checkFormRateLimits,
  checkRateLimit,
  clientIpFromHeaders,
  inetOrNull,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { resetPasswordSchema } from "@/lib/validators/password";
import { forgotPasswordSchema } from "@/lib/validators/password-reset";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  invalid,
  PASSWORD_RESET_REQUESTED,
  RATE_LIMIT_ERROR,
  VERIFICATION_ERROR,
  type FormState,
} from "./types";

const LEAKED_PASSWORD =
  "This password has appeared in a known data breach. Choose one you have not used elsewhere.";

const CODE_ERROR =
  "That code was not accepted. Codes change every 30 seconds — try the current one.";

/**
 * Step one: ask for a link.
 *
 * The public submission order — rate limit, Turnstile, validation, then work —
 * and then the work itself is deferred with `after()`, so every request that
 * passes the gates gets the same sentence at the same speed. See
 * `deliverPasswordReset` for what happens after the response.
 */
export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  requireOpenPath("/forgot-password");

  const rawEmail = String(formData.get("email") ?? "").trim();
  // Echoed on a refusal only. React 19 resets the form when the action
  // resolves, and an address is not a secret the way a password is.
  const values = { email: rawEmail };

  const ip = clientIpFromHeaders(await headers());

  const withinLimits = await checkFormRateLimits({
    ipRule: RATE_LIMITS.passwordResetIp,
    emailRule: RATE_LIMITS.passwordResetEmail,
    ip,
    email: rawEmail.length > 0 ? rawEmail : null,
  });
  if (!withinLimits) {
    return { status: "error", message: RATE_LIMIT_ERROR, values };
  }

  const turnstile = await verifyTurnstile(
    formData.get("cf-turnstile-response"),
    inetOrNull(ip),
  );
  if (!turnstile.ok) {
    return { status: "error", message: VERIFICATION_ERROR, values };
  }

  const parsed = forgotPasswordSchema.safeParse({ email: rawEmail });
  if (!parsed.success) {
    return invalid(fieldErrorsFrom(parsed.error), values);
  }

  const email = parsed.data.email.toLowerCase();
  const auditIp = inetOrNull(ip);
  after(async () => {
    await deliverPasswordReset(email, auditIp);
  });

  return { status: "success", message: PASSWORD_RESET_REQUESTED };
}

type ResetOutcome =
  | { kind: "done" }
  | { kind: "expired" }
  | { kind: "failed"; state: FormState };

function failed(state: FormState): ResetOutcome {
  return { kind: "failed", state };
}

async function resetPasswordInner(formData: FormData): Promise<ResetOutcome> {
  const recovery = await getRecoverySession();
  if (!recovery) return { kind: "expired" };

  // Nothing is echoed from this form: every field on it is a secret.
  if (!(await checkRateLimit(RATE_LIMITS.passwordResetUser, recovery.userId))) {
    return failed({ status: "error", message: RATE_LIMIT_ERROR });
  }

  const parsed = resetPasswordSchema(recovery.email).safeParse({
    password: formData.get("password") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) return failed(invalid(fieldErrorsFrom(parsed.error)));

  const { password } = parsed.data;

  if (await isLeakedPassword(password)) {
    return failed(invalid({ password: LEAKED_PASSWORD }));
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const ip = inetOrNull(clientIpFromHeaders(await headers()));

  /* GoTrue answers `insufficient_aal` to a password change at aal1 once the
     account has a verified factor (verified against the local stack), and a
     recovery session is always aal1. The code is checked here, before the
     update, and it is the same second factor sign-in asks for — so an inbox
     alone never sets a staff password. */
  let steppedUp = false;
  if (recovery.needsCode && recovery.factorId) {
    const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) return failed(invalid({ code: CODE_ERROR }));

    if (!(await checkRateLimit(RATE_LIMITS.mfaVerifyUser, recovery.userId))) {
      return failed({ status: "error", message: RATE_LIMIT_ERROR });
    }

    const { error: codeError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: recovery.factorId,
      code,
    });
    if (codeError) {
      await writeAudit(admin, {
        actorId: recovery.userId,
        action: "auth.mfa_verify_failed",
        entity: "auth",
        entityId: recovery.userId,
        meta: {
          factor_id: recovery.factorId,
          surface: "password_reset",
          reason: codeError.code ?? "unknown",
        },
        ip,
      });
      return failed(invalid({ code: CODE_ERROR }));
    }
    steppedUp = true;
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });

  if (updateError) {
    await writeAudit(admin, {
      actorId: recovery.userId,
      action: "auth.password_reset_refused",
      entity: "auth",
      entityId: recovery.userId,
      meta: { reason: updateError.code ?? "unknown" },
      ip,
    });

    if (updateError.code === "same_password") {
      return failed(
        invalid({ password: "Choose a password you are not already using here." }),
      );
    }
    console.error("[password-reset] update failed", updateError.code ?? "unknown");
    return failed({ status: "error", message: GENERIC_ERROR });
  }

  await writeAudit(admin, {
    actorId: recovery.userId,
    action: "auth.password_reset_completed",
    entity: "auth",
    entityId: recovery.userId,
    meta: { mfa_step_up: steppedUp },
    ip,
  });

  /* Global, so every other session on the account ends with the old password —
     including one an attacker may hold. The next sign-in starts from the new
     password at aal1, and `/admin` still demands the second factor. */
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  if (signOutError) {
    console.error("[password-reset] global sign-out failed", signOutError.code ?? "unknown");
  }

  return { kind: "done" };
}

/**
 * Step three: set the new password on the recovery session.
 *
 * `redirect()` throws to unwind, so it stays out of the body above.
 */
export async function resetPassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  requireOpenPath("/reset-password");
  const outcome = await resetPasswordInner(formData);

  if (outcome.kind === "failed") return outcome.state;
  if (outcome.kind === "expired") redirect(RECOVERY_EXPIRED_PATH);
  redirect("/login?notice=password-reset");
}
