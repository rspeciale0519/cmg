import { ALL_STATUSES, isClaimStatus, type ClaimStatus } from "./status";

export type ClaimFilters = {
  status: ClaimStatus | null;
  adjusterId: string | null;
  partnerId: string | null;
  /**
   * The vendor whose public intake link produced the claim, which is a
   * different fact from `partnerId`: attribution at triage says who CMG credits
   * the referral to, and this says which link the homeowner actually arrived
   * through. They disagree often enough to be worth filtering separately.
   */
  vendorId: string | null;
  /** Already sanitised for PostgREST's filter grammar — see `sanitiseSearch`. */
  search: string;
};

type ClaimQuery<Q> = {
  eq(column: string, value: string): Q;
  is(column: string, value: null): Q;
  ilike(column: string, pattern: string): Q;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PostgREST's `or=` filter is a *grammar*, not a parameter list: commas
 * separate predicates, parentheses group them, dots separate column from
 * operator, and `*` is the `ilike` wildcard. A search box wired straight into
 * it is therefore an injection surface into the query's own structure — a term
 * containing `,` does not search for a comma, it ends one predicate and starts
 * another, and `)` closes the group early. The result ranges from a 400 to a
 * filter that quietly matches more rows than the operator asked for.
 *
 * Every character with meaning in that grammar is removed rather than escaped.
 * Escaping would mean tracking PostgREST's quoting rules, which differ between
 * `or=` and plain filters; removal cannot be got subtly wrong, and none of
 * these characters appear in a claim reference, a surname or a street address.
 * `%` and `_` go too — they are LIKE's own wildcards, and a lone `%` would turn
 * every keystroke into a full scan.
 */
export function sanitiseSearch(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[,()*."'\\:%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function parseClaimFilters(params: {
  status?: string;
  adjuster?: string;
  partner?: string;
  vendor?: string;
  q?: string;
}): ClaimFilters {
  return {
    status:
      typeof params.status === "string" && isClaimStatus(params.status)
        ? params.status
        : null,
    adjusterId:
      typeof params.adjuster === "string" && UUID.test(params.adjuster)
        ? params.adjuster
        // "unassigned" is a real filter and is not a uuid, so it is carried as
        // its own sentinel rather than as an empty adjuster id.
        : params.adjuster === "unassigned"
          ? "unassigned"
          : null,
    partnerId:
      typeof params.partner === "string" && UUID.test(params.partner)
        ? params.partner
        : params.partner === "none"
          ? "none"
          : null,
    // Mirrors `partner` exactly, "none" included: a claim that came in without
    // a vendor link is as real a selection as one that came through a named
    // vendor's link.
    vendorId:
      typeof params.vendor === "string" && UUID.test(params.vendor)
        ? params.vendor
        : params.vendor === "none"
          ? "none"
          : null,
    search: sanitiseSearch(params.q),
  };
}

export function hasActiveFilters(filters: ClaimFilters): boolean {
  return Boolean(
    filters.status ||
      filters.adjusterId ||
      filters.partnerId ||
      filters.vendorId ||
      filters.search,
  );
}

export function applyClaimFilters<Q extends ClaimQuery<Q>>(
  query: Q,
  filters: ClaimFilters,
): Q {
  let next = query;
  if (filters.status) next = next.eq("status", filters.status);

  if (filters.adjusterId === "unassigned") {
    next = next.is("assigned_adjuster_id", null);
  } else if (filters.adjusterId) {
    next = next.eq("assigned_adjuster_id", filters.adjusterId);
  }

  if (filters.partnerId === "none") {
    next = next.is("partner_company_id", null);
  } else if (filters.partnerId) {
    next = next.eq("partner_company_id", filters.partnerId);
  }

  if (filters.vendorId === "none") {
    next = next.is("intake_referral_partner_id", null);
  } else if (filters.vendorId) {
    next = next.eq("intake_referral_partner_id", filters.vendorId);
  }

  if (filters.search) {
    next = next.ilike("search_text", `%${filters.search}%`);
  }

  return next;
}

export const STATUS_FILTER_OPTIONS = ALL_STATUSES;
