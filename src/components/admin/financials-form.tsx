"use client";

import { useActionState, useState } from "react";
import { saveClaimFinancials } from "@/lib/actions/claims";
import { idleState, resilient } from "@/lib/actions/types";
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
  feeDefault,
  notes,
}: {
  claimId: string;
  settlementAmount: number | null;
  feePercent: number | null;
  feeDefault: number;
  notes: string | null;
}) {
  const [state, formAction] = useActionState(resilient(saveClaimFinancials), idleState);
  const [amount, setAmount] = useState(settlementAmount?.toString() ?? "");
  const [fee, setFee] = useState((feePercent ?? feeDefault).toString());

  const parsedAmount = Number(amount.replace(/[$,\s]/g, ""));
  const parsedFee = Number(fee.replace(/[%\s]/g, ""));

  const bothEntered = amount.trim() !== "" && fee.trim() !== "";
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount >= 0;
  /* The upper bound is `claim_financials_fee_percent_range` and the server
     action's own message ("Enter a percentage between 0 and 100"), and it has
     to be checked here too. Without it, typing 250 produced a correctly
     flagged field *and* a live row reading "CMG fee $103,125 / To the
     homeowner -$61,875" — arithmetic on a number the product had just refused,
     rendered in the same weight as a real figure, next to a homeowner. */
  const feeValid = Number.isFinite(parsedFee) && parsedFee >= 0 && parsedFee <= 100;

  /* One flag per figure, covering both ways a figure can be unusable: this
     component's own check, and the server having just refused it. They are
     separate because the server knows bounds this component does not — the
     `numeric(12, 2)` ceiling, for one — so a value can pass here and still come
     back flagged.

     Per-figure rather than the single `rejected` boolean these replaced,
     because that boolean was only ever asked "did anything fail", and the
     sentence below has to say *what*. With an unparseable amount AND an
     out-of-range fee, both fields were correctly marked and the note under the
     em-dashes named the fee alone — the ternary it was built on had no branch
     that could mention the amount while the fee was also wrong. Fixing the fee
     then revealed a second explanation about the amount, in a line whose whole
     job is to say why the split is not there. */
  const amountBlocks = !amountValid || Boolean(state.fieldErrors?.settlementAmount);
  const feeBlocks = !feeValid || Boolean(state.fieldErrors?.feePercent);

  const derivable = bothEntered && !amountBlocks && !feeBlocks;
  /* Neutralised rather than removed. The row vanishing on the keystroke that
     makes the input invalid moves the Notes field and the Save button up under
     the cursor, and says nothing about why. Holding the row with em-dashes
     keeps the layout still and lets the reason sit where the figures were. */
  const showDerived = bothEntered || derivable;

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

      {showDerived ? (
        <div className="mt-4 border-t border-ink/9 pt-4">
          <dl
            aria-live="polite"
            className="grid grid-cols-2 gap-x-8 gap-y-2 text-[13px] leading-[1.5]"
          >
            <div className="flex justify-between">
              <dt className="text-ink/58">CMG fee</dt>
              <dd
                className={
                  derivable ? "tabular-nums text-ink/85" : "tabular-nums text-ink/28"
                }
              >
                {derivable ? formatMoney((parsedAmount * parsedFee) / 100) : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/58">To the homeowner</dt>
              <dd
                className={
                  derivable ? "tabular-nums text-ink/85" : "tabular-nums text-ink/28"
                }
              >
                {derivable
                  ? formatMoney(parsedAmount - (parsedAmount * parsedFee) / 100)
                  : "—"}
              </dd>
            </div>
          </dl>

          {derivable ? null : (
            /* `ink/60` — 5.26:1, matching the field error above it, up from
               `ink/42` at 3.35:1. This line was the dimmest text in the error
               state and it is the line that explains it: the field says the fee
               is wrong and the form says the save was refused, while this is
               the only thing on screen that says why both derived figures went
               to an em-dash. An explanation cannot be quieter than the thing it
               explains. */
            <p className="mt-[7px] text-[12px] leading-[1.5] text-ink/60">
              {amountBlocks && feeBlocks
                ? "The split appears once the amount is 0 or more and the fee is a percentage between 0 and 100."
                : amountBlocks
                  ? "The split appears once the settlement amount is 0 or more."
                  : "The split appears once the fee is a percentage between 0 and 100."}
            </p>
          )}
        </div>
      ) : null}

      {/* The two figures above are controlled and hold their own value across a
          refusal. This one is uncontrolled, so React's post-action reset used to
          empty it — a rejected fee percentage also erased the paragraph
          explaining how the settlement figure had been reached. */}
      <AdminField name="notes" label="Notes" className="mt-4">
        <AdminTextarea
          name="notes"
          rows={3}
          defaultValue={state.values?.notes ?? notes ?? ""}
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
