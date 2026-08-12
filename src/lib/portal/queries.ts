import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import { requireRole } from "@/lib/authz";
import type { ClaimStatus } from "@/lib/claims/status";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/authz";

/**
 * Every read on this surface goes through the caller's own client, so
 * `claims_select` — which for a customer is `private.is_claim_customer(id)`, a
 * join through `claimants.user_id` to an *active* profile — is what decides
 * which rows come back. There is no `.eq("user_id", …)` anywhere in the portal:
 * the filter is the policy. A WHERE clause repeating it would be a second,
 * weaker copy that could drift from the one the database enforces, and the copy
 * that drifts is always the one the page trusts.
 */

/**
 * The columns a homeowner's own claim may show them.
 *
 * Written out rather than `select("*")`, and the omissions are the point. The
 * §4 access matrix grants a customer the claims row, so RLS would hand over
 * `policy_number` and `claim_number` too — the carrier's internal references,
 * which the portal has no reason to restate and which turn a screenshot of this
 * page into everything needed to phone the carrier as the policyholder.
 * `claim_financials` is a different table with no customer policy at all, so no
 * settlement figure or fee percentage can be reached from here even by mistake.
 */
/* One string literal and not a concatenation of three. `"a" + "b"` widens to
   `string`, and supabase-js parses this value *as a type* to infer the shape of
   the row — so the readable, wrapped version silently turned every column into
   `GenericStringError` and cost the query its typing. */
const CLAIM_COLUMNS =
  "id, claim_ref, status, property_street, property_street2, property_city, property_state, property_zip, carrier, loss_date, loss_time, cause, description, created_at";

export type PortalClaim = {
  id: string;
  claim_ref: string;
  status: ClaimStatus;
  property_street: string;
  property_street2: string | null;
  property_city: string;
  property_state: string;
  property_zip: string;
  /* Nullable since Phase 6 — a partner referral has no carrier until staff take
     it on accept. A homeowner has no account before that point, so in practice
     this is never null on a claim they can read; typed honestly anyway, because
     "in practice" is not a guarantee the compiler can hold. */
  carrier: string | null;
  loss_date: string;
  loss_time: string | null;
  cause: string;
  description: string;
  created_at: string;
};

/**
 * Every claim this homeowner is a claimant on, newest first. Spec §10 puts
 * multi-claim support in v1 rather than behind a flag, because a homeowner who
 * has been through two storms is the ordinary case in Florida, not the edge one.
 *
 * `cache()` for one render pass: the layout reads this for the claim switcher
 * and the index page reads it to decide what to show, and those are one query.
 */
export const listPortalClaims = cache(async (): Promise<PortalClaim[]> => {
  await requireRole("customer");
  const supabase = await createClient();

  const { data } = await supabase
    .from("claims")
    .select(CLAIM_COLUMNS)
    .order("created_at", { ascending: false });

  return (data ?? []) as PortalClaim[];
});

export type PortalClaimAccess = {
  session: Session;
  claim: PortalClaim;
};

/**
 * One claim, or a 404 that is indistinguishable from the claim not existing.
 *
 * The authorization check *is* the query, exactly as `requireClaimAccess()` does
 * it for the workspace. A claim belonging to another homeowner reads zero rows
 * under `claims_select` and leaves here through the same `notFound()` a random
 * uuid takes, so a portal account cannot use this route to learn which claim ids
 * are real (spec §7.9).
 *
 * The uuid shape is checked first for the reason that helper gives: a malformed
 * id reaches Postgres as a cast error rather than an empty result, which is a
 * different response shape and therefore its own small oracle.
 */
export const requirePortalClaim = cache(
  async (claimId: string): Promise<PortalClaimAccess> => {
    const session = await requireRole("customer");

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimId)
    ) {
      notFound();
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("claims")
      .select(CLAIM_COLUMNS)
      .eq("id", claimId)
      .maybeSingle();

    if (error || !data) notFound();

    return { session, claim: data as PortalClaim };
  },
);

/**
 * The name of the adjuster representing this homeowner.
 *
 * Through `public.portal_claim_contact()`, because `profiles_select_self_or_staff`
 * gives a customer their own row and nothing else — a join from `claims` to
 * `profiles` returns nothing for them. The function is SECURITY DEFINER, gated
 * inside Postgres on the caller being this claim's customer, and returns two
 * display columns; see the migration for why that shape rather than a wider
 * policy or a service-role read.
 *
 * Null when the claim has no adjuster yet, which is the ordinary state of a new
 * intake and is rendered as such rather than as an error.
 */
export async function portalAdjusterName(claimId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("portal_claim_contact", { p_claim_id: claimId })
    .maybeSingle();

  if (!data) return null;

  const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : null;
}

/**
 * The `<title>` for a claim screen, decided without throwing.
 *
 * Next resolves a segment's metadata independently of whether its component
 * renders, so a page carrying `export const metadata = { title: "Documents" }`
 * emitted that title even when the layout above it had answered the request with
 * `notFound()` — the tab said "Documents" over a page reading "We could not find
 * that page." It was not an oracle, because a nonexistent uuid produced the same
 * "Documents" as another homeowner's claim, so the two still could not be told
 * apart. It was simply a page telling the reader two different things at once.
 *
 * `listPortalClaims()` rather than `requirePortalClaim()`: it is the same
 * `cache()`d read the layout has already performed, and it returns rows instead
 * of throwing. A `generateMetadata` that throws abandons metadata resolution for
 * the whole segment and the title comes out empty — which would be a *third*
 * spelling of one refusal.
 */
export async function portalSectionTitle(
  claimId: string,
  section: string,
): Promise<{ title: string }> {
  const claims = await listPortalClaims();
  const known = claims.some((claim) => claim.id === claimId);
  return { title: known ? section : "Claim not found" };
}

export type PortalProfile = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export const portalProfile = cache(async (): Promise<PortalProfile | null> => {
  const session = await requireRole("customer");
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone")
    .eq("id", session.userId)
    .maybeSingle();

  return data ?? null;
});

/** The name to greet this person by, falling back through what is known. */
export function displayName(
  profile: PortalProfile | null,
  email: string | null,
): string {
  const name = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name.length > 0 ? name : (email ?? "Your account");
}
