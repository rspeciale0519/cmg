import "server-only";

import { loadUserDirectory } from "@/lib/admin/directory";
import type { AppRole } from "@/lib/auth/roles";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { isStaffAppRole, type RosterEntry } from "@/lib/staff/guards";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type StaffMember = {
  id: string;
  name: string;
  role: AppRole;
  isActive: boolean;
  phone: string | null;
  email: string | null;
  mfaEnrolled: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

export type PendingStaffInvite = {
  id: string;
  email: string;
  role: AppRole;
  expiresAt: string;
};

/**
 * Every profile that holds a staff role, for the last-active-owner guard.
 *
 * Read through the caller's client — `profiles_select_self_or_staff` lets staff
 * see the whole directory — and deliberately unfiltered by `is_active`, because
 * a roster that omitted deactivated owners would make
 * `strandsWorkspace()` answer a different question than the one it was asked.
 */
export async function loadStaffRoster(
  supabase: SupabaseClient<Database>,
): Promise<RosterEntry[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .in("role", [...STAFF_ROLES]);

  if (error) {
    console.error("[staff] roster read failed", error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => isStaffAppRole(row.role))
    .map((row) => ({ id: row.id, role: row.role, isActive: row.is_active }));
}

export type StaffDirectory = {
  members: StaffMember[];
  pendingInvites: PendingStaffInvite[];
  activeOwnerIds: string[];
};

/**
 * The staff screen's whole dataset. Two of the four facts per person come from
 * `profiles` and two — the sign-in address and whether a *verified* TOTP factor
 * exists — from `public.admin_user_directory()`, because they live in the `auth`
 * schema and no policy in `public` can reach them.
 *
 * Sorted owner → adjuster → assistant, then by name. Role is the axis an owner
 * scans this list on, and alphabetical-only ordering would interleave the three
 * authorities that the workspace treats completely differently.
 */
export async function loadStaffDirectory(): Promise<StaffDirectory> {
  const supabase = await createClient();

  const [profilesResult, invitesResult, directory] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, role, is_active, phone, created_at")
      .in("role", [...STAFF_ROLES]),
    supabase
      .from("invites")
      .select("id, email, role, expires_at")
      .in("role", ["adjuster", "assistant"])
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    loadUserDirectory(),
  ]);

  const rank: Record<string, number> = { owner: 0, adjuster: 1, assistant: 2 };

  const members: StaffMember[] = (profilesResult.data ?? [])
    .filter((row) => isStaffAppRole(row.role))
    .map((row) => {
      const account = directory.get(row.id);
      return {
        id: row.id,
        name:
          [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
          account?.email ||
          "Unnamed",
        role: row.role,
        isActive: row.is_active,
        phone: row.phone,
        email: account?.email ?? null,
        mfaEnrolled: account?.mfaEnrolled ?? false,
        lastSignInAt: account?.lastSignInAt ?? null,
        createdAt: row.created_at,
      };
    })
    .sort(
      (a, b) =>
        (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.name.localeCompare(b.name),
    );

  return {
    members,
    pendingInvites: (invitesResult.data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at,
    })),
    activeOwnerIds: members
      .filter((member) => member.role === "owner" && member.isActive)
      .map((member) => member.id),
  };
}
