"use client";

import { useActionState } from "react";
import { ActionFeedback, SubmitButton } from "@/components/admin/form-controls";
import { issueClaimantInvite } from "@/lib/actions/invite";
import { idleInviteIssueState } from "@/lib/actions/types";

export type InvitableClaimant = {
  id: string;
  name: string;
  email: string;
  claimRef: string;
};

/**
 * Homeowners on accepted claims who still have no way in. Acceptance issues
 * invitations automatically (§6), so a row here means one of them did not send
 * — a bounced address, or a claim accepted before this flow existed. It is a
 * repair list, and it is empty on a healthy day.
 */
export function InvitePanel({ claimants }: { claimants: InvitableClaimant[] }) {
  const [state, formAction] = useActionState(
    issueClaimantInvite,
    idleInviteIssueState,
  );

  if (claimants.length === 0) {
    return (
      <p className="px-[clamp(14px,1.6vw,20px)] py-[clamp(28px,4vw,44px)] text-center text-[13px] leading-[1.6] text-ink/45">
        Everyone on your claims has portal access.
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-ink/8">
        {claimants.map((claimant) => (
          <li
            key={claimant.id}
            className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-[clamp(14px,1.6vw,20px)] py-[11px]"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] leading-[1.45] text-ink/85">
                {claimant.name}
              </p>
              <p className="mt-[2px] truncate text-[12px] leading-[1.4] text-ink/42">
                {claimant.email} · <span className="tabular-nums">{claimant.claimRef}</span>
              </p>
            </div>
            <form action={formAction}>
              <input type="hidden" name="claimantId" value={claimant.id} />
              <SubmitButton variant="secondary" pendingLabel="Sending…">
                Send invite
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>

      <div className="px-[clamp(14px,1.6vw,20px)] pb-[14px]">
        <ActionFeedback state={state} />
        {state.manualLink ? (
          <p className="mt-[8px] break-all border-l-2 border-accent py-[2px] pl-[10px] font-mono text-[12px] leading-[1.55] text-accent">
            {state.manualLink}
          </p>
        ) : null}
      </div>
    </div>
  );
}
