import "server-only";

import { requireStaff } from "@/lib/authz";
import { claimCapabilities } from "@/lib/claims/capabilities";
import { createClient } from "@/lib/supabase/server";
import { dispatchLorForClaim, type SendLorDeps, type SendLorResult } from "./lor-dispatch";

export type {
  SendLorDeps,
  SendLorFailure,
  SendLorFailureCode,
  SendLorInput,
  SendLorResult,
  SendLorSuccess,
} from "./lor-dispatch";

/**
 * Everything the caller supplies. `actorId` is deliberately not on it: the
 * actor is whoever is signed in, and letting a caller name someone else would
 * make the audit row — the one record of who put a homeowner's signature
 * request out — a field the caller fills in.
 */
export type SendLorRequest = {
  claimId: string;
  requestId?: string;
  /** Contingency fee stamped into the letter; falls back to claim_financials. */
  feePercent?: number | null;
  /** Overrides the covering message in the provider's notification email. */
  message?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One answer for "no such claim", "a claim you cannot see" and "a claim you
 * may see but not manage" — the same rule `issueClaimantInvite` follows, and
 * for the same reason (spec §7.9). An assistant can read every claim through
 * `claims_select` but may manage none, so a distinct "not authorised" here
 * would confirm a row exists to a caller who is not allowed to act on it: the
 * read boundary and the write boundary are in different places and the error
 * must not measure the gap between them.
 */
const REFUSED =
  "That claim is not available to send a Letter of Representation on.";

/**
 * The only authorized way to send a Letter of Representation, and the only
 * thing `./index` exports.
 *
 * The mechanism it delegates to reads and writes any claim by id through the
 * service-role client with no check of its own. That was not exploitable while
 * no user-reachable caller existed — the send button is still unwired — but it
 * was one server action away from being a claim-id IDOR, where posting a
 * stranger's uuid would put CMG's letter in front of that stranger's
 * homeowners and advance their claim to `lor_sent`. Authorization belongs in
 * the same function as the privileged write, not in whatever calls it next.
 *
 * Two checks, and they answer different questions:
 *
 *   * `requireStaff()` — is this a staff member with a second factor? A
 *     homeowner or a partner rep never gets past it, and it throws rather than
 *     returning, so a caller cannot ignore the result.
 *   * `claimCapabilities().canManage` — the TypeScript reading of
 *     `private.can_manage_claim()`: owner, or the adjuster this claim is
 *     assigned to. An assistant is staff and is refused; §4 gives them notes
 *     and documents, not the lifecycle.
 *
 * The claim is looked up through the *user's* client, so `claims_select`
 * decides visibility. A claim an adjuster may not see returns zero rows and is
 * refused before the assignment is even read.
 */
export async function sendLor(
  request: SendLorRequest,
  deps: SendLorDeps = {},
): Promise<SendLorResult> {
  const session = await requireStaff();

  // A malformed id reaches Postgres as a uuid cast error rather than an empty
  // result — a different response shape, and therefore its own small oracle.
  if (!UUID.test(request.claimId)) {
    return { ok: false, code: "not_authorized", message: REFUSED };
  }

  const supabase = await createClient();
  const { data: claim } = await supabase
    .from("claims")
    .select("id, assigned_adjuster_id")
    .eq("id", request.claimId)
    .maybeSingle();

  if (!claim) {
    return { ok: false, code: "not_authorized", message: REFUSED };
  }

  const { canManage } = claimCapabilities(
    { userId: session.userId, role: session.role },
    { assignedAdjusterId: claim.assigned_adjuster_id },
  );

  if (!canManage) {
    return { ok: false, code: "not_authorized", message: REFUSED };
  }

  return dispatchLorForClaim(
    {
      claimId: claim.id,
      requestId: request.requestId,
      feePercent: request.feePercent ?? null,
      message: request.message ?? null,
      actorId: session.userId,
    },
    deps,
  );
}
