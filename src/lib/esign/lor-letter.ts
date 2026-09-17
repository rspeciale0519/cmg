import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { namesAPolicy } from "@/lib/claims/transitions";
import { CAUSE_OPTIONS } from "@/lib/validators/intake-options";
import type { Database } from "@/types/database-app";
import type { LorRole, LorSigner, LorToken } from "./types";

type Admin = SupabaseClient<Database>;

/**
 * What goes *into* a Letter of Representation, and the refusals that stop one
 * being written at all.
 *
 * Extracted from `./lor-dispatch` so the two things that produce a letter —
 * sending it through PandaDoc, and handing staff a prefilled PDF to upload
 * themselves (`./prefill-lor`) — read the claim through one function and are
 * refused by one set of gates. A second copy of these rules is a second place
 * for a letter naming no carrier, or carrying a fee nobody recorded, to come
 * into existence.
 */

export const ROLES: LorRole[] = ["Homeowner1", "Homeowner2"];

export const CLAIM_COLUMNS =
  "id, claim_ref, status, carrier, policy_number, claim_number, lor_contract_type, loss_date, cause, " +
  "property_street, property_street2, property_city, property_state, property_zip, " +
  "assigned_adjuster_id, requested_adjuster, pandadoc_document_id, esign_status";

export type ClaimRow = Pick<
  Database["public"]["Tables"]["claims"]["Row"],
  | "id"
  | "claim_ref"
  | "status"
  | "carrier"
  | "policy_number"
  | "claim_number"
  | "lor_contract_type"
  | "loss_date"
  | "cause"
  | "property_street"
  | "property_street2"
  | "property_city"
  | "property_state"
  | "property_zip"
  | "assigned_adjuster_id"
  | "requested_adjuster"
  | "pandadoc_document_id"
  | "esign_status"
>;

/** The refusals that belong to the letter's contents rather than its transport. */
export type LorLetterFailureCode =
  | "claim_not_found"
  /** No carrier or no policy number: there is nobody to address the letter to. */
  | "missing_policy"
  | "missing_lor_type"
  /** No saved fee on the claim: the letter never prints a defaulted rate. */
  | "missing_fee"
  | "no_claimants";

export type LorLetterFailure = {
  ok: false;
  code: LorLetterFailureCode;
  message: string;
};

export type LorLetterContents = {
  signers: LorSigner[];
  tokens: LorToken[];
  feePercent: number;
  adjusterName: string | null;
};

export type LorLetterResult = ({ ok: true } & LorLetterContents) | LorLetterFailure;

const causeLabel = (value: string) =>
  CAUSE_OPTIONS.find((option) => option.value === value)?.label ?? value;

const formatLorDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${month}/${day}/${year}` : value;
};

export function tokensFor(
  claim: ClaimRow,
  signers: LorSigner[],
  adjusterName: string | null,
  feePercent: number,
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
  const primary = signers.find((candidate) => candidate.role === "Homeowner1");
  const policyholderNames = signers
    .map((signer) => `${signer.firstName} ${signer.lastName}`)
    .join(" and ");
  const selected = claim.lor_contract_type;

  return [
    { name: "Claim.Ref", value: claim.claim_ref },
    /* Both are nullable in the type since Phase 6 — a partner referral carries
       no policy side until staff record it — and neither is null by the time it
       reaches here: `collectLorLetter` refuses the claim above. The coalesce
       is what the type requires, not a blank the letter is willing to print.
       `Claim.ClaimNumber` is different and stays optional: the carrier issues it
       after the claim is filed, so a letter sent before then honestly has none. */
    { name: "Claim.Carrier", value: claim.carrier ?? "" },
    { name: "Claim.PolicyNumber", value: claim.policy_number ?? "" },
    { name: "Claim.ClaimNumber", value: claim.claim_number ?? "" },
    { name: "Claim.LossDate", value: formatLorDate(claim.loss_date) },
    { name: "Claim.Cause", value: causeLabel(claim.cause) },
    { name: "Property.Address", value: address },
    { name: "Homeowner1.Name", value: nameFor("Homeowner1") },
    { name: "Homeowner2.Name", value: nameFor("Homeowner2") },
    { name: "Policyholders.Name", value: policyholderNames },
    { name: "Homeowner1.Phone", value: primary?.phone ?? "" },
    { name: "Homeowner1.Email", value: primary?.email ?? "" },
    { name: "Claim.EmergencyMark", value: selected === "emergency" ? "X" : "" },
    {
      name: "Claim.NonEmergencyMark",
      value: selected === "non_emergency" ? "X" : "",
    },
    {
      name: "Claim.SupplementalMark",
      value: selected === "supplemental" ? "X" : "",
    },
    { name: "Adjuster.Name", value: adjusterName ?? "" },
    { name: "Fee.Percent", value: `${feePercent}%` },
  ];
}

/** The claim row every LOR path reads, or null when there is none to read. */
export async function loadLorClaim(
  admin: Admin,
  claimId: string,
): Promise<ClaimRow | null> {
  const { data, error } = await admin
    .from("claims")
    .select(CLAIM_COLUMNS)
    .eq("id", claimId)
    .maybeSingle<ClaimRow>();

  return error ? null : data;
}

/**
 * The content gates, in the order `dispatchLorForClaim` has always run them.
 *
 * Every refusal happens before anything is produced or sent: an unwritten
 * letter is a refusal, a letter naming no carrier is a document that should
 * never have existed.
 */
export async function collectLorLetter(
  admin: Admin,
  claim: ClaimRow,
  feePercentInput: number | null = null,
): Promise<LorLetterResult> {
  if (!namesAPolicy(claim)) {
    return {
      ok: false,
      code: "missing_policy",
      message:
        "This claim has no carrier or policy number on file, and the letter is addressed to the carrier. Record them on the claim first.",
    };
  }

  if (!claim.lor_contract_type) {
    return {
      ok: false,
      code: "missing_lor_type",
      message:
        "This claim has no agreement type. Choose Emergency, Non-emergency, or Supplemental on the claim before you send the letter.",
    };
  }

  const { data: claimants } = await admin
    .from("claimants")
    .select("first_name, last_name, email, phone, is_primary, created_at")
    .eq("claim_id", claim.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(ROLES.length);

  if (!claimants || claimants.length === 0) {
    return {
      ok: false,
      code: "no_claimants",
      message: "This claim has no claimants to sign the letter.",
    };
  }

  const signers: LorSigner[] = claimants
    .slice(0, ROLES.length)
    .map((claimant, index) => ({
      email: claimant.email,
      phone: claimant.phone,
      firstName: claimant.first_name,
      lastName: claimant.last_name,
      role: ROLES[index],
    }));

  let feePercent = feePercentInput;
  if (feePercent === null) {
    const { data: financials } = await admin
      .from("claim_financials")
      .select("fee_percent")
      .eq("claim_id", claim.id)
      .maybeSingle();
    feePercent = financials?.fee_percent ?? null;
  }
  /* The fee is a term of the agreement the homeowner signs. It is never
     defaulted here: a letter carrying a rate nobody recorded on this claim is
     a document that should not exist, so the refusal happens before the
     provider is called, like the policy and agreement-type gates above. */
  if (feePercent === null) {
    return {
      ok: false,
      code: "missing_fee",
      message:
        "This claim has no fee percentage saved. Record the fee on the Financials tab before you send the letter.",
    };
  }

  let adjusterName: string | null = claim.requested_adjuster;
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

  return {
    ok: true,
    signers,
    feePercent,
    adjusterName,
    tokens: tokensFor(claim, signers, adjusterName, feePercent),
  };
}
