import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import { requireRole } from "@/lib/authz";
import type { ClaimStatus } from "@/lib/claims/status";
import { isUuid } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";

const SUMMARY_COLUMNS =
  "claim_id, claim_ref, homeowner_name, property_street, property_city, status, lor_signed_at, filed_at, settled_at, settlement_amount, updated_at";

export const PARTNER_CLAIMS_PAGE_SIZE = 24;

export type PartnerClaimSummary = {
  claim_id: string;
  claim_ref: string;
  homeowner_name: string | null;
  property_street: string | null;
  property_city: string | null;
  status: ClaimStatus;
  lor_signed_at: string | null;
  filed_at: string | null;
  settled_at: string | null;
  settlement_amount: number | null;
  updated_at: string;
};

export type PartnerCompanyProfile = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export async function loadPartnerClaimPage(from: number, to: number): Promise<{
  summaries: PartnerClaimSummary[];
  total: number;
}> {
  await requireRole("partner");
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("claim_partner_summaries")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("claim_id", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Partner claims could not be loaded: ${error.message}`);
  return { summaries: (data ?? []) as PartnerClaimSummary[], total: count ?? 0 };
}

export const loadPartnerClaim = cache(
  async (claimId: string): Promise<PartnerClaimSummary | null> => {
    await requireRole("partner");
    if (!isUuid(claimId)) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("claim_partner_summaries")
      .select(SUMMARY_COLUMNS)
      .eq("claim_id", claimId)
      .maybeSingle();

    if (error) throw new Error(`Partner claim could not be loaded: ${error.message}`);
    return (data as PartnerClaimSummary | null) ?? null;
  },
);

export const requirePartnerClaim = cache(
  async (claimId: string): Promise<PartnerClaimSummary> => {
    const summary = await loadPartnerClaim(claimId);
    if (!summary) notFound();
    return summary;
  },
);

export const loadPartnerCompanyProfile = cache(
  async (): Promise<PartnerCompanyProfile> => {
    await requireRole("partner");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("partner_company_profile").maybeSingle();

    if (error) throw new Error(`Partner company could not be loaded: ${error.message}`);
    if (!data) notFound();
    return data;
  },
);
