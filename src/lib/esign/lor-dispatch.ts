import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";
import { namesAPolicy } from "@/lib/claims/transitions";
import { createAdminClient } from "@/lib/supabase/admin";
import { CAUSE_OPTIONS } from "@/lib/validators/intake-options";
import type { Database } from "@/types/database";
import { createESignProvider } from "./provider";
import {
  ESignError,
  type ESignMode,
  type ESignProvider,
  type LorRole,
  type LorSigner,
  type LorToken,
} from "./types";

type Admin = SupabaseClient<Database>;

export type SendLorInput = {
  claimId: string;
  /** Staff profile id — feed author and audit actor. */
  actorId?: string | null;
  /** Contingency fee stamped into the letter; falls back to claim_financials. */
  feePercent?: number | null;
  /** Overrides the covering message in the provider's notification email. */
  message?: string | null;
};

export type SendLorSuccess = {
  ok: true;
  mode: ESignMode;
  claimId: string;
  claimRef: string;
  providerDocumentId: string | null;
  esignStatus: string;
  /** False when the claim was already at `lor_sent` and this was a re-send. */
  transitioned: boolean;
  /** False in manual mode: staff still have to deliver the letter. */
  deliveredByProvider: boolean;
  recipients: string[];
};

export type SendLorFailureCode =
  | "claim_not_found"
  | "invalid_status"
  /** No carrier or no policy number: there is nobody to address the letter to. */
  | "missing_policy"
  | "no_claimants"
  | "not_configured"
  | "provider_error"
  | "persist_failed"
  /** Raised by the authorized entry point in `./send-lor`, never in here. */
  | "not_authorized";

export type SendLorFailure = { ok: false; code: SendLorFailureCode; message: string };

export type SendLorResult = SendLorSuccess | SendLorFailure;

export type SendLorDeps = {
  admin?: Admin;
  provider?: ESignProvider;
};

const ROLES: LorRole[] = ["Homeowner1", "Homeowner2"];

const causeLabel = (value: string) =>
  CAUSE_OPTIONS.find((option) => option.value === value)?.label ?? value;

function tokensFor(
  claim: ClaimRow,
  signers: LorSigner[],
  adjusterName: string | null,
  feePercent: number | null,
): LorToken[] {
  const address = [
    claim.property_street,
    claim.property_street2,
    `${claim.property_city}, ${claim.property_state} ${claim.property_zip}`,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");

  const nameFor = (role: LorRole) => {
    const signer = signers.find((candidate) => candidate.role === role);
    return signer ? `${signer.firstName} ${signer.lastName}` : "";
  };

  return [
    { name: "Claim.Ref", value: claim.claim_ref },
    /* Both are nullable in the type since Phase 6 — a partner referral carries
       no policy side until staff record it — and neither is null by the time it
       reaches here: `dispatchLorForClaim` refuses the claim above. The coalesce
       is what the type requires, not a blank the letter is willing to print.
       `Claim.ClaimNumber` is different and stays optional: the carrier issues it
       after the claim is filed, so a letter sent before then honestly has none. */
    { name: "Claim.Carrier", value: claim.carrier ?? "" },
    { name: "Claim.PolicyNumber", value: claim.policy_number ?? "" },
    { name: "Claim.ClaimNumber", value: claim.claim_number ?? "" },
    { name: "Claim.LossDate", value: claim.loss_date },
    { name: "Claim.Cause", value: causeLabel(claim.cause) },
    { name: "Property.Address", value: address },
    { name: "Homeowner1.Name", value: nameFor("Homeowner1") },
    { name: "Homeowner2.Name", value: nameFor("Homeowner2") },
    { name: "Adjuster.Name", value: adjusterName ?? "" },
    { name: "Fee.Percent", value: feePercent === null ? "" : String(feePercent) },
  ];
}

const CLAIM_COLUMNS =
  "id, claim_ref, status, carrier, policy_number, claim_number, loss_date, cause, " +
  "property_street, property_street2, property_city, property_state, property_zip, " +
  "assigned_adjuster_id, pandadoc_document_id, esign_status";

type ClaimRow = Pick<
  Database["public"]["Tables"]["claims"]["Row"],
  | "id"
  | "claim_ref"
  | "status"
  | "carrier"
  | "policy_number"
  | "claim_number"
  | "loss_date"
  | "cause"
  | "property_street"
  | "property_street2"
  | "property_city"
  | "property_state"
  | "property_zip"
  | "assigned_adjuster_id"
  | "pandadoc_document_id"
  | "esign_status"
>;

/**
 * ⚠ THE MECHANISM, NOT AN ENTRY POINT. THIS FUNCTION PERFORMS NO
 * AUTHORIZATION.
 *
 * It reads and writes *any* claim by id through the service-role client, so a
 * caller that passes a claim id it was given by the user has handed that user
 * every claim in the business. `sendLor()` in `./send-lor` is the only thing
 * allowed to call it, and it is deliberately absent from `./index`, which is
 * the module the admin UI imports.
 *
 * The split exists because this function was previously the exported one. It
 * was safe only by the accident that no user-reachable caller had been written
 * yet — the LOR-send button is not wired — and "safe until somebody adds a
 * button" is not a property, it is a countdown. Splitting it means the unsafe
 * half cannot be reached by autocomplete from a server action.
 *
 * ---
 *
 * Puts the Letter of Representation in front of the claimants and records that
 * it happened (blueprint §"sendLor implementation steps", spec §6 "LOR").
 *
 * Provider-agnostic on purpose: the transport differs between PandaDoc and
 * manual sending, but the claim record does not. Both paths persist
 * `esign_status`, advance `under_review → lor_sent`, write a history row, post
 * a shared feed entry and leave an audit trail.
 *
 * Never throws for an expected condition — the admin UI gets a discriminated
 * result it can render. Re-sending from `lor_sent` is allowed and does not
 * re-transition.
 */
export async function dispatchLorForClaim(
  input: SendLorInput,
  deps: SendLorDeps = {},
): Promise<SendLorResult> {
  const admin = deps.admin ?? createAdminClient();
  const provider = deps.provider ?? createESignProvider();

  const { data: claim, error: claimError } = await admin
    .from("claims")
    .select(CLAIM_COLUMNS)
    .eq("id", input.claimId)
    .maybeSingle<ClaimRow>();

  if (claimError || !claim) {
    return {
      ok: false,
      code: "claim_not_found",
      message: `No claim ${input.claimId}`,
    };
  }

  if (claim.status !== "under_review" && claim.status !== "lor_sent") {
    return {
      ok: false,
      code: "invalid_status",
      message: `A Letter of Representation is sent from under_review; this claim is ${claim.status}.`,
    };
  }

  /* Refused before the provider is called, not after. The claim's own transition
     to `lor_sent` is gated on these two columns in the app and in
     `public.enforce_claim_status_transition()`, and without this check the
     database gate would fire on the UPDATE *below* — after the letter had been
     put in front of the homeowner. The order matters more than the rule: an
     unsent letter is a refusal, a sent one naming no carrier is a document that
     should never have existed. */
  if (!namesAPolicy(claim)) {
    return {
      ok: false,
      code: "missing_policy",
      message:
        "This claim has no carrier or policy number on file, and the letter is addressed to the carrier. Record them on the claim first.",
    };
  }

  const { data: claimants } = await admin
    .from("claimants")
    .select("first_name, last_name, email, is_primary, created_at")
    .eq("claim_id", claim.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (!claimants || claimants.length === 0) {
    return {
      ok: false,
      code: "no_claimants",
      message: "This claim has no claimants to sign the letter.",
    };
  }

  const signers: LorSigner[] = claimants.slice(0, ROLES.length).map((claimant, index) => ({
    email: claimant.email,
    firstName: claimant.first_name,
    lastName: claimant.last_name,
    role: ROLES[index],
  }));

  let feePercent = input.feePercent ?? null;
  if (feePercent === null) {
    const { data: financials } = await admin
      .from("claim_financials")
      .select("fee_percent")
      .eq("claim_id", claim.id)
      .maybeSingle();
    feePercent = financials?.fee_percent ?? null;
  }

  let adjusterName: string | null = null;
  if (claim.assigned_adjuster_id) {
    const { data: adjuster } = await admin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", claim.assigned_adjuster_id)
      .maybeSingle();
    adjusterName = adjuster
      ? [adjuster.first_name, adjuster.last_name].filter(Boolean).join(" ") || null
      : null;
  }

  let dispatch;
  try {
    dispatch = await provider.dispatchLor({
      claimId: claim.id,
      claimRef: claim.claim_ref,
      documentName: `LOR — ${claim.claim_ref}`,
      signers,
      tokens: tokensFor(claim, signers, adjusterName, feePercent),
      message: input.message ?? null,
    });
  } catch (error) {
    const code: SendLorFailureCode =
      error instanceof ESignError && error.code === "not_configured"
        ? "not_configured"
        : "provider_error";
    const message =
      error instanceof Error ? error.message : "The e-signature provider failed.";

    console.error("[esign] sendLor dispatch failed", {
      claimId: claim.id,
      mode: provider.kind,
      message,
    });
    await writeAudit(admin, {
      actorId: input.actorId ?? null,
      action: "esign.lor_send_failed",
      entity: "claims",
      entityId: claim.id,
      meta: { mode: provider.kind, code, message },
    });

    return { ok: false, code, message };
  }

  const transitioned = claim.status === "under_review";

  const { error: updateError } = await admin
    .from("claims")
    .update({
      ...(transitioned ? { status: "lor_sent" as const } : {}),
      esign_status: dispatch.esignStatus,
      pandadoc_document_id: dispatch.providerDocumentId ?? claim.pandadoc_document_id,
    })
    .eq("id", claim.id);

  if (updateError) {
    console.error("[esign] sendLor persist failed", {
      claimId: claim.id,
      message: updateError.message,
    });
    return {
      ok: false,
      code: "persist_failed",
      message: "The letter was sent but the claim could not be updated.",
    };
  }

  if (transitioned) {
    await admin.from("claim_status_history").insert({
      claim_id: claim.id,
      from_status: "under_review",
      to_status: "lor_sent",
      changed_by: input.actorId ?? null,
      note:
        provider.kind === "pandadoc"
          ? "Letter of Representation sent for signature via PandaDoc."
          : "Letter of Representation marked as sent (manual signing).",
    });
  }

  await admin.from("claim_events").insert({
    claim_id: claim.id,
    type: "status",
    visibility: "shared",
    author_id: input.actorId ?? null,
    body: dispatch.deliveredByProvider
      ? `Letter of Representation sent for signature to ${signers
          .map((signer) => signer.email)
          .join(" and ")}.`
      : "Letter of Representation marked as sent. Staff are delivering it outside the system.",
  });

  await writeAudit(admin, {
    actorId: input.actorId ?? null,
    action: "esign.lor_sent",
    entity: "claims",
    entityId: claim.id,
    meta: {
      mode: provider.kind,
      provider_document_id: dispatch.providerDocumentId,
      esign_status: dispatch.esignStatus,
      recipients: signers.map((signer) => signer.email),
      transitioned,
    },
  });

  return {
    ok: true,
    mode: provider.kind,
    claimId: claim.id,
    claimRef: claim.claim_ref,
    providerDocumentId: dispatch.providerDocumentId,
    esignStatus: dispatch.esignStatus,
    transitioned,
    deliveredByProvider: dispatch.deliveredByProvider,
    recipients: signers.map((signer) => signer.email),
  };
}
