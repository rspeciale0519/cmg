"use client";

import { useActionState } from "react";
import { withdrawConsent } from "@/lib/actions/portal";
import { idleState } from "@/lib/actions/types";
import { FormFeedback, SubmitButton } from "./form-controls";

/**
 * Withdraw one permission.
 *
 * A form per consent rather than one form with a picker, because each row is a
 * separate record with its own text and its own date, and a single control
 * acting on "whichever one is selected" is how a person withdraws the wrong one.
 * The button carries the record's id in a hidden field; nothing else about the
 * row is submitted, because nothing else about the row may change —
 * `public.guard_consent_immutable()` raises on any edit to the consent text, the
 * email, the phone, the kind or the grant time for every caller holding a
 * session.
 */
export function WithdrawConsent({
  consentId,
  kind,
}: {
  consentId: string;
  kind: "sms" | "email";
}) {
  const [state, formAction] = useActionState(withdrawConsent, idleState);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="consentId" value={consentId} />
        <SubmitButton variant="secondary" pendingLabel="Withdrawing…">
          Withdraw
          <span className="sr-only">
            {kind === "sms" ? " text message consent" : " email consent"}
          </span>
        </SubmitButton>
      </form>

      <FormFeedback state={state} className="max-w-[46ch]" />
    </div>
  );
}
