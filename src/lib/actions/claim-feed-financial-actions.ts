"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/authz";
import { claimCapabilities } from "@/lib/claims/capabilities";
import { notifyCustomerOfReply } from "@/lib/claims/notify";
import { isClaimStatus, type ClaimStatus } from "@/lib/claims/status";
import { createClient } from "@/lib/supabase/server";
import {
  GENERIC_ERROR,
  submittedValues,
  type FormState,
} from "./types";

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

export async function saveClaimFinancials(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
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

const MAX_SETTLEMENT_AMOUNT = 9_999_999_999.99;

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
