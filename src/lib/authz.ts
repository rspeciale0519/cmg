import "server-only";

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import {
  isAppRole,
  isStaffRole,
  landingPathFor,
  SURFACES,
  type AppRole,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import {
  isAnyPrivateSurfaceOpen,
  isPathOpen,
  PLATFORM_DISABLED_PATH,
} from "@/lib/site-mode";

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
  /* The question here is "can this build have a session at all", not "is any
     particular surface open": `/login` is one of the six private prefixes, so a
     mode that opens nothing has no way to issue a session and reading one would
     build a Supabase client that can never answer anything. Staff mode opens
     `/login`, so the read happens — and what the session is then *allowed* to
     reach is decided by `requireUser` and the `require*` helpers below. */
  if (!isAnyPrivateSurfaceOpen()) return null;
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

/**
 * The mode boundary, run inside pages and actions and not only in the proxy.
 *
 * Takes the path whose surface it is guarding rather than asking which mode is
 * running, so a caller states *what it needs open* and the three-mode table in
 * `site-mode.ts` stays the only place that knows which modes open what. A route
 * matcher edit in the proxy therefore cannot quietly remove this second copy.
 */
export function requireOpenPath(path: string): void {
  if (!isPathOpen(path)) redirect(PLATFORM_DISABLED_PATH);
}

export async function requireUser(next?: string): Promise<Session> {
  /* "Is there a login in this build at all" — the same question `getSession`
     asks, and the reason it is asked again here is that it must answer with a
     redirect rather than a null. */
  if (!isAnyPrivateSurfaceOpen()) redirect(PLATFORM_DISABLED_PATH);

  const session = await getSession();
  if (!session) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }

  /* Staff mode opens `/login` for staff and closes `/portal` and `/partner`, so
     a homeowner or referring contractor with valid credentials can reach a real
     session and then has no surface. Refused here, once, for every caller of
     every `require*` helper — `landingPathFor` resolves to `/platform-disabled`
     exactly when that role's own prefix is closed. Without this a customer's
     `/portal` page would be the thing deciding, and a page added under a closed
     prefix would decide nothing at all. */
  const landing = landingPathFor(session.role);
  if (landing === PLATFORM_DISABLED_PATH) redirect(PLATFORM_DISABLED_PATH);

  return session;
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
 * The workspace's tab-title suffix, and the one place it is written.
 *
 * The `/admin` layout hands this to Next as `title.template`, which Next applies
 * to a child segment's title and then *consumes* — a deeper segment inherits no
 * template, because the nearest ancestor that declared one has already had it
 * used. That is invisible until a route three levels down needs to title itself:
 * `/admin/claims/[id]/financials` sits under a layout that already spent the
 * template on the claim reference, so its own title came out bare while every
 * other refusal in the workspace carried the suffix.
 *
 * `adminTitle()` is how a segment past that point re-applies it deliberately,
 * through `title.absolute`, without a second copy of the string.
 */
export const ADMIN_TITLE_TEMPLATE = "%s · CMG claims desk";

export function adminTitle(title: string): string {
  return ADMIN_TITLE_TEMPLATE.replace("%s", title);
}

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
  /* Stated positively and by prefix: this helper needs `/admin` open, which is
     true in `platform` and in `staff` and false in `simple`. `requireUser`
     alone would not say so — it only asks whether a login exists. */
  requireOpenPath(SURFACES.admin.prefix);
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
