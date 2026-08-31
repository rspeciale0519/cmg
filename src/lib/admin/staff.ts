import "server-only";

import { loadUserDirectory } from "@/lib/admin/directory";
import type { AppRole } from "@/lib/auth/roles";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { isStaffAppRole, type RosterEntry } from "@/lib/staff/guards";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";
import { collectPostgrestPages } from "@/lib/supabase/collect-pages";

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
  const data = await collectPostgrestPages((from, to) =>
    supabase
      .from("profiles")
      .select("id, role, is_active")
      .in("role", [...STAFF_ROLES])
      .order("id", { ascending: true })
      .range(from, to),
  );

  return data
    .filter((row) => isStaffAppRole(row.role))
    .map((row) => ({ id: row.id, role: row.role, isActive: row.is_active }));
}

export type StaffDirectory = {
  members: StaffMember[];
  pendingInvites: PendingStaffInvite[];
  activeOwnerIds: string[];
  /** Staff accounts, counted in the database rather than measured off the page. */
  total: number;
  activeTotal: number;
  /** Active accounts with no verified TOTP factor — the one thing here that is someone's job. */
  unenrolledTotal: number;
};

/** Fifty. A firm's staff list is small; this is a ceiling, not a window. */
export const STAFF_PAGE_SIZE = 50;

/**
 * The staff screen's whole dataset. Two of the four facts per person come from
 * `profiles` and two — the sign-in address and whether a *verified* TOTP factor
 * exists — from `public.admin_user_directory()`, because they live in the `auth`
 * schema and no policy in `public` can reach them.
 *
 * Sorted owner → adjuster → assistant, then by surname. The ordering moved into
 * Postgres when the list gained a pager, because a sort applied in JavaScript
 * after the fact orders the page rather than the list — page 2 would begin
 * wherever the database happened to stop. `app_role` is declared
 * owner/adjuster/assistant, and an enum sorts in declaration order, so the role
 * axis survives the move exactly; the name axis becomes surname-first, which is
 * what `loadAdjusters` and the partner rep table already do.
 *
 * `total` and `activeTotal` are `count: "exact"`. `unenrolledTotal` is counted
 * across an exhaustively paged roster read rather than by the database,
 * because "has a verified factor" lives in `auth` and cannot be joined here.
 */
export async function loadStaffDirectory(
  from = 0,
  to = STAFF_PAGE_SIZE - 1,
): Promise<StaffDirectory> {
  const supabase = await createClient();

  const [profilesResult, rosterResult, activeResult, invitesResult, directory] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, role, is_active, phone, created_at", {
          count: "exact",
        })
        .in("role", [...STAFF_ROLES])
        .order("role", { ascending: true })
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
      // Page-independent, because the sole-owner guard and the enrolment tally
      // are facts about the workspace rather than about this window.
      collectPostgrestPages((rangeFrom, rangeTo) =>
        supabase
          .from("profiles")
          .select("id, role, is_active")
          .in("role", [...STAFF_ROLES])
          .order("id", { ascending: true })
          .range(rangeFrom, rangeTo),
      ),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", [...STAFF_ROLES])
        .eq("is_active", true),
      collectPostgrestPages((rangeFrom, rangeTo) =>
        supabase
          .from("invites")
          .select("id, email, role, expires_at")
          .in("role", ["adjuster", "assistant"])
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(rangeFrom, rangeTo),
      ),
      loadUserDirectory(),
    ]);

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
    });

  const roster = rosterResult.filter((row) => isStaffAppRole(row.role));

  return {
    members,
    pendingInvites: invitesResult.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at,
    })),
    activeOwnerIds: roster
      .filter((row) => row.role === "owner" && row.is_active)
      .map((row) => row.id),
    total: profilesResult.count ?? members.length,
    activeTotal: activeResult.count ?? 0,
    unenrolledTotal: roster.filter(
      (row) => row.is_active && !(directory.get(row.id)?.mfaEnrolled ?? false),
    ).length,
  };
}
