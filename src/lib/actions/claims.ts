"use server";

import { revalidatePath } from "next/cache";
import { claimCapabilities } from "@/lib/claims/capabilities";
import { recordTransition } from "@/lib/claims/record-transition";
import { isClaimStatus, STATUS_LABEL, type ClaimStatus } from "@/lib/claims/status";
import { hasSignedLor, isLegalTransition } from "@/lib/claims/transitions";
import { requireStaff } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { GENERIC_ERROR, type FormState } from "./types";

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
 * service-role reach is inside `recordTransition`, for `notifications_outbox`,
 * which has no policy for `authenticated` by design.
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
    .select("id, claim_ref, status, assigned_adjuster_id")
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

  const loaded = await loadClaimForWrite(claimId);
  if ("error" in loaded) return loaded.error;
  const { claim } = loaded;

  if (!isClaimStatus(requested)) {
    return { status: "error", message: "That is not a claim status." };
  }

  const supabase = await createClient();

  // Asked of `public.allowed_claim_transitions()` — the same function the
  // BEFORE UPDATE trigger consults. If this check and the trigger ever disagree
  // it is because the RPC failed, and it fails closed.
  if (!(await isLegalTransition(supabase, claim.status, requested))) {
    return {
      status: "error",
      message: `${STATUS_LABEL[claim.status]} cannot move to ${STATUS_LABEL[requested]}. That is not a step this claim can take.`,
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
    };
  }

  const { data: updated, error } = await supabase
    .from("claims")
    .update({ status: requested })
    .eq("id", claimId)
    .select("id");

  if (error) {
    console.error("[claims] status update failed", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  // Zero rows is RLS declining the write, not an error. An assistant reaches
  // this line — `claims_select` shows them every claim — and
  // `claims_update_manage` is what stops them.
  if ((updated?.length ?? 0) === 0) {
    return { status: "error", message: REFUSED_BY_RLS };
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
  await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
  const raw = String(formData.get("adjusterId") ?? "").trim();
  const adjusterId = raw.length > 0 ? raw : null;

  const loaded = await loadClaimForWrite(claimId);
  if ("error" in loaded) return loaded.error;
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
    if (error.code === "42501") return { status: "error", message: REFUSED_BY_RLS };
    if (error.code === "23514") {
      return {
        status: "error",
        message: "A claim can only be assigned to an active adjuster.",
      };
    }
    console.error("[claims] reassign failed", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidateClaim(claimId);

  return {
    status: "success",
    message: adjusterId
      ? `${claim.claim_ref} reassigned.`
      : `${claim.claim_ref} returned to the intake queue.`,
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

  const loaded = await loadClaimForWrite(claimId);
  if ("error" in loaded) return loaded.error;
  const { claim } = loaded;

  if (body.length === 0) {
    return { status: "error", message: "Write something before posting." };
  }

  if (body.length > 4000) {
    return { status: "error", message: "That is longer than a feed entry can hold (4,000 characters)." };
  }

  if (!isEventVisibility(visibility)) {
    return { status: "error", message: "Pick who should see this entry." };
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
    return { status: "error", message: GENERIC_ERROR };
  }

  if ((data?.length ?? 0) === 0) {
    return { status: "error", message: REFUSED_BY_RLS };
  }

  revalidateClaim(claimId);
  return { status: "success", message: "Posted." };
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

  const loaded = await loadClaimForWrite(claimId);
  if ("error" in loaded) return loaded.error;
  const { claim } = loaded;

  const parsed = parseMoneyFields(formData);
  if ("error" in parsed) return parsed.error;

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
    return { status: "error", message: GENERIC_ERROR };
  }

  if ((data?.length ?? 0) === 0) {
    return {
      status: "error",
      message:
        "Settlement figures are recorded by the owner and by the adjuster the claim is assigned to.",
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
 * Blank means "not recorded yet" and is written as NULL, which is different from
 * zero — a settlement of $0 is a real outcome and must survive a round trip.
 * The CHECK constraints on the table state the same bounds; these produce the
 * message a person can act on.
 */
function parseMoneyFields(formData: FormData): MoneyFields | { error: FormState } {
  const rawAmount = String(formData.get("settlementAmount") ?? "").trim();
  const rawFee = String(formData.get("feePercent") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  let settlementAmount: number | null = null;
  if (rawAmount.length > 0) {
    const value = Number(rawAmount.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(value) || value < 0) {
      return {
        error: {
          status: "error",
          fieldErrors: { settlementAmount: "Enter an amount of 0 or more." },
          message: "Check the highlighted fields and save again.",
        },
      };
    }
    settlementAmount = Math.round(value * 100) / 100;
  }

  let feePercent: number | null = null;
  if (rawFee.length > 0) {
    const value = Number(rawFee.replace(/[%\s]/g, ""));
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return {
        error: {
          status: "error",
          fieldErrors: { feePercent: "Enter a percentage between 0 and 100." },
          message: "Check the highlighted fields and save again.",
        },
      };
    }
    feePercent = Math.round(value * 100) / 100;
  }

  return { settlementAmount, feePercent, notes };
}
