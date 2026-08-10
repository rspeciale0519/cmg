import { ALL_STATUSES, isClaimStatus, type ClaimStatus } from "./status";

export type ClaimFilters = {
  status: ClaimStatus | null;
  adjusterId: string | null;
  partnerId: string | null;
  /** Already sanitised for PostgREST's filter grammar — see `sanitiseSearch`. */
  search: string;
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
    search: sanitiseSearch(params.q),
  };
}

export function hasActiveFilters(filters: ClaimFilters): boolean {
  return Boolean(
    filters.status || filters.adjusterId || filters.partnerId || filters.search,
  );
}

/**
 * The `or=` clause matching a claim's own columns. Claimant names are matched
 * separately — they live on another table, and an embedded `or` would turn the
 * whole query into an inner join and drop claims that have no claimant row.
 */
export function claimSearchClause(search: string, claimIds: string[]): string {
  const term = `*${search}*`;
  const predicates = [
    `claim_ref.ilike.${term}`,
    `property_street.ilike.${term}`,
    `property_city.ilike.${term}`,
    `carrier.ilike.${term}`,
  ];

  if (claimIds.length > 0) {
    predicates.push(`id.in.(${claimIds.join(",")})`);
  }

  return predicates.join(",");
}

export const STATUS_FILTER_OPTIONS = ALL_STATUSES;
