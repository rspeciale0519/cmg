"use server";

import { headers } from "next/headers";
import { checkFormRateLimits, checkRateLimit, clientIpFromHeaders, inetOrNull, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { parseIntakeInput } from "@/lib/intake/submission";
import { resolveIntakeReferral } from "@/lib/intake/referral";
import { parseIntakeManifest } from "@/lib/intake/manifest";
import { prepareIntakeSession, finalizeIntakeSession, uploadTokenHash, validUploadCapability } from "@/lib/intake/upload-session";
import type { IntakeStartState, IntakeFinalizeState } from "@/lib/intake/upload-types";
import { fieldErrorsFrom, GENERIC_ERROR, invalid, RATE_LIMIT_ERROR, VERIFICATION_ERROR, type FormState } from "./types";

export async function submitIntake(_previous: FormState, formData: FormData): Promise<IntakeStartState> {
  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);
  const ipInet = inetOrNull(ip);

  const rawEmail = String(formData.get("email") ?? "").trim();
  const withinLimits = await checkFormRateLimits({
    ipRule: RATE_LIMITS.intakeIp,
    emailRule: RATE_LIMITS.intakeEmail,
    ip,
    email: rawEmail.length > 0 ? rawEmail : null,
  });
  if (!withinLimits) {
    console.warn("[intake] rate limited");
    return { status: "error", message: RATE_LIMIT_ERROR };
  }

  const turnstile = await verifyTurnstile(
    formData.get("cf-turnstile-response"),
    ipInet,
  );
  if (!turnstile.ok) {
    console.warn("[intake] turnstile rejected", { reason: turnstile.reason });
    return { status: "error", message: VERIFICATION_ERROR };
  }

  const parsed = parseIntakeInput(formData);
  if (!parsed.success) return invalid(fieldErrorsFrom(parsed.error));
  const metadata = parseIntakeManifest(formData);
  if (!metadata) return invalid({ documents: "Choose up to ten supported files of 25 MB or less. Check your files and submit again." });

  try {
    const admin = createAdminClient();
    const referral = await resolveIntakeReferral(admin, formData.get("vendorReferralCode"));
    if (!referral.ok) return { status: "error", message: "This referral link is unavailable. Contact CMG for help or open the intake without a referral link." };
    return await prepareIntakeSession(admin, parsed.data, metadata, ipInet, referral.partner);
  } catch {
    // Reservations remain available to the cleanup worker after a failed call.
    console.error("[intake] upload preparation failed");
    return { status: "error", message: GENERIC_ERROR };
  }
}

export async function finalizeIntakeUpload(id: string, token: string): Promise<IntakeFinalizeState> {
  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);
  if (!(await checkRateLimit(RATE_LIMITS.intakeFinalizeIp, ip))) {
    return { status: "error", message: RATE_LIMIT_ERROR };
  }
  if (!validUploadCapability(id, token)) return { status: "error", message: GENERIC_ERROR };
  if (!(await checkRateLimit(RATE_LIMITS.intakeFinalizeToken, uploadTokenHash(token)))) {
    return { status: "error", message: RATE_LIMIT_ERROR };
  }
  // The capability can exist only after rate limit, Turnstile, and validation.
  // A retry does not consume the original single-use Turnstile token again.
  try {
    return await finalizeIntakeSession(createAdminClient(), id, token);
  } catch {
    console.error("[intake] confirmation unavailable");
    return { status: "error", message: "We could not confirm this intake. Keep this tab open and use the retry button." };
  }
}
