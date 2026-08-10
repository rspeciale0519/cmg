import "server-only";

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
 */
export async function requireRole(...roles: readonly AppRole[]): Promise<Session> {
  const session = await requireUser();
  if (!roles.includes(session.role)) notFound();
  return session;
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
