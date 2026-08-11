import "server-only";

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { isAppRole, isStaffRole, type AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type Session = {
  userId: string;
  email: string | null;
  /** `aal1` after a password sign-in, `aal2` once a TOTP factor is verified. */
  aal: string;
  role: AppRole;
};

/**
 * Every helper in this file reads through the *user's* client, so RLS applies
 * to each query. Nothing here may use `createAdminClient()`: a service-role
 * read answers "does this row exist", and the whole point of an authorization
 * check is to answer "may this caller have it". Using the admin client to
 * decide access would move the decision out of the database and into whatever
 * predicate the caller happened to write.
 *
 * `cache()` scopes memoisation to one render pass, so a layout and three
 * components asking `requireStaff()` share a single profiles read while two
 * different requests never share anything.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .maybeSingle();

  // A session whose profile is unreadable is not a session. `is_active` is part
  // of the self branch of `profiles_select_self_or_staff`, so a deactivated
  // account reads zero rows here and falls out exactly like a signed-out one —
  // deactivation takes effect on the next request, not on the next token
  // refresh.
  if (!profile || !isAppRole(profile.role)) return null;

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: claims.aal,
    role: profile.role,
  };
});

export async function requireUser(next?: string): Promise<Session> {
  const session = await getSession();
  if (session) return session;

  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}

/**
 * `notFound()` rather than a 403. Spec §7.9: an unauthorized caller must not be
 * able to tell a resource they may not have from one that is not there. A 403
 * on `/admin/claims/<uuid>` and a 404 on a random uuid together enumerate the
 * claim table for anyone with a portal account.
 *
 * Role only. It is the right helper for `customer` and `partner`, who have no
 * second factor, and it is *not* enough on its own for a staff surface — see
 * `requireStaff` below and `requireOwner` beneath that.
 */
export async function requireRole(...roles: readonly AppRole[]): Promise<Session> {
  const session = await requireUser();
  if (!roles.includes(session.role)) notFound();
  return session;
}

/** Every miss under `/admin` reads the same in a tab strip. */
export const NOT_FOUND_TITLE = "Page not found";

/**
 * The `<title>` for a role-gated route, decided without throwing.
 *
 * Next resolves a segment's metadata independently of whether that segment's
 * component renders, so a `export const metadata = { title: "Staff" }` was
 * emitted even when `requireRole("owner")` had answered the request with
 * `notFound()`. An aal2 adjuster opening `/admin/staff` got the workspace 404 in
 * the document and `<title>Staff · CMG claims desk</title>` in the tab — while a
 * genuinely unrouted path under `/admin` said "Page not found · CMG claims
 * desk". Two different answers for the same refusal is exactly the distinction
 * `requireRole`'s `notFound()` exists to erase (spec §7.9): the title confirmed
 * that a screen called Staff is there and that this account is not allowed on
 * it.
 *
 * `getSession()` rather than `requireRole()`, because the answer here is a
 * string and not a control-flow decision. A `generateMetadata` that throws
 * abandons metadata resolution for the whole segment and the title comes out
 * empty — which is a *third* spelling of the same 404, and was already the case
 * on `/admin/partners/[id]`. The page still calls `requireRole()`; this only
 * decides what the tab says. `getSession` is `cache()`d, so it costs no extra
 * query.
 *
 * aal is not consulted: a staff member one factor short is redirected to `/mfa`
 * before any of this renders, and a signed-out one to `/login`.
 */
export async function hasRole(...roles: readonly AppRole[]): Promise<boolean> {
  const session = await getSession();
  return session !== null && roles.includes(session.role);
}

export async function metadataForRole(
  roles: readonly AppRole[],
  title: string,
): Promise<Metadata> {
  return {
    title: (await hasRole(...roles)) ? title : NOT_FOUND_TITLE,
    robots: { index: false, follow: false },
  };
}

/**
 * Staff *and* aal2, in one helper, because §7.2 makes them one rule: there is
 * no such thing as a staff member who has authenticated but not with their
 * second factor. Splitting them into `requireRole('owner', …)` plus a separate
 * MFA check is how a new admin page ends up with the first and not the second.
 *
 * The aal shortfall redirects rather than 404s: the caller is a legitimate
 * staff member who is one step short, and `/mfa` is that step. Concealment is
 * owed to someone reaching for a resource that is not theirs, not to someone
 * reaching for their own desk.
 */
export async function requireStaff(next?: string): Promise<Session> {
  const session = await requireUser(next);
  if (!isStaffRole(session.role)) notFound();
  if (session.aal !== "aal2") {
    redirect(next ? `/mfa?next=${encodeURIComponent(next)}` : "/mfa");
  }
  return session;
}

/**
 * Owner *and* aal2 — the helper the owner-only server actions call.
 *
 * `requireRole("owner")` was doing this job and it checks no factor, which
 * matters because the two invite actions do not go on to write through the
 * caller's client: `issueInvite` writes as the service role, which is exempt
 * from the database's aal2 gate by construction. Their MFA enforcement
 * therefore rested entirely on `proxy.ts` — and a guard whose only copy lives in
 * the proxy is one route-matcher edit away from not existing. Nothing was
 * reachable at aal1 in this build; this is the second copy, in the layer that
 * runs on every action POST whatever the proxy decides.
 *
 * Composed rather than re-derived, so there is one definition of "staff and
 * aal2" and this adds one word to it. The order also keeps §7.9: a non-staff
 * caller 404s before any factor is consulted, so the shortfall redirect can only
 * be seen by someone who is already staff — and an adjuster sees the same `/mfa`
 * here that they would see on any staff surface, which tells them nothing about
 * this one.
 */
export async function requireOwner(next?: string): Promise<Session> {
  const session = await requireStaff(next);
  if (session.role !== "owner") notFound();
  return session;
}

export type ClaimAccess = {
  session: Session;
  claim: { id: string; claim_ref: string; status: string };
};

/**
 * The authorization check *is* the query. `claims_select` already encodes the
 * §4 matrix — owner and assistant see all, an adjuster sees what is assigned to
 * them, a homeowner sees the claims they are a claimant on, a partner sees
 * nothing at all — so a zero-row result is indistinguishable between "no such
 * claim" and "not yours", and both leave here as the same 404. Re-deriving that
 * matrix in TypeScript would give two answers that could disagree.
 */
export async function requireClaimAccess(claimId: string): Promise<ClaimAccess> {
  const session = await requireUser();

  // A malformed id would reach Postgres as a uuid cast error rather than an
  // empty result, which is a different response shape and therefore its own
  // small oracle. Refused here so every bad id looks like every missing one.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimId)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: claim, error } = await supabase
    .from("claims")
    .select("id, claim_ref, status")
    .eq("id", claimId)
    .maybeSingle();

  if (error || !claim) notFound();

  return { session, claim };
}
