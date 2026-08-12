"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { writeAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/authz";
import { claimCapabilities } from "@/lib/claims/capabilities";
import { recordTransition } from "@/lib/claims/record-transition";
import { isClaimStatus } from "@/lib/claims/status";
import { issueInvite } from "@/lib/invites";
import { clientIpFromHeaders, inetOrNull } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { claimPolicySchema, type ClaimPolicyInput } from "@/lib/validators/claims";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  submittedValues,
  type FormState,
} from "./types";

/**
 * What `AcceptForm` re-seeds after a refusal — every uncontrolled control on the
 * form, because React's post-action reset returns each of them to its mount-time
 * value otherwise.
 *
 * `partnerChoice` is not here because it is submitted from a hidden field driven
 * by client state, not from the radios. It was left out for a different and
 * wrong reason: a controlled radio was believed to survive the reset. It does
 * not — React clears `.checked` and, since the state has not changed, never
 * re-renders to restore it — so after the routine "Pick the referring company."
 * refusal the chip still read Existing while the field had vanished from the
 * submission, and this action reads an absent `partnerChoice` as "none". The
 * intake would have been accepted with no partner attached and nothing said.
 */
const ACCEPT_FIELDS = [
  "adjusterId",
  "partnerCompanyId",
  "newPartnerName",
  "carrier",
  "policyNumber",
  "carrierTenure",
  "note",
] as const;

const NOT_IN_QUEUE =
  "That intake is no longer in the queue — someone may have already worked it.";

const NOT_YOURS =
  "Accepting an intake assigns it and advances it, which is the owner's move. An unassigned claim has no adjuster to act on it.";

type QueueClaim = {
  id: string;
  claim_ref: string;
  status: string;
  assigned_adjuster_id: string | null;
  referrer_name: string | null;
  referrer_email: string | null;
  /** Null on a partner referral, which is how this action knows to ask for the
   *  policy side. Read from the row rather than inferred from the submission:
   *  the presence of a form field is a client's choice, and the requirement is
   *  a fact about the claim. */
  carrier: string | null;
};

async function loadQueuedClaim(
  claimId: string,
): Promise<{ claim: QueueClaim } | { error: FormState }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimId)) {
    return { error: { status: "error", message: NOT_IN_QUEUE } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select(
      "id, claim_ref, status, assigned_adjuster_id, referrer_name, referrer_email, carrier",
    )
    .eq("id", claimId)
    .maybeSingle();

  if (error || !data) return { error: { status: "error", message: NOT_IN_QUEUE } };
  if (data.status !== "new_intake") {
    return { error: { status: "error", message: NOT_IN_QUEUE } };
  }

  return { claim: data };
}

/**
 * ACCEPT — the one flow in the admin that touches five relations, an external
 * mail queue and the auth system.
 *
 * There is no client-side transaction to wrap it in: supabase-js issues one
 * PostgREST request per statement and each commits on its own. What is
 * available is *ordering*, and the order below is chosen so that every partial
 * failure leaves the intake in a state a second attempt can correct, with a
 * single atomic statement as the commit point.
 *
 *   1. Partner company created, if the operator chose to create one.
 *      Failure: nothing else has happened; the claim is still queued.
 *   2. Adjuster assigned, through `reassign_claim()`.
 *      Failure: still queued. Assignment is idempotent, so a retry is clean.
 *   3. ► COMMIT POINT — one UPDATE setting `partner_company_id` and `status`
 *      together. One statement is one transaction, so the claim never exists in
 *      a state where it has been accepted but not attributed, or attributed but
 *      not accepted. After this the intake leaves the queue and a second accept
 *      is refused by the `new_intake` check above, which is what makes the
 *      remaining steps safe to be non-transactional.
 *   4. History row, feed entry, homeowner email. Best-effort and *reported*:
 *      the `audit_claims` trigger has already recorded the state change with
 *      its actor, so the record of what happened cannot be lost here — only its
 *      presentation can, and any failure is returned as a sentence.
 *   5. Invites, last, because an email is the only step that cannot be undone.
 *      A failure here leaves an accepted claim whose claimants have no portal
 *      yet, which the Claimants tab fixes with one click.
 *
 * Steps 1–3 are refused outright for anyone but the owner, and not by a check
 * written here: `partner_companies_insert_owner`, `public.guard_claim_update()`
 * and `claims_update_manage` on a claim with no assigned adjuster each reduce
 * to `is_owner()`. The capability test below exists to say so in a sentence
 * before the write, not instead of it.
 */
export async function acceptIntake(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
  const adjusterId = String(formData.get("adjusterId") ?? "").trim();
  const partnerChoice = String(formData.get("partnerChoice") ?? "none");
  const partnerCompanyId = String(formData.get("partnerCompanyId") ?? "").trim();
  const newPartnerName = String(formData.get("newPartnerName") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const typed = submittedValues(formData, ACCEPT_FIELDS);

  const loaded = await loadQueuedClaim(claimId);
  if ("error" in loaded) return { ...loaded.error, values: typed };
  const { claim } = loaded;

  const can = claimCapabilities(
    { userId: session.userId, role: session.role },
    { assignedAdjusterId: claim.assigned_adjuster_id },
  );

  if (!can.canManage) return { status: "error", message: NOT_YOURS, values: typed };

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adjusterId)) {
    return {
      status: "error",
      fieldErrors: { adjusterId: "Choose the adjuster who will carry this claim." },
      message: "Check the highlighted field and accept again.",
      values: typed,
    };
  }

  /* The policy side of a partner referral. §6 puts it here — the referring rep
     is not asked for a carrier or a policy number, so acceptance is the moment
     CMG has the homeowner on the phone and can take them.
     `claim.carrier === null` is the test rather than "did the form send these",
     so a submission that simply omits the fields is refused instead of accepted
     with the gap intact. */
  const policyDetails = claim.carrier === null ? readPolicyDetails(formData) : null;
  if (policyDetails && "fieldErrors" in policyDetails) {
    const marked = Object.keys(policyDetails.fieldErrors).length;
    return {
      status: "error",
      fieldErrors: policyDetails.fieldErrors,
      message: `Check the highlighted ${marked === 1 ? "field" : "fields"} and accept again.`,
      values: typed,
    };
  }

  const supabase = await createClient();

  // ── 1. Partner company ────────────────────────────────────────────────
  let linkedPartnerId: string | null = null;

  if (partnerChoice === "existing") {
    if (!partnerCompanyId) {
      return {
        status: "error",
        fieldErrors: { partnerCompanyId: "Pick the referring company." },
        message: "Check the highlighted field and accept again.",
        values: typed,
      };
    }
    linkedPartnerId = partnerCompanyId;
  } else if (partnerChoice === "new") {
    if (newPartnerName.length === 0) {
      return {
        status: "error",
        fieldErrors: { newPartnerName: "Name the referring company." },
        message: "Check the highlighted field and accept again.",
        values: typed,
      };
    }

    const { data: created, error: companyError } = await supabase
      .from("partner_companies")
      .insert({
        name: newPartnerName,
        contact_name: claim.referrer_name,
        contact_email: claim.referrer_email,
      })
      .select("id");

    if (companyError) {
      console.error("[intake] partner company insert failed", companyError.message);
      return { status: "error", message: GENERIC_ERROR, values: typed };
    }

    if ((created?.length ?? 0) === 0) {
      return {
        status: "error",
        message: "Partner companies are created by the owner.",
        values: typed,
      };
    }

    linkedPartnerId = created![0].id;
  }

  // ── 2. Assignment ─────────────────────────────────────────────────────
  const { error: assignError } = await supabase.rpc("reassign_claim", {
    p_claim_id: claimId,
    p_new_adjuster: adjusterId,
  });

  if (assignError) {
    if (assignError.code === "42501") {
      return { status: "error", message: NOT_YOURS, values: typed };
    }
    if (assignError.code === "23514") {
      return {
        status: "error",
        fieldErrors: { adjusterId: "That is not an active adjuster." },
        message: "Check the highlighted field and accept again.",
        values: typed,
      };
    }
    console.error("[intake] assignment failed", assignError.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  // ── 3. Commit point: attribution, policy and status in one statement ──
  const update: {
    status: "under_review";
    partner_company_id?: string;
    carrier?: string;
    policy_number?: string;
    carrier_tenure?: ClaimPolicyInput["carrierTenure"];
  } = { status: "under_review" };
  if (linkedPartnerId) update.partner_company_id = linkedPartnerId;
  /* Carried by the same statement as the status change, so a referral cannot
     leave the queue with the gap still in it — the atomicity the comment above
     describes covers the policy columns for exactly the same reason it covers
     attribution. */
  if (policyDetails) {
    update.carrier = policyDetails.carrier;
    update.policy_number = policyDetails.policyNumber;
    update.carrier_tenure = policyDetails.carrierTenure;
  }

  const { data: advanced, error: advanceError } = await supabase
    .from("claims")
    .update(update)
    .eq("id", claimId)
    // Re-states the precondition inside the statement that depends on it, so two
    // operators accepting the same intake at once cannot both advance it — the
    // second matches zero rows instead of racing the read above.
    .eq("status", "new_intake")
    .select("id");

  if (advanceError) {
    console.error("[intake] accept update failed", advanceError.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  if ((advanced?.length ?? 0) === 0) {
    return { status: "error", message: NOT_IN_QUEUE, values: typed };
  }

  // ── 4. History, feed, homeowner notification ──────────────────────────
  const warnings = await recordTransition(supabase, {
    claimId,
    claimRef: claim.claim_ref,
    from: "new_intake",
    to: "under_review",
    note,
    actorId: session.userId,
  });

  // ── 5. Invites ────────────────────────────────────────────────────────
  const ip = inetOrNull(clientIpFromHeaders(await headers()));
  const invited = await inviteClaimants(claimId, claim.claim_ref, session.userId, ip);
  if (invited.failed > 0) {
    warnings.push(
      `${invited.failed} portal invitation${invited.failed === 1 ? "" : "s"} could not be sent. Resend from the Claimants tab.`,
    );
  }

  await writeAudit(createAdminClient(), {
    actorId: session.userId,
    action: "claim.intake_accepted",
    entity: "claims",
    entityId: claimId,
    meta: {
      claim_ref: claim.claim_ref,
      assigned_adjuster_id: adjusterId,
      partner_company_id: linkedPartnerId,
      partner_choice: partnerChoice,
      invites_issued: invited.sent,
      invites_failed: invited.failed,
    },
    ip,
  });

  revalidatePath("/admin/intake");
  revalidatePath("/admin/claims");
  revalidatePath(`/admin/claims/${claimId}`, "layout");
  revalidatePath("/admin");

  const sentence =
    invited.sent > 0
      ? `${claim.claim_ref} accepted and under review. ${invited.sent} portal invitation${invited.sent === 1 ? "" : "s"} issued.`
      : `${claim.claim_ref} accepted and under review.`;

  return {
    status: "success",
    message: warnings.length > 0 ? `${sentence} ${warnings.join(" ")}` : sentence,
  };
}

type PolicyDetails = ClaimPolicyInput;

/**
 * The three columns a partner referral arrives without.
 *
 * The rules moved to `claimPolicySchema` when the Overview's policy panel became
 * the second caller — accept is where the gap is *first* closed and no longer
 * the only place it can be. Two hand-rolled copies of "required, 120
 * characters, one of three enum labels" are two places for a bound to drift, and
 * a carrier the public form would refuse must not be admitted through either
 * desk screen.
 */
function readPolicyDetails(
  formData: FormData,
): PolicyDetails | { fieldErrors: Record<string, string> } {
  const parsed = claimPolicySchema.safeParse({
    carrier: formData.get("carrier") ?? "",
    policyNumber: formData.get("policyNumber") ?? "",
    carrierTenure: formData.get("carrierTenure") ?? "",
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  return parsed.data;
}

async function inviteClaimants(
  claimId: string,
  claimRef: string,
  invitedBy: string,
  ip: string | null,
): Promise<{ sent: number; failed: number }> {
  const supabase = await createClient();
  const { data: claimants } = await supabase
    .from("claimants")
    .select("id, first_name, email, user_id")
    .eq("claim_id", claimId)
    .is("user_id", null);

  let sent = 0;
  let failed = 0;

  for (const claimant of claimants ?? []) {
    const result = await issueInvite({
      email: claimant.email,
      role: "customer",
      claimId,
      invitedBy,
      firstName: claimant.first_name,
      claimRef,
      ip,
    });

    if (result.ok) sent += 1;
    else failed += 1;
  }

  return { sent, failed };
}

/**
 * REJECT — spec §5's `rejected` status: the intake is archived and no invite is
 * ever issued. There is nothing to undo and nothing to send, so this is a
 * single statement plus its record.
 *
 * `recordTransition` writes the feed entry at `internal` visibility for a
 * rejected claim (see `visibilityForStatus`) and therefore sends no email — the
 * homeowner never had a portal account, because acceptance is what creates one.
 */
export async function rejectIntake(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const typed = submittedValues(formData, ["reason"]);

  const loaded = await loadQueuedClaim(claimId);
  if ("error" in loaded) return { ...loaded.error, values: typed };
  const { claim } = loaded;

  if (reason.length < 4) {
    return {
      status: "error",
      fieldErrors: { reason: "Say why this intake is being declined." },
      message: "Check the highlighted field and try again.",
      values: typed,
    };
  }

  if (!isClaimStatus(claim.status)) {
    return { status: "error", message: NOT_IN_QUEUE, values: typed };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .update({ status: "rejected" })
    .eq("id", claimId)
    .eq("status", "new_intake")
    .select("id");

  if (error) {
    console.error("[intake] reject failed", error.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  if ((data?.length ?? 0) === 0) {
    // Zero rows here is either a race with another operator or
    // `claims_update_manage` declining the write. Both are honest as one
    // message; separating them would report the policy outcome for a claim the
    // caller may not be entitled to know the state of.
    return { status: "error", message: NOT_IN_QUEUE, values: typed };
  }

  const warnings = await recordTransition(supabase, {
    claimId,
    claimRef: claim.claim_ref,
    from: "new_intake",
    to: "rejected",
    note: reason,
    actorId: session.userId,
  });

  await writeAudit(createAdminClient(), {
    actorId: session.userId,
    action: "claim.intake_rejected",
    entity: "claims",
    entityId: claimId,
    meta: { claim_ref: claim.claim_ref, reason },
    ip: inetOrNull(clientIpFromHeaders(await headers())),
  });

  revalidatePath("/admin/intake");
  revalidatePath("/admin/claims");
  revalidatePath("/admin");

  const sentence = `${claim.claim_ref} declined and archived. No invitation was sent.`;
  return {
    status: "success",
    message: warnings.length > 0 ? `${sentence} ${warnings.join(" ")}` : sentence,
  };
}
