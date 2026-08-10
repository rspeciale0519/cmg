import type { AppRole } from "@/lib/auth/roles";

/**
 * The TypeScript reading of `private.can_manage_claim()` — owner, or the
 * adjuster this claim is assigned to (spec §4: "status / assignment | owner ✔ |
 * adjuster assigned ✔ | assistant ✖").
 *
 * This is a *rendering* decision and never an authorization one. RLS decides
 * whether a write lands; every action re-asks the database and treats a
 * zero-row result as a refusal. What this buys is a UI that does not offer an
 * assistant a status picker that will always be rejected, or draw a money panel
 * that `claim_financials_select` will return empty — an empty panel says "no
 * settlement recorded" when the truth is "not yours to see", and those are
 * different sentences.
 */
export type ClaimActor = {
  userId: string;
  role: AppRole;
};

export type ClaimAssignment = {
  assignedAdjusterId: string | null;
};

export type ClaimCapabilities = {
  /** Status, assignment, money, partner-visible feed entries. */
  canManage: boolean;
  /** Separate name because §4 lists it as its own row, and it may yet diverge. */
  canSeeFinancials: boolean;
  /** Notes and customer-visible replies — what an assistant is granted. */
  canPostNote: boolean;
  /** `partner` / `shared` feed entries are a disclosure, not a note. */
  canPostShared: boolean;
  canUploadDocuments: boolean;
  /** Representation documents arm the lor_signed gate; §4 keeps them narrow. */
  canUploadRepresentation: boolean;
  isOwner: boolean;
};

export function claimCapabilities(
  actor: ClaimActor,
  claim: ClaimAssignment,
): ClaimCapabilities {
  const isOwner = actor.role === "owner";
  const isAssignedAdjuster =
    actor.role === "adjuster" && claim.assignedAdjusterId === actor.userId;
  const canManage = isOwner || isAssignedAdjuster;
  const isStaff = isOwner || actor.role === "adjuster" || actor.role === "assistant";

  return {
    canManage,
    canSeeFinancials: canManage,
    // An assistant may write notes and replies on any claim (§4 claim_events:
    // "assistant ✔ (notes)"); an adjuster only on their own, which `canManage`
    // already carries.
    canPostNote: canManage || actor.role === "assistant",
    canPostShared: canManage,
    canUploadDocuments: isStaff,
    canUploadRepresentation: canManage,
    isOwner,
  };
}

/**
 * Accepting an intake means assigning an adjuster and advancing the status on a
 * claim that has no adjuster yet — so `can_manage_claim()` reduces to
 * `is_owner()` and no other role can complete it, however much of the form they
 * can see. Stated here as its own predicate rather than left implicit in
 * `canManage`, because the reason is different: not "this claim isn't yours"
 * but "an unassigned claim is nobody's".
 */
export function canAcceptIntake(actor: ClaimActor): boolean {
  return actor.role === "owner";
}
