import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The two account facts that do not live in `public`: the sign-in address and
 * whether a verified TOTP factor exists.
 *
 * Read through `public.admin_user_directory()` — an owner-gated SECURITY DEFINER
 * function — and NOT through the service-role client. The distinction matters:
 * `auth.admin.listUsers()` would answer for whoever called it, so the
 * authorization decision would live in this file. The function judges the
 * caller's own session inside Postgres and raises 42501 for anyone who is not an
 * active owner, which is the same shape as every other read in this workspace.
 *
 * `cache()` because a page renders the directory once but reads it per row.
 */
export type DirectoryEntry = {
  email: string | null;
  lastSignInAt: string | null;
  mfaEnrolled: boolean;
  mfaConfirmedAt: string | null;
};

export type Directory = ReadonlyMap<string, DirectoryEntry>;

export const loadUserDirectory = cache(async function loadUserDirectory(): Promise<Directory> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_directory");

  // An empty map rather than a throw. Every caller renders a row per *profile*
  // and looks the account facts up beside it, so a directory that could not be
  // read degrades to "email and MFA unknown" instead of taking down a screen
  // whose primary content — who works here, in what role — came from
  // `profiles` and is intact.
  if (error) {
    console.error("[admin] account directory unavailable", error.message);
    return new Map();
  }

  return new Map(
    (data ?? []).map((row) => [
      row.user_id,
      {
        email: row.email,
        lastSignInAt: row.last_sign_in_at,
        mfaEnrolled: row.mfa_enrolled,
        mfaConfirmedAt: row.mfa_confirmed_at,
      },
    ]),
  );
});
