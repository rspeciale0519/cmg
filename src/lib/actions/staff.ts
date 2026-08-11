"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { writeAudit } from "@/lib/audit";
import { ROLE_LABEL } from "@/components/admin/nav";
import { loadStaffRoster } from "@/lib/admin/staff";
import type { AppRole } from "@/lib/auth/roles";
import { requireOwner } from "@/lib/authz";
import { issueInvite } from "@/lib/invites";
import { clientIpFromHeaders, inetOrNull } from "@/lib/rate-limit";
import {
  isStaffAppRole,
  LAST_OWNER_REFUSAL,
  strandsWorkspace,
  type PrivilegeChange,
} from "@/lib/staff/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { staffInviteSchema } from "@/lib/validators/staff";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  invalid,
  type FormState,
  type InviteIssueState,
} from "./types";

/**
 * Staff administration, owner-only in three independent layers:
 *
 *   1. `requireOwner()` here, which is `notFound()` for anyone else — and an
 *      explicit aal2 check, not merely a role one. `inviteStaff` writes through
 *      `issueInvite`, which uses the service-role client and is therefore exempt
 *      from the database's aal2 gate, so without this the only thing standing
 *      between a one-factor session and an issued invitation was `proxy.ts`;
 *   2. `profiles_update_owner`, the RLS policy that admits the write at all;
 *   3. `guard_profile_privileges()`, a BEFORE UPDATE trigger that refuses any
 *      change to role / partner_company_id / is_active unless the actor is an
 *      *active* owner or the service role.
 *
 * (3) is the one worth naming, because it is also the reason the guard in
 * `src/lib/staff/guards.ts` has to exist: the predicate that authorises undoing
 * a privilege change is "an active owner asked", so a workspace with no active
 * owner cannot be repaired from inside the product at all.
 *
 * Nothing here uses the service-role client to write a profile. It appears only
 * for `writeAudit`, which has no other path — `audit_log` deliberately grants
 * `authenticated` nothing but SELECT.
 */

const NOT_FOUND = "That account is not available, or it no longer exists.";

const REFUSED_BY_DB =
  "The database refused that change. Roles and access are changed by an active owner only.";

/** `change_staff_privileges` raising because the result would strand the workspace. */
const LAST_OWNER_SQLSTATE = "CMG01";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateStaff() {
  revalidatePath("/admin/staff");
  revalidatePath("/admin/claims");
  revalidatePath("/admin");
}

async function auditStaff(
  actorId: string,
  action: string,
  targetId: string,
  meta: Record<string, unknown>,
): Promise<void> {
  await writeAudit(createAdminClient(), {
    actorId,
    action,
    entity: "profiles",
    entityId: targetId,
    meta,
    ip: inetOrNull(clientIpFromHeaders(await headers())),
  });
}

type Target = {
  id: string;
  name: string;
  role: AppRole;
  isActive: boolean;
};

/**
 * Loads the target and the roster in one place, and refuses anything that is not
 * a staff account. The staff screen must not be able to reach a homeowner or a
 * partner rep: converting a rep away from `partner` would leave their
 * `partner_company_id` set, and they would keep appearing as a representative of
 * a company while holding an adjuster's authority.
 */
async function loadTarget(
  formData: FormData,
): Promise<{ target: Target; roster: Awaited<ReturnType<typeof loadStaffRoster>> } | { error: FormState }> {
  const targetId = String(formData.get("staffId") ?? "").trim();
  if (!UUID.test(targetId)) return { error: { status: "error", message: NOT_FOUND } };

  const supabase = await createClient();
  const [{ data: profile }, roster] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, role, is_active")
      .eq("id", targetId)
      .maybeSingle(),
    loadStaffRoster(supabase),
  ]);

  if (!profile || !isStaffAppRole(profile.role)) {
    return { error: { status: "error", message: NOT_FOUND } };
  }

  return {
    target: {
      id: profile.id,
      name:
        [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
        "This account",
      role: profile.role,
      isActive: profile.is_active,
    },
    roster,
  };
}

function guardOrNull(
  roster: readonly { id: string; role: AppRole; isActive: boolean }[],
  change: PrivilegeChange,
): FormState | null {
  return strandsWorkspace(roster, change)
    ? { status: "error", message: LAST_OWNER_REFUSAL }
    : null;
}

/**
 * Every privilege write goes through `public.change_staff_privileges`, which
 * re-checks "at least one active owner survives" against the *result* of the
 * update, in the same transaction, with the owner rows locked.
 *
 * `strandsWorkspace` above still runs first and is still worth having: it
 * produces the sentence that explains the rule before anything is attempted,
 * and it is what disables the controls on the screen. What it cannot do is
 * hold under concurrency — it reads the roster in one round trip and writes in
 * another, so two owners demoting each other simultaneously both saw a
 * surviving owner and both committed, leaving none. Reading and writing in one
 * statement is the only place that race can be closed; see the migration for
 * why it is a function and not a trigger.
 */
async function applyPrivilegeChange(
  targetId: string,
  change: { role?: AppRole; active?: boolean },
): Promise<FormState | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_staff_privileges", {
    p_target: targetId,
    p_role: change.role ?? undefined,
    p_active: change.active ?? undefined,
  });

  if (!error) return null;

  if (error.code === LAST_OWNER_SQLSTATE) {
    return { status: "error", message: LAST_OWNER_REFUSAL };
  }

  // 42501 is either `guard_profile_privileges()` refusing or
  // `profiles_update_owner` returning no row — both of which reach here only
  // if this action's own owner check and the database's disagree, which is
  // exactly the case the trigger's `and p.is_active` was added for.
  if (error.code === "42501") {
    return { status: "error", message: REFUSED_BY_DB };
  }

  console.error("[staff] privilege change failed", error.message);
  return { status: "error", message: GENERIC_ERROR };
}

export async function changeStaffRole(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner();
  const requested = String(formData.get("role") ?? "").trim();

  if (!isStaffAppRole(requested)) {
    return {
      status: "error",
      message: "Pick one of the three staff roles: owner, adjuster or assistant.",
    };
  }

  const loaded = await loadTarget(formData);
  if ("error" in loaded) return loaded.error;
  const { target, roster } = loaded;

  if (target.role === requested) {
    return { status: "success", message: `${target.name} is already ${ROLE_LABEL[requested].toLowerCase()}.` };
  }

  const blocked = guardOrNull(roster, { targetId: target.id, nextRole: requested });
  if (blocked) return blocked;

  const refused = await applyPrivilegeChange(target.id, { role: requested });
  if (refused) return refused;

  await auditStaff(session.userId, "staff.role_changed", target.id, {
    from: target.role,
    to: requested,
    self: target.id === session.userId,
  });

  revalidateStaff();

  return {
    status: "success",
    message:
      target.id === session.userId && requested !== "owner"
        ? `You are now ${ROLE_LABEL[requested].toLowerCase()}. Partners, Staff, Audit and Settings have left your workspace.`
        : `${target.name} is now ${ROLE_LABEL[requested].toLowerCase()}.`,
  };
}

export async function setStaffActive(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner();
  const requested = String(formData.get("active") ?? "") === "true";

  const loaded = await loadTarget(formData);
  if ("error" in loaded) return loaded.error;
  const { target, roster } = loaded;

  if (target.isActive === requested) {
    return { status: "success", message: "No change — that account is already in that state." };
  }

  const blocked = guardOrNull(roster, { targetId: target.id, nextActive: requested });
  if (blocked) return blocked;

  const refused = await applyPrivilegeChange(target.id, { active: requested });
  if (refused) return refused;

  await auditStaff(session.userId, requested ? "staff.reactivated" : "staff.deactivated", target.id, {
    role: target.role,
    self: target.id === session.userId,
  });

  revalidateStaff();

  if (!requested) {
    return {
      status: "success",
      message:
        target.id === session.userId
          ? "Your account is deactivated. You will be signed out on your next request, and only another active owner can restore it."
          : `${target.name} is deactivated. Their session stops working on their next request; only an owner can restore it.`,
    };
  }

  return { status: "success", message: `${target.name} can sign in again.` };
}

/**
 * §9 asks for an owner/adjuster/assistant invitation, and the schema allows two
 * of those three: `invites_role_allowed` refuses `owner` outright.
 *
 * That constraint is respected rather than relaxed, and the reasoning is worth
 * keeping. An invitation is a 72-hour bearer token sitting in an inbox; an
 * `owner` invitation would be a bearer token that mints the account which can
 * change every other account's role. A new owner is instead invited as an
 * adjuster or assistant and promoted afterwards — a promotion that happens under
 * an authenticated owner session, in one audited statement, against an account
 * whose holder has already proved they control the address. The screen says so
 * next to the role picker.
 */
export async function inviteStaff(
  _previous: InviteIssueState,
  formData: FormData,
): Promise<InviteIssueState> {
  const session = await requireOwner();

  const parsed = staffInviteSchema.safeParse({
    email: formData.get("email") ?? "",
    firstName: formData.get("firstName") ?? "",
    role: formData.get("role") ?? "",
  });

  if (!parsed.success) return invalid(fieldErrorsFrom(parsed.error));

  const result = await issueInvite({
    email: parsed.data.email,
    role: parsed.data.role,
    invitedBy: session.userId,
    firstName: parsed.data.firstName ?? null,
    ip: inetOrNull(clientIpFromHeaders(await headers())),
  });

  if (!result.ok) return { status: "error", message: GENERIC_ERROR };

  revalidateStaff();

  const deliverable = Boolean(process.env.RESEND_API_KEY);
  const roleLabel = ROLE_LABEL[parsed.data.role].toLowerCase();

  return {
    status: "success",
    message: deliverable
      ? `Invitation sent to ${parsed.data.email} as ${roleLabel}. It expires in 72 hours. They will be asked to set up an authenticator before they can open the workspace.`
      : `Invitation created for ${parsed.data.email} as ${roleLabel}. Email delivery is not configured on this environment, so hand them this link — it expires in 72 hours and works once.`,
    manualLink: deliverable ? undefined : result.url,
  };
}
