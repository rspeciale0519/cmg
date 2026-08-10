"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { issueClaimantInvite } from "@/lib/actions/invite";
import { idleInviteIssueState } from "@/lib/actions/types";

export type InvitableClaimant = {
  id: string;
  name: string;
  email: string;
  claimRef: string;
};

export function InvitePanel({ claimants }: { claimants: InvitableClaimant[] }) {
  const [state, formAction, pending] = useActionState(
    issueClaimantInvite,
    idleInviteIssueState,
  );

  return (
    <section className="border border-ink/13 bg-surface/55 p-[clamp(20px,2.4vw,28px)]">
      <h2 className="text-[20px] font-medium leading-[1.25] tracking-[-0.02em]">
        Portal invitations
      </h2>
      <p className="mt-[10px] max-w-[64ch] text-[15px] leading-[1.7] text-ink/72">
        Claimants on your claims who do not have portal access yet. An invitation
        expires after 72 hours and can be used once.
      </p>

      {state.status === "success" ? (
        <div className="mt-5 border border-accent/45 bg-accent/7 p-4">
          <p className="text-[14px] leading-[1.65] text-ink/85">{state.message}</p>
          {state.manualLink ? (
            <p className="mt-3 break-all font-mono text-[13px] leading-[1.6] text-accent">
              {state.manualLink}
            </p>
          ) : null}
        </div>
      ) : (
        <FormAlert message={state.message} />
      )}

      {claimants.length === 0 ? (
        <p className="mt-5 border border-dashed border-ink/16 p-4 text-[15px] leading-[1.7] text-ink/55">
          Every claimant on your claims already has portal access.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-ink/13 border-y border-ink/13">
          {claimants.map((claimant) => (
            <li
              key={claimant.id}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
            >
              <div className="min-w-0">
                <p className="text-[15px] leading-[1.5] text-ink">{claimant.name}</p>
                <p className="mt-[2px] text-[13px] leading-[1.5] text-ink/55">
                  {claimant.email} · {claimant.claimRef}
                </p>
              </div>
              <form action={formAction}>
                <input type="hidden" name="claimantId" value={claimant.id} />
                <Button
                  type="submit"
                  size="compact"
                  disabled={pending}
                  aria-busy={pending}
                >
                  Invite
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
