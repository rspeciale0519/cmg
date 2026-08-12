"use client";

import { useActionState } from "react";
import { issueClaimantInvite } from "@/lib/actions/invite";
import { idleInviteIssueState, resilient } from "@/lib/actions/types";
import { ActionFeedback, SubmitButton } from "./form-controls";

/**
 * Re-issuing supersedes rather than accumulates: `issueInvite()` expires every
 * live invitation for the same address and claim before minting the new one, so
 * a link that was forwarded to the wrong inbox stops working the moment a
 * replacement is sent. The button says "Resend" once an invitation exists
 * because that is what the operator is doing, and the wording should not imply
 * the old link survives.
 */
export function ClaimantInvite({
  claimantId,
  hasAccount,
  hasPendingInvite,
  canInvite,
}: {
  claimantId: string;
  hasAccount: boolean;
  hasPendingInvite: boolean;
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
        <SubmitButton variant="secondary" pendingLabel="Sending…">
          {hasPendingInvite ? "Resend invite" : "Send invite"}
        </SubmitButton>
      </form>

      <ActionFeedback state={state} />

      {state.manualLink ? (
        <p className="mt-[8px] max-w-[52ch] break-all border-l-2 border-accent py-[2px] pl-[10px] font-mono text-[11.5px] leading-[1.55] text-accent">
          {state.manualLink}
        </p>
      ) : null}
    </div>
  );
}
