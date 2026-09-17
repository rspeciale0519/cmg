import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import { loadUserDirectory } from "@/lib/admin/directory";
import { isClaimStatus, type ClaimStatus } from "@/lib/claims/status";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database-app";
import { collectPostgrestPages } from "@/lib/supabase/collect-pages";

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
 * Fifty companies a page.
 *
 * Paged by offset rather than by cursor, which is the opposite choice from the
 * workspace's feeds and is deliberate. A keyset cursor has to carry the sort
 * column's value, and this list sorts on `name` — arbitrary text, which cannot
 * be interpolated into PostgREST's `or=` grammar the way an instant or a uuid
 * can, because a company called "Smith, Roe & Co (FL)" carries the comma and the
 * parenthesis that would end the predicate early. Escaping user-supplied text
 * into a grammar to buy a property this ordering already has would be the wrong
 * trade: an alphabetical directory does not reorder while it is read, so the
 * row-shifting that makes offset *wrong* on a feed cannot happen here, and the
 * cost argument against offset is about a hundred rows.
 */
export const PARTNERS_PAGE_SIZE = 50;

export type PartnerPage = {
  companies: PartnerSummary[];
  /** Companies matching the filter, counted in the database. */
  total: number;
  /** Active companies matching the filter — the numerator in the panel header. */
  activeTotal: number;
};

/**
 * Counts come from PostgREST's embedded aggregate rather than from N follow-up
 * queries or a JS reduce over every claim in the business — one round trip, and
 * the counting happens where the rows are. The foreign keys are named
 * explicitly: `profiles` and `claims` each hold exactly one FK into
 * `partner_companies` today, but an unhinted embed resolves by guessing from the
 * table name and would become ambiguous the moment a second one is added.
 *
 * `total` and `activeTotal` are separate `count: "exact"` reads rather than
 * `data.length`, because the page is a window: the header used to state the
 * number of rows it had been handed and call it the number of companies.
 */
export async function loadPartnerPage(
  status: PartnerStatus | null,
  from: number,
  to: number,
): Promise<PartnerPage> {
  const supabase = await createClient();

  let listQuery = supabase
    .from("partner_companies")
    .select(
      `id, name, status, contact_name, contact_email, contact_phone, created_at,
       reps:profiles!profiles_partner_company_id_fkey(count),
       claims:claims!claims_partner_company_id_fkey(count)`,
      { count: "exact" },
    );
  if (status) listQuery = listQuery.eq("status", status);

  // The filter is applied to the active count too, so "N active of M" always
  // describes the same set of companies the table below it is showing.
  let activeQuery = supabase
    .from("partner_companies")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (status) activeQuery = activeQuery.eq("status", status);

  const [listResult, activeResult] = await Promise.all([
    listQuery
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
    activeQuery,
  ]);

  if (listResult.error) {
    console.error("[partners] list failed", listResult.error.message);
    return { companies: [], total: 0, activeTotal: 0 };
  }

  return {
    companies: (listResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      repCount: firstCount(row.reps as CountEmbed | null),
      claimCount: firstCount(row.claims as CountEmbed | null),
      createdAt: row.created_at,
    })),
    total: listResult.count ?? 0,
    activeTotal: activeResult.count ?? 0,
  };
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
  company: PartnerSummary & { notes: string | null; updatedAt: string; intakeReferralCode: string };
  reps: PartnerRep[];
  /** Reps linked to this company, counted in the database rather than measured off the page. */
  repTotal: number;
  activeRepTotal: number;
  pendingInvites: PendingRepInvite[];
  claims: AttributedClaim[];
  /** Claims attributed to this company — the number `/admin/partners` prints for the same row. */
  claimTotal: number;
  /** Whether the claims query returned one row past the page. */
  claimsHasMore: boolean;
};

/** Reps a page. A rep is one table row, so this is generous for a contractor. */
export const PARTNER_REPS_PAGE_SIZE = 25;

/** Attributed claims a page. Was a hard `.limit(50)` printed as "50 shown". */
export const PARTNER_CLAIMS_PAGE_SIZE = 40;

export type PartnerDetailPaging = {
  /** Zero-based offset window for the alphabetical rep list. */
  repsFrom: number;
  repsTo: number;
  /** `(created_at, id)` keyset predicate for the attributed-claims feed, already built. */
  claimsClause: string | null;
  /** True when the reader is paging backwards, so the window is walked the other way. */
  claimsReversed: boolean;
};

function personName(row: { first_name: string | null; last_name: string | null }): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unnamed rep";
}

/**
 * `cache()` so a page that reads this twice in one render pass issues one query.
 *
 * Every query runs under the caller's client. A company the caller may not see
 * comes back as zero rows and leaves here as `notFound()` — the same response an
 * id that names nothing gets (spec §7.9).
 *
 * Two lists, two mechanisms, for the reason `src/lib/admin/paging.ts` sets out:
 * the reps are alphabetical and therefore stable under insertion, so they page
 * by offset; the attributed claims are newest-first and therefore a feed, so
 * they page by keyset. Both totals are real `count: "exact"` reads — the claim
 * total in particular is the same COUNT `/admin/partners` embeds for this row,
 * which is what "50 shown" over a `.limit(50)` was contradicting at 51 claims.
 */
export const loadPartnerDetail = cache(async function loadPartnerDetail(
  companyId: string,
  paging: PartnerDetailPaging,
): Promise<PartnerDetail> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) {
    notFound();
  }

  const supabase = await createClient();

  let claimsQuery = supabase
    .from("claims")
    .select("id, claim_ref, status, property_city, property_street, created_at")
    .eq("partner_company_id", companyId)
    .order("created_at", { ascending: paging.claimsReversed })
    .order("id", { ascending: paging.claimsReversed })
    .limit(PARTNER_CLAIMS_PAGE_SIZE + 1);

  if (paging.claimsClause) claimsQuery = claimsQuery.or(paging.claimsClause);

  const [
    companyResult,
    repsResult,
    activeRepsResult,
    invitesResult,
    claimsResult,
    claimCountResult,
    directory,
  ] = await Promise.all([
    supabase
      .from("partner_companies")
      .select(
        "id, name, status, contact_name, contact_email, contact_phone, notes, created_at, updated_at, intake_referral_code",
      )
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, is_active", { count: "exact" })
      .eq("partner_company_id", companyId)
      .order("last_name", { ascending: true })
      .order("id", { ascending: true })
      .range(paging.repsFrom, paging.repsTo),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("partner_company_id", companyId)
      .eq("is_active", true),
    collectPostgrestPages((from, to) =>
      supabase
        .from("invites")
        .select("id, email, expires_at, created_at")
        .eq("partner_company_id", companyId)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    ),
    claimsQuery,
    supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("partner_company_id", companyId),
    loadUserDirectory(),
  ]);

  const company = companyResult.data;
  if (!company) notFound();

  const repRows = repsResult.data ?? [];
  const claimRows = claimsResult.data ?? [];
  const claimsHasMore = claimRows.length > PARTNER_CLAIMS_PAGE_SIZE;
  const claimWindow = claimRows.slice(0, PARTNER_CLAIMS_PAGE_SIZE);

  return {
    company: {
      id: company.id,
      name: company.name,
      status: company.status,
      contactName: company.contact_name,
      contactEmail: company.contact_email,
      contactPhone: company.contact_phone,
      notes: company.notes,
      repCount: repsResult.count ?? repRows.length,
      claimCount: claimCountResult.count ?? claimWindow.length,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
      intakeReferralCode: company.intake_referral_code,
    },
    reps: repRows.map((row) => {
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
    repTotal: repsResult.count ?? repRows.length,
    activeRepTotal: activeRepsResult.count ?? 0,
    pendingInvites: invitesResult.map((row) => ({
      id: row.id,
      email: row.email,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })),
    claims: (paging.claimsReversed ? [...claimWindow].reverse() : claimWindow)
      .filter((row) => isClaimStatus(row.status))
      .map((row) => ({
        id: row.id,
        claimRef: row.claim_ref,
        status: row.status as ClaimStatus,
        city: row.property_city,
        street: row.property_street,
        createdAt: row.created_at,
      })),
    claimTotal: claimCountResult.count ?? claimWindow.length,
    claimsHasMore,
  };
});
