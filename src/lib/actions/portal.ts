"use server";

import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { isLeakedPassword } from "@/lib/auth/leaked-password";
import { requireRole } from "@/lib/authz";
import { notifyStaffOfQuestion } from "@/lib/claims/notify";
import {
  checkRateLimit,
  clientIpFromHeaders,
  inetOrNull,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  passwordChangeSchema,
  profileSchema,
  questionSchema,
} from "@/lib/validators/portal";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  invalid,
  RATE_LIMIT_ERROR,
  submittedValues,
  type FormState,
} from "./types";

/**
 * The homeowner's writes. Four of them, and the shape is the same every time:
 * `requireRole("customer")` decides that a customer is speaking, and the
 * database decides which rows they may speak about — every statement below goes
 * through the *user's* client, so `claim_events_insert_customer`,
 * `profiles_update_self` and `consents_update` are the authorization rather than
 * a predicate written here. The service role appears once, to write an audit row
 * on a table no user session may insert into.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One sentence for "that claim is not yours" and for "there is no such claim",
 * because §7.9 says a portal account must not be able to tell them apart. It
 * also covers the third case a homeowner can actually reach — a claim whose
 * account has been deactivated — for the same reason.
 */
const NOT_YOURS =
  "We could not find that claim on your account. If you think that is wrong, call us and we will look.";

/**
 * A refusal that is the database's and not the form's. Distinct from
 * `GENERIC_ERROR` so the reader is told to try again *later* rather than told to
 * check what they typed, which for a policy refusal is advice that never works.
 */
const REFUSED =
  "We could not save that. Nothing has changed. Try again, or call us and we will do it for you.";

/**
 * The claim, read through the caller's own client so `claims_select` is the
 * check. Returns null for anything the homeowner may not have, which every
 * caller turns into `NOT_YOURS`.
 */
async function claimForCustomer(claimId: string): Promise<string | null> {
  if (!UUID.test(claimId)) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select("id")
    .eq("id", claimId)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Ask a question on the claim's feed.
 *
 * `type` and `visibility` are fixed here and pinned again by
 * `claim_events_insert_customer`, which admits a customer's insert only when it
 * is `type = 'question'`, `visibility = 'customer'`, and `author_id` is their
 * own uid. So the two values a form could be tampered with to change — posting
 * as staff, or posting something marked `shared` that a referring contractor
 * would then read — are not read from the form at all.
 */
export async function askQuestion(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole("customer");
  const claimId = String(formData.get("claimId") ?? "").trim();
  /* Echoed on every refusal below. React 19 resets a form when its action
     *resolves*, not when it succeeds, so without this a rate-limited or
     over-long question is silently erased under the message explaining why it
     was refused — and a homeowner who has just typed four paragraphs about
     their roof does not type them twice. Absent on success, where the empty
     composer is the correct outcome. */
  const typed = submittedValues(formData, ["body"]);

  if (!(await checkRateLimit(RATE_LIMITS.portalQuestionUser, session.userId))) {
    return { status: "error", message: RATE_LIMIT_ERROR, values: typed };
  }

  const parsed = questionSchema.safeParse({ body: formData.get("body") ?? "" });
  if (!parsed.success) {
    return invalid(fieldErrorsFrom(parsed.error), typed);
  }

  const claim = await claimForCustomer(claimId);
  if (!claim) return { status: "error", message: NOT_YOURS, values: typed };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claim_events")
    .insert({
      claim_id: claim,
      type: "question",
      body: parsed.data.body,
      author_id: session.userId,
      visibility: "customer",
    })
    .select("id");

  if (error) {
    console.error("[portal] question insert failed", error.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  if ((data?.length ?? 0) === 0) {
    return { status: "error", message: REFUSED, values: typed };
  }

  /* The question is in the feed and committed by this point. Alerting CMG is
     best-effort on top of that, and a queue that is down must not turn a posted
     question into an error message — so the warning is appended to the success
     sentence rather than replacing it. */
  const warning = await notifyStaffOfQuestion({
    claimId: claim,
    question: parsed.data.body,
  });

  revalidatePath(`/portal/claims/${claim}/activity`);
  return {
    status: "success",
    message: warning
      ? `Sent, and it is on your claim. ${warning}`
      : "Sent. Your adjuster will answer here, and we will email you when they do.",
  };
}

export async function updateProfile(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole("customer");
  const typed = submittedValues(formData, ["firstName", "lastName", "phone"]);

  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    phone: formData.get("phone") ?? "",
  });

  if (!parsed.success) return invalid(fieldErrorsFrom(parsed.error), typed);

  const supabase = await createClient();
  /* `profiles_update_self` is `id = auth.uid()` on both ends, and
     public.guard_profile_privileges() refuses role, partner_company_id and
     is_active underneath it. So the `.eq()` here is a narrowing of the caller's
     own row rather than the thing that makes this safe — a missing `.eq()`
     would be refused by the policy, not granted by it. */
  const { data, error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone,
    })
    .eq("id", session.userId)
    .select("id");

  if (error) {
    console.error("[portal] profile update failed", error.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  if ((data?.length ?? 0) === 0) {
    return { status: "error", message: REFUSED, values: typed };
  }

  revalidatePath("/portal", "layout");
  return { status: "success", message: "Saved." };
}

/**
 * Verifies a password without touching the caller's session.
 *
 * A plain `createClient()` here would sign in over the top of the live session
 * cookies — same user, so harmless in outcome, but it rotates the refresh token
 * mid-request for a check whose whole job is to answer a question. This client
 * holds no storage and persists nothing, so the attempt is a question and
 * nothing else.
 */
async function passwordIsCurrent(email: string, password: string): Promise<boolean> {
  const probe = createStatelessClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  if (error || !data.user) return false;

  // The probe minted a session it will never use. Retired explicitly rather
  // than left to expire: `scope: 'local'` so it revokes this token only and not
  // the caller's real one.
  await probe.auth.signOut({ scope: "local" });
  return true;
}

export async function changePassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole("customer");

  /* Nothing is echoed. `values` exists to hand back what a person typed, and
     the three fields on this form are all secrets — re-seeding them would put
     a password into rendered HTML and into the React payload on the wire, to
     save retyping something a password manager fills anyway. */
  if (!session.email) {
    return { status: "error", message: GENERIC_ERROR };
  }

  if (!(await checkRateLimit(RATE_LIMITS.portalPasswordUser, session.userId))) {
    return { status: "error", message: RATE_LIMIT_ERROR };
  }

  const parsed = passwordChangeSchema(session.email).safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });

  if (!parsed.success) return invalid(fieldErrorsFrom(parsed.error));

  const admin = createAdminClient();
  const ip = inetOrNull(clientIpFromHeaders(await headers()));

  if (!(await passwordIsCurrent(session.email, parsed.data.currentPassword))) {
    await writeAudit(admin, {
      actorId: session.userId,
      action: "auth.password_change_refused",
      entity: "auth",
      entityId: session.userId,
      meta: { reason: "current_password_wrong" },
      ip,
    });
    return invalid({ currentPassword: "That is not your current password." });
  }

  if (await isLeakedPassword(parsed.data.newPassword)) {
    return invalid({
      newPassword:
        "This password has appeared in a known data breach. Choose one you have not used elsewhere.",
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (error) {
    console.error("[portal] password update failed", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  // Revoke refresh tokens on every device. Existing access tokens can remain
  // valid until expiry; the sign-in notice must not promise immediate removal.
  let signedOut = false;
  try {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
    signedOut = !signOutError;
  } catch {
    // A transport failure must not report an unchanged password or return secrets.
  }

  // Audit is best-effort and must not prevent the security action or its redirect.
  try {
    await writeAudit(admin, {
      actorId: session.userId,
      action: "auth.password_changed",
      entity: "auth",
      entityId: session.userId,
      meta: { surface: "portal" },
      ip,
    });
  } catch {
    console.error("[portal] password-change audit failed");
  }

  if (!signedOut) {
    console.error("[portal] global sign-out failed after password change");
    return {
      status: "error",
      message:
        "Your password changed, but we could not sign out all devices. Sign out and contact CMG before you continue.",
    };
  }

  redirect("/login?notice=password-changed");
}

/**
 * Withdraw a consent.
 *
 * `withdrawn_at` is the only column that moves, and that is not this function's
 * discipline — `public.guard_consent_immutable()` raises on any change to the
 * consent text, the email, the phone, the kind or the grant time for every
 * caller holding a JWT. The record is evidence of what a person agreed to and
 * when, so it is written once and thereafter only ever annotated. The portal
 * says so on the page rather than implying the row can be edited.
 *
 * `is null` in the predicate makes this idempotent in the honest direction: a
 * second click cannot restamp the withdrawal with a later time, which would
 * quietly move the date on which contact should have stopped.
 *
 * No `writeAudit()` here, and its absence is deliberate rather than an
 * omission: `audit_consents` fires `after insert or update or delete` on this
 * table, so the trail is written inside the same transaction as the change. An
 * application write beside it would be a second row describing one act.
 */
export async function withdrawConsent(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("customer");
  const consentId = String(formData.get("consentId") ?? "").trim();

  if (!UUID.test(consentId)) {
    return { status: "error", message: REFUSED };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consents")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("id", consentId)
    .is("withdrawn_at", null)
    .select("id, kind");

  if (error) {
    console.error("[portal] consent withdrawal failed", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  if ((data?.length ?? 0) === 0) {
    return {
      status: "error",
      message:
        "That permission is already withdrawn, or it is not one of yours to withdraw.",
    };
  }

  revalidatePath("/portal/profile");
  return {
    status: "success",
    message:
      /* Word for word what `/portal/profile` prints on the row afterwards. The
         two used to differ, and the persistent one was the wrong one. */
      data[0].kind === "sms"
        ? "Withdrawn. We will not text you about this claim."
        : "Withdrawn. We will not send you marketing email about this claim — messages about the claim itself still reach you.",
  };
}
