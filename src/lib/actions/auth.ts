"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { isAppRole, landingPathFor, safeNextPath } from "@/lib/auth/roles";
import { requireOpenPath } from "@/lib/authz";
import {
  checkRateLimit,
  clientIpFromHeaders,
  inetOrNull,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMIT_ERROR, type FormState } from "./types";

/**
 * One message for every failed sign-in: wrong password, unknown address,
 * deactivated account, or a profile that was never provisioned. Spec §7.9 —
 * "wrong password" and "no such user" are the two halves of an account
 * enumeration oracle, and a login form is the cheapest place in the system to
 * read it.
 */
const SIGN_IN_ERROR =
  "That email and password combination did not work. Check both and try again.";

export async function signIn(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  requireOpenPath("/login");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "")) ?? null;

  if (email.length === 0 || password.length === 0) {
    return { status: "error", message: SIGN_IN_ERROR };
  }

  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);

  // IP first and short-circuiting, as on the public forms: a request already
  // refused on its source must not also spend the address's budget, or one
  // throwaway host can lock a named person out of their own account.
  if (!(await checkRateLimit(RATE_LIMITS.loginIp, ip))) {
    return { status: "error", message: RATE_LIMIT_ERROR };
  }
  if (!(await checkRateLimit(RATE_LIMITS.loginEmail, email))) {
    return { status: "error", message: RATE_LIMIT_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const admin = createAdminClient();
    await writeAudit(admin, {
      action: "auth.sign_in_failed",
      entity: "auth",
      meta: { email, reason: error?.code ?? "unknown" },
      ip: inetOrNull(ip),
    });
    return { status: "error", message: SIGN_IN_ERROR };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  // No readable profile means deactivated (the self branch of
  // `profiles_select_self_or_staff` carries `is_active`) or never provisioned.
  // The credentials were correct, so the session now exists — it is signed out
  // again here rather than left standing behind a generic error message.
  if (!profile || !isAppRole(profile.role)) {
    await supabase.auth.signOut();
    const admin = createAdminClient();
    await writeAudit(admin, {
      actorId: data.user.id,
      action: "auth.sign_in_refused",
      entity: "auth",
      meta: { email, reason: "no_active_profile" },
      ip: inetOrNull(ip),
    });
    return { status: "error", message: SIGN_IN_ERROR };
  }

  const admin = createAdminClient();
  await writeAudit(admin, {
    actorId: data.user.id,
    action: "auth.sign_in",
    entity: "auth",
    entityId: data.user.id,
    meta: { role: profile.role },
    ip: inetOrNull(ip),
  });

  // The proxy decides whether this lands or bounces to `/mfa`: a staff account
  // arrives here at aal1, so `/admin` will redirect until a factor is verified.
  redirect(next ?? landingPathFor(profile.role));
}

export async function signOut(): Promise<void> {
  requireOpenPath("/login");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  // `scope: 'local'` would clear this browser's cookies and leave the refresh
  // token valid everywhere else. Signing out globally is what a user pressing
  // "Sign out" on a shared machine means by it.
  await supabase.auth.signOut({ scope: "global" });

  if (userId) {
    await writeAudit(createAdminClient(), {
      actorId: userId,
      action: "auth.sign_out",
      entity: "auth",
      entityId: userId,
    });
  }

  redirect("/login");
}
