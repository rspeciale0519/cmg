"use client";

import { useActionState } from "react";
import { issueClaimantInvite } from "@/lib/actions/invite";
import { idleInviteIssueState, resilient } from "@/lib/actions/types";
import { ActionFeedback, SubmitButton } from "./form-controls";

/**
 * Re-issuing supersedes an unreserved link. Once acceptance is in progress the
 * database preserves that sole live token until it completes or expires, and
 * this surface says so instead of offering a misleading replacement action.
 */
export function ClaimantInvite({
  claimantId,
  hasAccount,
  hasPendingInvite,
  acceptanceInProgress,
  canInvite,
}: {
  claimantId: string;
  hasAccount: boolean;
  hasPendingInvite: boolean;
  acceptanceInProgress: boolean;
  canInvite: boolean;
}) {
  const [state, formAction] = useActionState(
    resilient(issueClaimantInvite),
    idleInviteIssueState,
  );

  if (hasAccount) {
    return (
      <span className="text-[12px] leading-[1.4] text-ink/58">Portal active</span>
    );
  }

  if (!canInvite) {
    return (
      /* Names who can act, like every other refusal in the workspace. "No
         portal access" was a permission written as a status, in the same slot
         and the same colour as the real status "Portal active" above it — and
         the row already says the claimant has none, so the label added nothing
         and hid the fact that someone else can fix it. */
      <span className="text-[12px] leading-[1.4] text-ink/58">
        Invited by the owner or the assigned adjuster
      </span>
    );
  }

  return (
    <div className="min-w-0">
      <form action={formAction}>
        <input type="hidden" name="claimantId" value={claimantId} />
        <SubmitButton
          variant="secondary"
          pendingLabel="Sending…"
          disabled={acceptanceInProgress}
        >
          {acceptanceInProgress
            ? "Acceptance in progress"
            : hasPendingInvite
              ? "Resend invite"
              : "Send invite"}
        </SubmitButton>
      </form>

      {acceptanceInProgress ? (
        <p className="mt-[6px] max-w-[38ch] text-[11.5px] leading-[1.5] text-ink/58">
          Resend is unavailable until this link is accepted or expires.
        </p>
      ) : null}

      <ActionFeedback state={state} />

      {state.manualLink ? (
        <p className="mt-[8px] max-w-[52ch] break-all border-l-2 border-accent py-[2px] pl-[10px] font-mono text-[11.5px] leading-[1.55] text-accent">
          {state.manualLink}
        </p>
      ) : null}
    </div>
  );
}
