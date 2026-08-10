import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import { loadUserDirectory } from "@/lib/admin/directory";
import { isClaimStatus, type ClaimStatus } from "@/lib/claims/status";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type PartnerStatus = Database["public"]["Enums"]["partner_company_status"];

export type PartnerSummary = {
  id: string;
  name: string;
  status: PartnerStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  /** Profiles pointing at this company — the number the delete guard counts. */
  repCount: number;
  claimCount: number;
  createdAt: string;
};

type CountEmbed = { count: number }[];

function firstCount(embed: CountEmbed | null): number {
  return embed?.[0]?.count ?? 0;
}

/**
 * Counts come from PostgREST's embedded aggregate rather than from N follow-up
 * queries or a JS reduce over every claim in the business — one round trip, and
 * the counting happens where the rows are. The foreign keys are named
 * explicitly: `profiles` and `claims` each hold exactly one FK into
 * `partner_companies` today, but an unhinted embed resolves by guessing from the
 * table name and would become ambiguous the moment a second one is added.
 */
export async function loadPartnerSummaries(
  status: PartnerStatus | null,
): Promise<PartnerSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("partner_companies")
    .select(
      `id, name, status, contact_name, contact_email, contact_phone, created_at,
       reps:profiles!profiles_partner_company_id_fkey(count),
       claims:claims!claims_partner_company_id_fkey(count)`,
    )
    .order("name", { ascending: true });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    console.error("[partners] list failed", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    repCount: firstCount(row.reps as CountEmbed | null),
    claimCount: firstCount(row.claims as CountEmbed | null),
    createdAt: row.created_at,
  }));
}

export type PartnerRep = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  lastSignInAt: string | null;
};

export type PendingRepInvite = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

export type AttributedClaim = {
  id: string;
  claimRef: string;
  status: ClaimStatus;
  city: string;
  street: string;
  createdAt: string;
};

export type PartnerDetail = {
  company: PartnerSummary & { notes: string | null; updatedAt: string };
  reps: PartnerRep[];
  pendingInvites: PendingRepInvite[];
  claims: AttributedClaim[];
};

function personName(row: { first_name: string | null; last_name: string | null }): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unnamed rep";
}

/**
 * `cache()` so the page and its metadata export share one read.
 *
 * Every query runs under the caller's client. A company the caller may not see
 * comes back as zero rows and leaves here as `notFound()` — the same response an
 * id that names nothing gets (spec §7.9).
 */
export const loadPartnerDetail = cache(async function loadPartnerDetail(
  companyId: string,
): Promise<PartnerDetail> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) {
    notFound();
  }

  const supabase = await createClient();

  const [companyResult, repsResult, invitesResult, claimsResult, directory] =
    await Promise.all([
      supabase
        .from("partner_companies")
        .select(
          "id, name, status, contact_name, contact_email, contact_phone, notes, created_at, updated_at",
        )
        .eq("id", companyId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, is_active")
        .eq("partner_company_id", companyId)
        .order("last_name", { ascending: true }),
      supabase
        .from("invites")
        .select("id, email, expires_at, created_at")
        .eq("partner_company_id", companyId)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("claims")
        .select("id, claim_ref, status, property_city, property_street, created_at")
        .eq("partner_company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50),
      loadUserDirectory(),
    ]);

  const company = companyResult.data;
  if (!company) notFound();

  const reps = repsResult.data ?? [];

  return {
    company: {
      id: company.id,
      name: company.name,
      status: company.status,
      contactName: company.contact_name,
      contactEmail: company.contact_email,
      contactPhone: company.contact_phone,
      notes: company.notes,
      repCount: reps.length,
      claimCount: claimsResult.data?.length ?? 0,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    },
    reps: reps.map((row) => {
      const account = directory.get(row.id);
      return {
        id: row.id,
        name: personName(row),
        email: account?.email ?? null,
        phone: row.phone,
        isActive: row.is_active,
        lastSignInAt: account?.lastSignInAt ?? null,
      };
    }),
    pendingInvites: (invitesResult.data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })),
    claims: (claimsResult.data ?? [])
      .filter((row) => isClaimStatus(row.status))
      .map((row) => ({
        id: row.id,
        claimRef: row.claim_ref,
        status: row.status as ClaimStatus,
        city: row.property_city,
        street: row.property_street,
        createdAt: row.created_at,
      })),
  };
});
