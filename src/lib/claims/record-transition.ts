import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  enqueueNotifications,
  notifyPartnerOfStatus,
  portalUrl,
  settlementAmountFor,
} from "./notify";
import {
  customerPhaseFor,
  STATUS_LABEL,
  STATUS_MEANING,
  type ClaimStatus,
} from "./status";

type Client = SupabaseClient<Database>;
type EventVisibility = Database["public"]["Enums"]["claim_event_visibility"];

/**
 * Spec §5: "visibility `shared` for milestone statuses, `customer` otherwise".
 *
 * The milestones are the four the partner projection actually carries dates for
 * — representation signed, filed with the carrier, settled, closed — because a
 * referring contractor's legitimate interest is in whether the claim they sent
 * is progressing, not in the week-to-week of a negotiation. `denied` joins them:
 * a contractor who referred a homeowner needs to know the carrier refused, and
 * `claim_partner_summaries` surfaces the status regardless, so withholding the
 * feed entry would only make the portal inconsistent with itself.
 *
 * `rejected` is `internal` and is the one status with no customer at all: the
 * intake was declined, no invite was ever issued (§6), and there is nobody on
 * the other side to read a feed entry or an email.
 */
export function visibilityForStatus(status: ClaimStatus): EventVisibility {
  if (status === "rejected") return "internal";
  if (
    status === "lor_signed" ||
    status === "filed" ||
    status === "settled" ||
    status === "closed" ||
    status === "denied"
  ) {
    return "shared";
  }
  return "customer";
}

export type TransitionRecord = {
  claimId: string;
  claimRef: string;
  from: ClaimStatus;
  to: ClaimStatus;
  note: string | null;
  actorId: string;
};

/**
 * The three writes that follow a status change, and the honest account of what
 * happens when one of them fails.
 *
 * The status UPDATE itself has already committed by the time this runs, and it
 * carries its own guarantee: `audit_claims` is an AFTER trigger on the table, so
 * the change is in `audit_log` with its actor and its before/after values
 * whatever happens here. That is the property that makes best-effort acceptable
 * for the rest — the record of *what happened to the claim* cannot be lost, only
 * the human-readable presentation of it can, and every failure below is returned
 * to the caller as a sentence rather than swallowed.
 *
 * Ordered cheapest-to-undo last: history (the log staff read), then the feed
 * entry (what the homeowner reads), then the email (the only irreversible one).
 */
export async function recordTransition(
  supabase: Client,
  record: TransitionRecord,
): Promise<string[]> {
  const warnings: string[] = [];

  const { error: historyError } = await supabase
    .from("claim_status_history")
    .insert({
      claim_id: record.claimId,
      from_status: record.from,
      to_status: record.to,
      changed_by: record.actorId,
      note: record.note,
    });

  if (historyError) {
    console.error("[claims] status history insert failed", historyError.message);
    warnings.push(
      "The status changed, but the history entry could not be written. The change is still in the audit trail.",
    );
  }

  const visibility = visibilityForStatus(record.to);
  const body = record.note
    ? `Status changed to ${STATUS_LABEL[record.to]}. ${record.note}`
    : `Status changed to ${STATUS_LABEL[record.to]}.`;

  const { error: eventError } = await supabase.from("claim_events").insert({
    claim_id: record.claimId,
    type: "status",
    body,
    author_id: record.actorId,
    visibility,
  });

  if (eventError) {
    console.error("[claims] feed event insert failed", eventError.message);
    warnings.push("The status changed, but the activity entry could not be posted.");
  }

  if (visibility === "internal") return warnings;

  const notifyWarning = await notifyPrimaryClaimant(supabase, record);
  if (notifyWarning) warnings.push(notifyWarning);

  /* `shared` is exactly the milestone set a referring contractor is entitled to
     — see `visibilityForStatus` above — so the partner mail is driven by the
     same predicate as the feed entry rather than by a second list that could
     disagree with it. Skipped entirely for a claim nobody referred. */
  if (visibility === "shared") {
    const partnerWarning = await notifyPartnerOfStatus({
      claimId: record.claimId,
      claimRef: record.claimRef,
      statusLabel: STATUS_LABEL[record.to],
    });
    if (partnerWarning) warnings.push(partnerWarning);
  }

  return warnings;
}

/**
 * Reads the claimant through the caller's client — `claimants_select` already
 * scopes it — and enqueues through the service-role one, because
 * `notifications_outbox` carries no policy for `authenticated` at all (spec §4:
 * service-role-only tables). The queue write is the delivery guarantee; the
 * immediate send attempt after it is an optimisation, and with no
 * `RESEND_API_KEY` it is skipped and the sweeper owns the row.
 *
 * `settled` is the one status that does not get the generic update. It is the
 * answer the homeowner has been waiting for rather than another step towards it,
 * and it is the only one carrying a figure — `templates/claim-status.tsx`
 * records why that earns its own template.
 */
async function notifyPrimaryClaimant(
  supabase: Client,
  record: TransitionRecord,
): Promise<string | null> {
  const { data: claimant } = await supabase
    .from("claimants")
    .select("first_name, email")
    .eq("claim_id", record.claimId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!claimant) return null;

  const phase = customerPhaseFor(record.to);

  const message =
    record.to === "settled"
      ? ({
          template: "settled_notice",
          payload: {
            firstName: claimant.first_name,
            claimRef: record.claimRef,
            settlementAmount: (await settlementAmountFor(record.claimId)) ?? undefined,
            note: record.note ?? undefined,
            portalUrl: portalUrl(),
          },
        } as const)
      : ({
          template: "claim_status_update",
          payload: {
            firstName: claimant.first_name,
            claimRef: record.claimRef,
            statusLabel: STATUS_LABEL[record.to],
            statusMeaning: STATUS_MEANING[record.to],
            phase: phase ?? undefined,
            note: record.note ?? undefined,
            portalUrl: portalUrl(),
          },
        } as const);

  const ok = await enqueueNotifications([
    { recipientEmail: claimant.email, message },
  ]);

  return ok
    ? null
    : "The status changed, but the homeowner's notification could not be queued.";
}
