"use client";

import { useActionState } from "react";
import { reassignClaimAdjuster } from "@/lib/actions/claims";
import { idleState } from "@/lib/actions/types";
import type { AdjusterOption } from "@/lib/claims/queries";
import { ActionFeedback, AdminField, AdminSelect, SubmitButton } from "./form-controls";

/**
 * Assignment is the one claim update that cannot be a plain UPDATE. Postgres
 * applies SELECT policies to the *new* row, and `claims_select` scopes an
 * adjuster to `assigned_adjuster_id = auth.uid()` — so the instant the new
 * value is a colleague, the row leaves the caller's visibility and the
 * statement is refused. `public.reassign_claim()` judges the caller against the
 * pre-update row and then writes as the function owner, which is why every
 * hand-off in this UI goes through the RPC.
 */
export function ReassignForm({
  claimId,
  currentAdjusterId,
  adjusters,
  canManage,
}: {
  claimId: string;
  currentAdjusterId: string | null;
  adjusters: AdjusterOption[];
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(reassignClaimAdjuster, idleState);

  if (!canManage) {
    return (
      <p className="text-[13px] leading-[1.6] text-ink/58">
        Reassignment is done by the owner and by the adjuster the claim is
        currently assigned to.
      </p>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="claimId" value={claimId} />

      <AdminField name="adjusterId" label="Assigned adjuster">
        {/* Echoed first, stored second: a refusal that says "A claim can only be
            assigned to an active adjuster" has to leave the picked adjuster on
            screen, or it is a sentence about a value the reader can no longer
            see. A success revalidates, `currentAdjusterId` arrives new, and
            `state.values` is absent — so the control returns to the server. */}
        <AdminSelect
          name="adjusterId"
          defaultValue={state.values?.adjusterId ?? currentAdjusterId ?? ""}
        >
          {/* Unassigning is a real move, not an empty state: it returns the
              claim to the intake queue for the owner to route again. */}
          <option value="">Unassigned — back to the queue</option>
          {adjusters.map((adjuster) => (
            <option key={adjuster.id} value={adjuster.id}>
              {adjuster.name}
            </option>
          ))}
        </AdminSelect>
      </AdminField>

      <div className="mt-[13px]">
        <SubmitButton variant="secondary" pendingLabel="Saving…">
          Save assignment
        </SubmitButton>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
