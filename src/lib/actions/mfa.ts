"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { landingPathFor, safeNextPath } from "@/lib/auth/roles";
import { requireUser } from "@/lib/authz";
import { checkRateLimit, clientIpFromHeaders, inetOrNull, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  GENERIC_ERROR,
  RATE_LIMIT_ERROR,
  type EnrollmentState,
  type FormState,
} from "./types";

const CODE_ERROR = "That code was not accepted. Codes change every 30 seconds — try the current one.";

/**
 * `totp.qr_code` is documented as raw SVG markup to be prefixed with
 * `data:image/svg+xml;utf-8,`, but this GoTrue build already returns the
 * complete data URI. Prefixing unconditionally produced
 * `data:image/svg+xml;utf8,data%3Aimage%2F…` — a URI whose payload is the text
 * of another URI, which renders as a broken image and takes the only scannable
 * form of the secret with it. Both shapes are handled rather than picking one,
 * because which is returned is a property of the running Auth version and not
 * of anything in this repository.
 *
 * When it is raw markup it is percent-encoded rather than interpolated: SVG
 * uses `#` for fill colours, and an unencoded one is read as the start of a
 * fragment and truncates the image.
 */
function qrDataUri(value: string): string {
  return value.startsWith("data:")
    ? value
    : `data:image/svg+xml;utf8,${encodeURIComponent(value)}`;
}

/* Declared with no parameters even though `useActionState` calls it with
   (previousState, formData): a lower-arity function is assignable to that
   signature, and naming two arguments this action has no use for is how an
   unused-parameter warning gets normalised into background noise. */
export async function beginTotpEnrollment(): Promise<EnrollmentState> {
  const session = await requireUser("/mfa");
  const supabase = await createClient();

  // Every visit to the setup screen that is not completed leaves an unverified
  // factor behind, and GoTrue caps enrolled factors per user. Left to
  // accumulate, a staff member who abandons setup a few times hits
  // `too_many_enrolled_mfa_factors` and can no longer enrol at all — locked out
  // of `/admin` by the mechanism meant to let them in. Verified factors are
  // never touched here.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const factor of existing?.all ?? []) {
    if (factor.status !== "verified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });

  if (error || !data) {
    console.error("[mfa] enroll failed", error?.message);
    return {
      status: "error",
      message:
        error?.code === "mfa_totp_enroll_not_enabled"
          ? "Authenticator setup is not enabled on this environment."
          : GENERIC_ERROR,
    };
  }

  await writeAudit(createAdminClient(), {
    actorId: session.userId,
    action: "auth.mfa_enroll_started",
    entity: "auth",
    entityId: session.userId,
    meta: { factor_id: data.id },
  });

  return {
    status: "ready",
    factorId: data.id,
    qrCode: qrDataUri(data.totp.qr_code),
    secret: data.totp.secret,
  };
}

/**
 * Verifies a code against a factor — the same call whether the factor is being
 * enrolled for the first time or challenged at sign-in. For TOTP, a successful
 * verification of an unverified factor is what marks it verified, and either
 * way the session is promoted to aal2, which is what `proxy.ts` gates `(admin)`
 * on.
 */
export async function verifyTotp(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireUser("/mfa");
  const factorId = String(formData.get("factorId") ?? "").trim();
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const next = safeNextPath(String(formData.get("next") ?? "")) ?? null;

  if (!factorId || !/^\d{6}$/.test(code)) {
    return { status: "error", message: CODE_ERROR };
  }

  // Keyed to the user, not the IP: a six-digit code is a one-in-a-million guess
  // per attempt, so what has to be bounded is attempts against a *given*
  // account, wherever they come from.
  if (!(await checkRateLimit(RATE_LIMITS.mfaVerifyUser, session.userId))) {
    return { status: "error", message: RATE_LIMIT_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  const admin = createAdminClient();
  const ip = inetOrNull(clientIpFromHeaders(await headers()));

  if (error) {
    await writeAudit(admin, {
      actorId: session.userId,
      action: "auth.mfa_verify_failed",
      entity: "auth",
      entityId: session.userId,
      meta: { factor_id: factorId, reason: error.code ?? "unknown" },
      ip,
    });
    return { status: "error", message: CODE_ERROR };
  }

  await writeAudit(admin, {
    actorId: session.userId,
    action: "auth.mfa_verified",
    entity: "auth",
    entityId: session.userId,
    meta: { factor_id: factorId },
    ip,
  });

  redirect(next ?? landingPathFor(session.role));
}
