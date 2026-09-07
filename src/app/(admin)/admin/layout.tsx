import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_TITLE_TEMPLATE, requireStaff } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "Claims desk", template: ADMIN_TITLE_TEMPLATE },
  robots: { index: false, follow: false },
};

/**
 * The shell is a layout rather than a per-page component so the nav does not
 * remount between routes — a nav that re-renders on every navigation loses its
 * scroll position on a phone, which on an eight-item horizontal rail means the
 * item you just tapped scrolls away from under your thumb.
 *
 * `requireStaff` here is the third of three independent checks on the same
 * request: `proxy.ts` decides on a path prefix, this decides on the session,
 * and every page and action below asks again. They are deliberately redundant —
 * a layout guard is not inherited by a server action, and a page that forgot
 * its own check would still be covered here, but only for rendering.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireStaff("/admin");
  const supabase = await createClient();

  const [profile, intake, leads] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", session.userId)
      .maybeSingle(),
    supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("status", "new_intake"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  const name =
    [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(" ") ||
    session.email ||
    "Staff";

  return (
    <AdminShell
      identity={{ name, role: session.role }}
      counts={{ intake: intake.count ?? 0, leads: leads.count ?? 0 }}
    >
      {children}
    </AdminShell>
  );
}
