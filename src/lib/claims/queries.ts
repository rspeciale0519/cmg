import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import { isStaffRole } from "@/lib/auth/roles";
import { getSession, requireStaff, type Session } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { collectPostgrestPages } from "@/lib/supabase/collect-pages";
import type { Database } from "@/types/database";
import { claimCapabilities, type ClaimCapabilities } from "./capabilities";
import { isClaimStatus, type ClaimStatus } from "./status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Explicit FK hints on every embed. Without them PostgREST resolves the
 * relationship by guessing from the target table name, which is ambiguous the
 * moment a table has two foreign keys into the same one — `claim_financials`
 * points at `profiles` through `updated_by` and at `claims` through `claim_id`,
 * and `documents` points at `profiles` through `uploaded_by`. Naming the
 * constraint makes the join a fact rather than an inference.
 */
const CLAIM_DETAIL_SELECT = `
  id, claim_ref, status,
  property_street, property_street2, property_city, property_state, property_zip,
  carrier, policy_number, carrier_tenure, lor_contract_type, prior_roof_claim, prior_outcome, claim_number,
  loss_date, loss_time, cause, description,
  assigned_adjuster_id, partner_company_id,
  requested_adjuster, referrer_name, referrer_email,
  pandadoc_document_id, esign_status,
  lor_signed_at, filed_at, denied_at, settled_at,
  created_at, updated_at,
  adjuster:profiles!claims_assigned_adjuster_id_fkey(id, first_name, last_name),
  partner:partner_companies!claims_partner_company_id_fkey(id, name, status)
` as const;

export type ClaimDetail = {
  id: string;
  claimRef: string;
  status: ClaimStatus;
  propertyStreet: string;
  propertyStreet2: string | null;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  /* Nullable since Phase 6: a partner referral carries no policy side at all
     until staff supply it on accept (see the 20260812120000 migration). */
  carrier: string | null;
  policyNumber: string | null;
  carrierTenure: string | null;
  lorContractType: Database["public"]["Enums"]["lor_contract_type"] | null;
  priorRoofClaim: boolean;
  priorOutcome: string | null;
  claimNumber: string | null;
  lossDate: string;
  lossTime: string | null;
  cause: string;
  description: string;
  assignedAdjusterId: string | null;
  adjusterName: string | null;
  partnerCompanyId: string | null;
  partnerName: string | null;
  requestedAdjuster: string | null;
  referrerName: string | null;
  referrerEmail: string | null;
  pandaDocDocumentId: string | null;
  esignStatus: string | null;
  lorSignedAt: string | null;
  filedAt: string | null;
  deniedAt: string | null;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClaimContext = {
  session: Session;
  claim: ClaimDetail;
  can: ClaimCapabilities;
};

function personName(
  person: { first_name: string | null; last_name: string | null } | null,
): string | null {
  if (!person) return null;
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : null;
}

/**
 * The single entry point every admin claim surface uses. Two things happen here
 * and they are deliberately not separable:
 *
 *   1. `requireStaff` — staff role plus aal2, or the caller never reaches the
 *      query. A page that forgot this would still be safe (RLS answers the
 *      read), but it would answer for a *customer's* session too, and
 *      `/admin/claims/<their own claim>` should not be a page they can render.
 *   2. The read runs under the caller's own client, so `claims_select` decides
 *      what comes back. An adjuster asking for a claim assigned to someone else
 *      gets zero rows and leaves here as `notFound()` — the same response as a
 *      uuid that names nothing (spec §7.9).
 *
 * `cache()` because the tab layout and the tab page both need the claim, and
 * without it every navigation between tabs issues the same query twice. The
 * memo lives for one render pass, so two requests never share a result.
 */
export const loadClaimContext = cache(async function loadClaimContext(
  claimId: string,
): Promise<ClaimContext> {
  const session = await requireStaff("/admin");

  // A malformed id reaches Postgres as a uuid cast error rather than an empty
  // result — a different response shape, and therefore its own small oracle.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimId)) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_DETAIL_SELECT)
    .eq("id", claimId)
    .maybeSingle();

  if (error || !data || !isClaimStatus(data.status)) notFound();

  const claim: ClaimDetail = {
    id: data.id,
    claimRef: data.claim_ref,
    status: data.status,
    propertyStreet: data.property_street,
    propertyStreet2: data.property_street2,
    propertyCity: data.property_city,
    propertyState: data.property_state,
    propertyZip: data.property_zip,
    carrier: data.carrier,
    policyNumber: data.policy_number,
    carrierTenure: data.carrier_tenure,
    lorContractType: data.lor_contract_type,
    priorRoofClaim: data.prior_roof_claim,
    priorOutcome: data.prior_outcome,
    claimNumber: data.claim_number,
    lossDate: data.loss_date,
    lossTime: data.loss_time,
    cause: data.cause,
    description: data.description,
    assignedAdjusterId: data.assigned_adjuster_id,
    adjusterName: personName(data.adjuster),
    partnerCompanyId: data.partner_company_id,
    partnerName: data.partner?.name ?? null,
    requestedAdjuster: data.requested_adjuster,
    referrerName: data.referrer_name,
    referrerEmail: data.referrer_email,
    pandaDocDocumentId: data.pandadoc_document_id,
    esignStatus: data.esign_status,
    lorSignedAt: data.lor_signed_at,
    filedAt: data.filed_at,
    deniedAt: data.denied_at,
    settledAt: data.settled_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  return {
    session,
    claim,
    can: claimCapabilities(
      { userId: session.userId, role: session.role },
      { assignedAdjusterId: claim.assignedAdjusterId },
    ),
  };
});

export type ClaimTitleContext = {
  claimRef: string;
  can: ClaimCapabilities;
};

/**
 * What a claim tab's `<title>` needs, decided without throwing.
 *
 * Next resolves a segment's metadata independently of whether that segment's
 * component renders, and a `generateMetadata` that throws abandons metadata
 * resolution for the whole segment — the title then comes out empty, which is a
 * third spelling of the same 404. So neither `requireStaff()` nor
 * `loadClaimContext()` can be used here: both answer with control flow, and the
 * question this asks is a string.
 *
 * `can` comes back with the reference because a tab may be gated on a
 * *capability* rather than on a role, and §7.9's rule is about what the refusal
 * discloses, not about which layer refused. `/admin/claims/<id>/financials`
 * called `notFound()` for an assistant — `claim_financials` carries no policy
 * for them at all — while the layout above it went on resolving the claim and
 * put `CMG-2026-0001 · CMG claims desk` in the tab. The body said the page is
 * not there and the tab strip confirmed both the claim and the screen exist,
 * which is precisely the pair `metadataForRole` was written to stop role-gated
 * routes from emitting.
 *
 * A shortfall of any kind — signed out, not staff, one factor short, no such
 * claim, not this caller's claim — is the same `null`, and every caller renders
 * it as `NOT_FOUND_TITLE`.
 */
export const claimTitleContext = cache(async function claimTitleContext(
  claimId: string,
): Promise<ClaimTitleContext | null> {
  const session = await getSession();
  if (!session || !isStaffRole(session.role) || session.aal !== "aal2") return null;
  if (!UUID.test(claimId)) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select("claim_ref, assigned_adjuster_id")
    .eq("id", claimId)
    .maybeSingle();

  if (!data) return null;

  return {
    claimRef: data.claim_ref,
    can: claimCapabilities(
      { userId: session.userId, role: session.role },
      { assignedAdjusterId: data.assigned_adjuster_id },
    ),
  };
});

export type AdjusterOption = { id: string; name: string };

/**
 * Active adjusters, for the assignment picker. `reassign_claim()` refuses any
 * id that is not an active `adjuster`, so the list and the RPC agree by
 * construction; this only decides what is offered.
 */
export async function loadAdjusters(): Promise<AdjusterOption[]> {
  const supabase = await createClient();
  const data = await collectPostgrestPages((from, to) =>
    supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("role", "adjuster")
      .eq("is_active", true)
      .order("last_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  return data.map((row) => ({
    id: row.id,
    name: personName(row) ?? "Unnamed adjuster",
  }));
}

export type PartnerOption = { id: string; name: string };

export async function loadPartnerCompanies(): Promise<PartnerOption[]> {
  const supabase = await createClient();
  const data = await collectPostgrestPages((from, to) =>
    supabase
      .from("partner_companies")
      .select("id, name")
      .eq("status", "active")
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  return data.map((row) => ({ id: row.id, name: row.name }));
}
