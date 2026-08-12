"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { claimCapabilities } from "@/lib/claims/capabilities";
import { notifyCustomerOfReply } from "@/lib/claims/notify";
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
import { claimPolicySchema, CLAIM_POLICY_FIELDS } from "@/lib/validators/claims";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  submittedValues,
  type FormState,
} from "./types";

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
      "id, claim_ref, status, assigned_adjuster_id, carrier, policy_number, carrier_tenure",
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

const EVENT_VISIBILITIES = ["internal", "customer", "partner", "shared"] as const;
type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

function isEventVisibility(value: string): value is EventVisibility {
  return (EVENT_VISIBILITIES as readonly string[]).includes(value);
}

export async function postClaimEvent(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "internal");
  const isReply = String(formData.get("isReply") ?? "") === "true";
  const typed = submittedValues(formData, ["body"]);

  const loaded = await loadClaimForWrite(claimId);
  if ("error" in loaded) return { ...loaded.error, values: typed };
  const { claim } = loaded;

  /* Both of these are facts about the textarea, so they arrive as
     `fieldErrors.body` and the field wears the invalid border like every other
     refused field in this workspace. They were form-level only: the composer
     was the one surface that said "Write something before posting." with
     nothing marked, which reads as a complaint about the form rather than an
     instruction about the box. */
  if (body.length === 0) {
    return {
      status: "error",
      fieldErrors: { body: "Write something before posting." },
      message: "Check the highlighted field and post again.",
      values: typed,
    };
  }

  if (body.length > 4000) {
    return {
      status: "error",
      fieldErrors: {
        body: "That is longer than a feed entry can hold (4,000 characters).",
      },
      message: "Check the highlighted field and post again.",
      values: typed,
    };
  }

  if (!isEventVisibility(visibility)) {
    return { status: "error", message: "Pick who should see this entry.", values: typed };
  }

  const can = claimCapabilities(
    { userId: session.userId, role: session.role },
    { assignedAdjusterId: claim.assigned_adjuster_id },
  );

  // `claim_events_insert_staff` refuses an assistant a `partner` or `shared`
  // entry — those are disclosures to a referring contractor, not notes. Checked
  // here so the refusal names the reason instead of returning an empty insert.
  if (!can.canPostShared && (visibility === "partner" || visibility === "shared")) {
    return {
      status: "error",
      message:
        "Entries visible to the referring partner are posted by the owner or the assigned adjuster.",
      values: typed,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claim_events")
    .insert({
      claim_id: claimId,
      type: isReply ? "reply" : "note",
      body,
      author_id: session.userId,
      visibility,
    })
    .select("id");

  if (error) {
    console.error("[claims] event insert failed", error.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  if ((data?.length ?? 0) === 0) {
    return { status: "error", message: REFUSED_BY_RLS, values: typed };
  }

  /* Spec §6's "reply posted (customer)". Driven by whether the homeowner can
     read the entry rather than by `isReply`: `visibility` is the deliberate
     choice the composer already forces, and `internal` — its default — is the
     one that stays silent. `notify.ts` records the reasoning. */
  const notifyWarning =
    visibility === "customer" || visibility === "shared"
      ? await notifyCustomerOfReply({ claimId, body })
      : null;

  revalidateClaim(claimId);
  return {
    status: "success",
    message: notifyWarning ? `Posted. ${notifyWarning}` : "Posted.",
  };
}

/**
 * `claim_financials` is keyed on `claim_id`, so this is an upsert rather than an
 * insert-or-update pair. RLS is the whole authorization: owner and the assigned
 * adjuster hold `claim_financials_insert`/`_update`, and an assistant holds no
 * policy on the table at all, so their write returns zero rows.
 */
export async function saveClaimFinancials(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
  /* The two figures are controlled inputs and hold their own value across a
     refusal; `notes` is an uncontrolled textarea and did not, so a rejected fee
     percentage also erased the paragraph explaining how the figure was reached.
     All three are echoed so the rule is "the action hands back what it read",
     not "the action hands back the fields that happen to be uncontrolled
     today". */
  const typed = submittedValues(formData, [
    "settlementAmount",
    "feePercent",
    "notes",
  ]);

  const loaded = await loadClaimForWrite(claimId);
  if ("error" in loaded) return { ...loaded.error, values: typed };
  const { claim } = loaded;

  const parsed = parseMoneyFields(formData);
  if ("error" in parsed) return { ...parsed.error, values: typed };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claim_financials")
    .upsert(
      {
        claim_id: claimId,
        settlement_amount: parsed.settlementAmount,
        fee_percent: parsed.feePercent,
        notes: parsed.notes,
        updated_by: session.userId,
      },
      { onConflict: "claim_id" },
    )
    .select("claim_id");

  if (error) {
    console.error("[claims] financials upsert failed", error.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  if ((data?.length ?? 0) === 0) {
    return {
      status: "error",
      message:
        "Settlement figures are recorded by the owner and by the adjuster the claim is assigned to.",
      values: typed,
    };
  }

  revalidateClaim(claimId);
  return { status: "success", message: `Figures saved for ${claim.claim_ref}.` };
}

type MoneyFields = {
  settlementAmount: number | null;
  feePercent: number | null;
  notes: string | null;
};

/**
 * The largest value `claim_financials.settlement_amount` can hold. The column is
 * `numeric(12, 2)` — twelve significant digits, two of them after the point — so
 * ten digits before it, and this is the last one that fits.
 *
 * Stated here because the bound existed only in the column's precision. The
 * validator below checked `>= 0` and nothing else, so `10000000000` passed every
 * check this process makes, reached Postgres, and came back `numeric field value
 * out of range`. That is not a shape the action recognises, so it fell to the
 * generic handler and the staff member was told "We could not submit that just
 * now… call us and we'll take the details over the phone" — a message written
 * for a homeowner whose network dropped, shown to a colleague at their desk
 * about a number they typed, with no `aria-invalid` on the field, nothing beneath
 * it, and no retry that could ever succeed. The one thing they needed to know —
 * which field, and what range — was the one thing not said.
 *
 * The lower bound has always been here and the upper one belongs beside it.
 */
const MAX_SETTLEMENT_AMOUNT = 9_999_999_999.99;

/**
 * Blank means "not recorded yet" and is written as NULL, which is different from
 * zero — a settlement of $0 is a real outcome and must survive a round trip.
 * The table states the same bounds — a CHECK for the floor, the column's own
 * `numeric(12, 2)` precision for the ceiling — and these produce the message a
 * person can act on.
 *
 * Both fields are judged before either answer is returned. Returning on the
 * first failure made the form lie about itself: with an out-of-range amount
 * *and* an out-of-range percentage, only the amount came back with an error and
 * an `aria-invalid`, under a summary that said "Check the highlighted fields" —
 * plural, over one highlight. Fixing the amount and saving then surfaced the
 * percentage, so a form the staff member could have corrected in one pass cost
 * two round trips and taught them the summary could not be trusted to be
 * complete.
 *
 * The summary agrees in number with what it is pointing at, for the same reason:
 * "fields" over a single highlighted input is a sentence telling the reader to
 * go looking for something that is not there.
 */
function parseMoneyFields(formData: FormData): MoneyFields | { error: FormState } {
  const rawAmount = String(formData.get("settlementAmount") ?? "").trim();
  const rawFee = String(formData.get("feePercent") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const fieldErrors: Record<string, string> = {};

  let settlementAmount: number | null = null;
  if (rawAmount.length > 0) {
    const value = Number(rawAmount.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(value) || value < 0 || value > MAX_SETTLEMENT_AMOUNT) {
      fieldErrors.settlementAmount =
        "Enter an amount between $0 and $9,999,999,999.99.";
    } else {
      settlementAmount = Math.round(value * 100) / 100;
    }
  }

  let feePercent: number | null = null;
  if (rawFee.length > 0) {
    const value = Number(rawFee.replace(/[%\s]/g, ""));
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      fieldErrors.feePercent = "Enter a percentage between 0 and 100.";
    } else {
      feePercent = Math.round(value * 100) / 100;
    }
  }

  const flagged = Object.keys(fieldErrors).length;
  if (flagged > 0) {
    return {
      error: {
        status: "error",
        fieldErrors,
        message:
          flagged === 1
            ? "Check the highlighted field and save again."
            : "Check the highlighted fields and save again.",
      },
    };
  }

  return { settlementAmount, feePercent, notes };
}
