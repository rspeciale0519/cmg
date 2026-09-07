"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { recordTransition } from "@/lib/claims/record-transition";
import { isClaimStatus, STATUS_LABEL, type ClaimStatus } from "@/lib/claims/status";
import {
  hasSignedLor,
  isLegalTransition,
  namesAPolicy,
  NO_POLICY_REASON,
} from "@/lib/claims/transitions";
import { requireStaff } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database-app";
import { claimPolicySchema, CLAIM_POLICY_FIELDS } from "@/lib/validators/claims";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  submittedValues,
  type FormState,
} from "./types";
import {
  postClaimEvent as postClaimEventAction,
  saveClaimFinancials as saveClaimFinancialsAction,
} from "./claim-feed-financial-actions";

/**
 * Every action here follows the same three steps, in this order:
 *
 *   1. `requireStaff()` — staff role *and* aal2, or the request never reaches a
 *      query. Explicit, per action, never inherited from a layout: a layout
 *      guard protects the page, and a server action is not the page.
 *   2. Read the claim through the *caller's* client, so `claims_select` decides
 *      whether it exists for them. Zero rows leaves as the same refusal a
 *      nonexistent id gets (spec §7.9).
 *   3. Write through the same client, so `claims_update_manage`,
 *      `claim_events_insert_staff` and friends are the thing that actually
 *      permits or refuses it. The TypeScript checks above are there to produce a
 *      sentence instead of a raised exception — they are not the boundary.
 *
 * Nothing in this file uses the service-role client for a claim write. The only
 * service-role reaches are inside `recordTransition`, for `notifications_outbox`,
 * and `writeAudit` in `saveClaimPolicy` — both for tables that have no policy for
 * `authenticated` by design.
 */

const NOT_YOURS =
  "That claim is not available to you, or it no longer exists. Ask the owner if you need it reassigned.";

const REFUSED_BY_RLS =
  "You do not hold the authority to change this claim. Status and assignment belong to the owner and to the adjuster the claim is assigned to.";

type ClaimRow = {
  id: string;
  claim_ref: string;
  status: ClaimStatus;
  assigned_adjuster_id: string | null;
  /* The policy side, read here rather than in a second query: one action gates
     on it and another rewrites it, and both already hold this row. Nullable
     since Phase 6 — a partner referral carries none of it. */
  carrier: string | null;
  policy_number: string | null;
  carrier_tenure: string | null;
  lor_contract_type: Database["public"]["Enums"]["lor_contract_type"] | null;
};

async function loadClaimForWrite(
  claimId: string,
): Promise<{ claim: ClaimRow } | { error: FormState }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimId)) {
    return { error: { status: "error", message: NOT_YOURS } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select(
      "id, claim_ref, status, assigned_adjuster_id, carrier, policy_number, carrier_tenure, lor_contract_type",
    )
    .eq("id", claimId)
    .maybeSingle();

  if (error || !data || !isClaimStatus(data.status)) {
    return { error: { status: "error", message: NOT_YOURS } };
  }

  return { claim: { ...data, status: data.status } };
}

function revalidateClaim(claimId: string) {
  revalidatePath(`/admin/claims/${claimId}`, "layout");
  revalidatePath("/admin/claims");
  revalidatePath("/admin");
}

export async function advanceClaimStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
  const requested = String(formData.get("to") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  /* The note is an uncontrolled textarea, so a refused move used to discard the
     sentence the adjuster had written for the homeowner. The chosen status is
     handed back by a hidden field in `StatusAdvance` rather than echoed here —
     it was assumed to survive the reset as client state, and it does not. */
  const typed = submittedValues(formData, ["note"]);

  const loaded = await loadClaimForWrite(claimId);
  if ("error" in loaded) return { ...loaded.error, values: typed };
  const { claim } = loaded;

  if (!isClaimStatus(requested)) {
    return { status: "error", message: "That is not a claim status.", values: typed };
  }

  const supabase = await createClient();

  // Asked of `public.allowed_claim_transitions()` — the same function the
  // BEFORE UPDATE trigger consults. If this check and the trigger ever disagree
  // it is because the RPC failed, and it fails closed.
  if (!(await isLegalTransition(supabase, claim.status, requested))) {
    return {
      status: "error",
      message: `${STATUS_LABEL[claim.status]} cannot move to ${STATUS_LABEL[requested]}. That is not a step this claim can take.`,
      values: typed,
    };
  }

  /* The gate on the move that produces the letter, checked for the same reason
     the document gate below is: a Letter of Representation is addressed to an
     insurance carrier and cites a policy, and this claim may hold neither — a
     partner referral is not asked for them (§6) and the accept form, which
     collects them, is not the only way out of `new_intake`.

     `StatusAdvance` already renders this move disabled with this sentence under
     it. That is a courtesy; this is the gate. The claim row was read through the
     caller's own client above, so `claims_select` is what decided it exists. */
  if (requested === "lor_sent" && !namesAPolicy(claim)) {
    return {
      status: "error",
      message: `${claim.claim_ref} has no carrier or policy number on file. ${NO_POLICY_REASON}`,
      values: typed,
    };
  }

  // Spec §5's document gate, checked here so the refusal is a sentence about
  // uploading a letter rather than a 23514 from the trigger. The trigger still
  // refuses underneath — this is the first of the two enforcement layers, not a
  // replacement for the second.
  if (requested === "lor_signed" && !(await hasSignedLor(supabase, claimId))) {
    return {
      status: "error",
      message:
        "This claim cannot be marked LOR signed until a signed letter of representation is on the file. Upload it under Documents with kind “LOR signed”, then advance the status.",
      values: typed,
    };
  }

  const { data: updated, error } = await supabase
    .from("claims")
    .update({ status: requested })
    .eq("id", claimId)
    .select("id");

  if (error) {
    console.error("[claims] status update failed", error.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  // Zero rows is RLS declining the write, not an error. An assistant reaches
  // this line — `claims_select` shows them every claim — and
  // `claims_update_manage` is what stops them.
  if ((updated?.length ?? 0) === 0) {
    return { status: "error", message: REFUSED_BY_RLS, values: typed };
  }

  const warnings = await recordTransition(supabase, {
    claimId,
    claimRef: claim.claim_ref,
    from: claim.status,
    to: requested,
    note,
    actorId: session.userId,
  });

  revalidateClaim(claimId);

  return {
    status: "success",
    message:
      warnings.length > 0
        ? warnings.join(" ")
        : `${claim.claim_ref} is now ${STATUS_LABEL[requested].toLowerCase()}.`,
  };
}

/**
 * Assignment goes through the RPC and cannot go any other way. A direct UPDATE
 * is refused for an adjuster handing a claim off: Postgres applies SELECT
 * policies to the *new* row, and the instant `assigned_adjuster_id` names
 * someone else the row is outside `claims_select` for the caller. The function
 * judges the caller against the pre-update row and then writes as its owner.
 */
export async function reassignClaimAdjuster(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
  const raw = String(formData.get("adjusterId") ?? "").trim();
  const adjusterId = raw.length > 0 ? raw : null;
  const typed = submittedValues(formData, ["adjusterId"]);

  const loaded = await loadClaimForWrite(claimId);
  if ("error" in loaded) return { ...loaded.error, values: typed };
  const { claim } = loaded;

  const supabase = await createClient();
  const { error } = await supabase.rpc("reassign_claim", {
    p_claim_id: claimId,
    p_new_adjuster: adjusterId as string,
  });

  if (error) {
    // 42501 is the function's own refusal — "not yours" and "no such claim"
    // deliberately collapsed to one message inside it. 23514 is the active-
    // adjuster check. Anything else is a fault.
    if (error.code === "42501") {
      return { status: "error", message: REFUSED_BY_RLS, values: typed };
    }
    if (error.code === "23514") {
      return {
        status: "error",
        message: "A claim can only be assigned to an active adjuster.",
        values: typed,
      };
    }
    console.error("[claims] reassign failed", error.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  revalidateClaim(claimId);

  /**
   * An adjuster who hands the claim on has just left their own view of it.
   * `claims_select` scopes them to `assigned_adjuster_id = auth.uid()`, and
   * `reassign_claim` judges the caller against the row as it was — so the write
   * is allowed and the row then disappears. Re-rendering in place put the
   * success sentence on a screen that had become the workspace's 404: the
   * operator was told nothing and shown "That page isn't in the workspace."
   *
   * Sending them to the list is not a courtesy, it is the only place the message
   * can be read. The owner and the assistant keep every claim in view, so they
   * stay where they are.
   */
  const strandedSelf =
    session.role === "adjuster" &&
    claim.assigned_adjuster_id === session.userId &&
    adjusterId !== session.userId;

  if (strandedSelf) {
    redirect(
      adjusterId
        ? `/admin/claims?handedOn=${encodeURIComponent(claim.claim_ref)}`
        : `/admin/claims?released=${encodeURIComponent(claim.claim_ref)}`,
    );
  }

  return {
    status: "success",
    message: adjusterId
      ? `${claim.claim_ref} reassigned.`
      : `${claim.claim_ref} returned to the intake queue.`,
  };
}

/**
 * The policy side of a claim, written from the Overview.
 *
 * It exists because until now nothing could write these three columns after
 * accept. That was tolerable while `acceptIntake` was believed to be the only
 * way out of `new_intake` — it collects them when the claim it is accepting has
 * none — and it is not: the status picker moves a partner referral to
 * `under_review` without ever opening the accept form, and from there the file
 * was one legal move from a Letter of Representation naming no carrier. The
 * transition is now refused; this is the screen that lifts the refusal.
 *
 * It is equally the place a correction is made. A carrier taken down a phone
 * line is misheard, and a claim whose policy number is wrong is worse than one
 * whose policy number is missing: the second announces itself.
 *
 * Authorization is `claims_update_manage` — owner or the assigned adjuster —
 * and it is the write itself that asks. An assistant reaches this line, because
 * `claims_select` shows them every claim, and their UPDATE matches zero rows.
 */
export async function saveClaimPolicy(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
  const typed = submittedValues(formData, CLAIM_POLICY_FIELDS);

  const loaded = await loadClaimForWrite(claimId);
  if ("error" in loaded) return { ...loaded.error, values: typed };
  const { claim } = loaded;

  const parsed = claimPolicySchema.safeParse({
    carrier: formData.get("carrier") ?? "",
    policyNumber: formData.get("policyNumber") ?? "",
    carrierTenure: formData.get("carrierTenure") ?? "",
    lorContractType: formData.get("lorContractType") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error);
    const marked = Object.keys(fieldErrors).length;
    return {
      status: "error",
      fieldErrors,
      // "field" over one highlight, "fields" over several — the count the claim
      // screens already keep, rather than `invalid()`'s "submit again" under a
      // button that says Save.
      message: `Check the highlighted ${marked === 1 ? "field" : "fields"} and save again.`,
      values: typed,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .update({
      carrier: parsed.data.carrier,
      policy_number: parsed.data.policyNumber,
      carrier_tenure: parsed.data.carrierTenure,
      lor_contract_type: parsed.data.lorContractType,
    })
    .eq("id", claimId)
    .select("id");

  if (error) {
    console.error("[claims] policy update failed", error.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  if ((data?.length ?? 0) === 0) {
    return {
      status: "error",
      message:
        "The carrier and policy are recorded by the owner and by the adjuster the claim is assigned to.",
      values: typed,
    };
  }

  /* `audit_claims` has already logged the column-by-column diff with its actor,
     so this row is not the record of *what* changed. It is the record of what
     the change was for: these three columns are what the `lor_sent` gate reads,
     and an entry naming the claim and saying whether the file had a carrier
     before is what an auditor reading backwards from a letter needs. */
  await writeAudit(createAdminClient(), {
    actorId: session.userId,
    action: "claim.policy_updated",
    entity: "claims",
    entityId: claimId,
    meta: {
      claim_ref: claim.claim_ref,
      carrier: parsed.data.carrier,
      policy_number: parsed.data.policyNumber,
      carrier_tenure: parsed.data.carrierTenure,
      lor_contract_type: parsed.data.lorContractType,
      first_entry: !namesAPolicy(claim),
    },
  });

  revalidateClaim(claimId);

  /* Three sentences, because "saved" is the least useful of them. A correction
     is not a first entry, and a first entry made while the claim is sitting at
     `under_review` has just lifted the block the operator was reading a moment
     ago — which is the outcome they came here for, and the one place it can be
     confirmed. Anywhere earlier in the lifecycle there is no block to lift yet,
     so saying so would be describing a screen they have not seen. */
  if (namesAPolicy(claim)) {
    return {
      status: "success",
      message: `Policy details updated for ${claim.claim_ref}.`,
    };
  }

  return {
    status: "success",
    message:
      claim.status === "under_review"
        ? `Policy details recorded for ${claim.claim_ref}. The letter of representation is no longer held back.`
        : `Policy details recorded for ${claim.claim_ref}.`,
  };
}

export async function postClaimEvent(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return postClaimEventAction(previous, formData);
}

/**
 * `claim_financials` is keyed on `claim_id`, so this is an upsert rather than an
 * insert-or-update pair. RLS is the whole authorization: owner and the assigned
 * adjuster hold `claim_financials_insert`/`_update`, and an assistant holds no
 * policy on the table at all, so their write returns zero rows.
 */
export async function saveClaimFinancials(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveClaimFinancialsAction(previous, formData);
}
