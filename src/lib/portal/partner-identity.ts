import "server-only";

import { requireRole } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

/**
 * Who the partner shell says is signed in, resolved once.
 *
 * The page read the profile and passed "Tyler Boone / Referral partner"; the
 * 404 next to it passed `session.email` and the word "Partner". Same person,
 * same session, two names and two roles, one click apart — and the 404 is
 * exactly where a reader is already unsure where they are. One function, so the
 * next screen on this surface cannot invent a third spelling.
 *
 * The email is the fallback rather than a placeholder word, because a partner
 * whose profile has no name should still see something that identifies the
 * account they are in.
 */
export async function partnerIdentity(): Promise<{ name: string; role: string }> {
  const session = await requireRole("partner");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", session.userId)
    .maybeSingle();

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  return {
    name: name || (session.email ?? "Partner"),
    role: "Referral partner",
  };
}
