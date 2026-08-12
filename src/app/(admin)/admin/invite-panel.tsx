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
  /** Owner, or the adjuster this row's claim is assigned to — the action's rule. */
  canInvite: boolean;
};

/**
 * Homeowners on accepted claims who still have no way in. Acceptance issues
 * invitations automatically (§6), so a row here means one of them did not send
 * — a bounced address, or a claim accepted before this flow existed. It is a
 * repair list, and it is empty on a healthy day.
 *
 * `canInvite` is not decoration. `claimants_select` admits an assistant to every
 * claimant row, so the panel populates for them, but `issueClaimantInvite`
 * allows only an owner or the claim's own adjuster — so an assistant was shown a
 * Send invite button on every row that the server would refuse every time, and
 * the refusal it answered with is `GENERIC_ERROR`: "We could not submit that just
 * now. Please try again, or call us and we'll take the details over the phone."
 * A permission they will never hold, described as a transient failure, with an
 * invitation to keep trying and then telephone the office. The claim's own
 * Claimants tab has always got this right — see `ClaimantInvite`, which says
 * "No portal access" — so the two screens disagreed about the same operation.
 */
export function InvitePanel({
  claimants,
  total,
}: {
  claimants: InvitableClaimant[];
  /** Everyone the predicate matches, not just the excerpt shown here. */
  total: number;
}) {
  const [state, formAction] = useActionState(
    issueClaimantInvite,
    idleInviteIssueState,
  );

  if (claimants.length === 0) {
    return (
      <p className="px-[clamp(14px,1.6vw,20px)] py-[clamp(28px,4vw,44px)] text-center text-[13px] leading-[1.6] text-ink/55">
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
              <p className="mt-[2px] truncate text-[12px] leading-[1.4] text-ink/55">
                {claimant.email} · <span className="tabular-nums">{claimant.claimRef}</span>
              </p>
            </div>
            {claimant.canInvite ? (
              <form action={formAction}>
                <input type="hidden" name="claimantId" value={claimant.id} />
                <SubmitButton variant="secondary" pendingLabel="Sending…">
                  Send invite
                </SubmitButton>
              </form>
            ) : (
              <span className="text-[12px] leading-[1.4] text-ink/58">
                No portal access
              </span>
            )}
          </li>
        ))}
      </ul>

      {claimants.length < total ? (
        /* This panel is the newest few of a longer repair list, and there is no
           screen that lists the rest — the remainder is reached one claim at a
           time. Saying so is the difference between an excerpt and a wrong
           total: sending one of these refills the panel from the same queue. */
        <p className="border-t border-ink/8 px-[clamp(14px,1.6vw,20px)] py-[10px] text-[12px] leading-[1.55] text-ink/55">
          The newest {claimants.length} of {total}. Sending one brings the next
          into view; any homeowner can also be invited from their claim&rsquo;s
          Claimants tab.
        </p>
      ) : null}

      <div className="px-[clamp(14px,1.6vw,20px)] pb-[14px] pt-[10px]">
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
