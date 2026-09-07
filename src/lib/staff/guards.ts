import type { AppRole } from "@/lib/auth/roles";
import { STAFF_ROLES } from "@/lib/auth/roles";

/**
 * The rules the staff screen enforces above RLS, kept pure so they can be tested
 * against the case that matters rather than mocked around.
 *
 * `guard_profile_privileges()` in the database already refuses a role, partner
 * or activation change from anyone who is not an *active* owner. That is the
 * floor, and it is also the thing that makes the rule below necessary: if the
 * last active owner deactivates or demotes themselves, the predicate that
 * authorises undoing it can never again be satisfied by any user. Nobody can
 * promote a replacement, because promoting requires an active owner; and the
 * deactivated owner cannot restore themselves, because the actor lookup filters
 * on `is_active`. The workspace is then only recoverable with the service-role
 * key, i.e. by a developer with production credentials.
 *
 * So the invariant is not "an owner may not deactivate themselves" — it is
 * "this change must not leave the workspace with zero active owners", which
 * covers self-deactivation, demoting the last owner, and deactivating someone
 * else's owner account, in one predicate.
 *
 * It is deliberately NOT a database trigger. A trigger would also fire for the
 * service-role paths that legitimately rebuild a workspace (the seed, a restore,
 * an offboarding migration), and the pgTAP suite deactivates owner accounts on
 * purpose to prove other guards hold. The rule belongs to the screen that offers
 * the control, and the server action is where a screen's rules are enforced.
 */
export type RosterEntry = {
  id: string;
  role: AppRole;
  isActive: boolean;
};

export type PrivilegeChange = {
  targetId: string;
  /** Absent means "unchanged". */
  nextRole?: AppRole;
  /** Absent means "unchanged". */
  nextActive?: boolean;
};

export function isStaffAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value)
  );
}

function entryAfter(entry: RosterEntry, change: PrivilegeChange): RosterEntry {
  if (entry.id !== change.targetId) return entry;

  return {
    id: entry.id,
    role: change.nextRole ?? entry.role,
    isActive: change.nextActive ?? entry.isActive,
  };
}

/** Ids that would still hold an active owner account once the change landed. */
export function activeOwnersAfter(
  roster: readonly RosterEntry[],
  change: PrivilegeChange,
): string[] {
  return roster
    .map((entry) => entryAfter(entry, change))
    .filter((entry) => entry.role === "owner" && entry.isActive)
    .map((entry) => entry.id);
}

/**
 * True when applying `change` would leave nobody able to administer the
 * workspace. The roster must contain every profile that could hold an owner
 * account — passing a filtered list would make this answer "no" for the wrong
 * reason.
 */
export function strandsWorkspace(
  roster: readonly RosterEntry[],
  change: PrivilegeChange,
): boolean {
  return activeOwnersAfter(roster, change).length === 0;
}

export const LAST_OWNER_REFUSAL =
  "This is the only active owner account, so it has to stay active and stay an owner. " +
  "A deactivated owner cannot restore themselves — the database asks for an active owner " +
  "before it will change anyone's role or access, including their own. Promote a second " +
  "owner first, then come back.";
