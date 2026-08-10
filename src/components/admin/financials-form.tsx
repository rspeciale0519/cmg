"use client";

import { useActionState, useState } from "react";
import { saveClaimFinancials } from "@/lib/actions/claims";
import { idleState } from "@/lib/actions/types";
import { formatMoney } from "@/lib/format";
import { ActionFeedback, AdminField, AdminInput, AdminTextarea, SubmitButton } from "./form-controls";

/**
 * The fee is shown as a figure as it is typed, because a percentage of a
 * settlement is the number the conversation is actually about and nobody
 * should be doing that arithmetic in their head next to a homeowner. It is
 * derived for display only — the two stored columns stay the amount and the
 * percent, which is what §4 defines and what the partner projection reads.
 */
export function FinancialsForm({
  claimId,
  settlementAmount,
  feePercent,
  notes,
}: {
  claimId: string;
  settlementAmount: number | null;
  feePercent: number | null;
  notes: string | null;
}) {
  const [state, formAction] = useActionState(saveClaimFinancials, idleState);
  const [amount, setAmount] = useState(settlementAmount?.toString() ?? "");
  const [fee, setFee] = useState(feePercent?.toString() ?? "");

  const parsedAmount = Number(amount.replace(/[$,\s]/g, ""));
  const parsedFee = Number(fee.replace(/[%\s]/g, ""));
  const derivable =
    Number.isFinite(parsedAmount) &&
    Number.isFinite(parsedFee) &&
    amount.trim() !== "" &&
    fee.trim() !== "" &&
    parsedAmount >= 0 &&
    parsedFee >= 0;

  return (
    <form action={formAction}>
      <input type="hidden" name="claimId" value={claimId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField
          name="settlementAmount"
          label="Settlement amount"
          hint="blank if not agreed"
          error={state.fieldErrors?.settlementAmount}
        >
          <AdminInput
            name="settlementAmount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            error={state.fieldErrors?.settlementAmount}
            className="tabular-nums"
          />
        </AdminField>

        <AdminField
          name="feePercent"
          label="Fee percent"
          error={state.fieldErrors?.feePercent}
        >
          <AdminInput
            name="feePercent"
            inputMode="decimal"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
            placeholder="10"
            error={state.fieldErrors?.feePercent}
            className="tabular-nums"
          />
        </AdminField>
      </div>

      {derivable ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 border-t border-ink/9 pt-4 text-[13px] leading-[1.5]">
          <div className="flex justify-between">
            <dt className="text-ink/50">CMG fee</dt>
            <dd className="tabular-nums text-ink/85">
              {formatMoney((parsedAmount * parsedFee) / 100)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/50">To the homeowner</dt>
            <dd className="tabular-nums text-ink/85">
              {formatMoney(parsedAmount - (parsedAmount * parsedFee) / 100)}
            </dd>
          </div>
        </dl>
      ) : null}

      <AdminField name="notes" label="Notes" className="mt-4">
        <AdminTextarea
          name="notes"
          rows={3}
          defaultValue={notes ?? ""}
          placeholder="How the figure was reached, what is still outstanding."
        />
      </AdminField>

      <div className="mt-[14px]">
        <SubmitButton pendingLabel="Saving…">Save figures</SubmitButton>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
