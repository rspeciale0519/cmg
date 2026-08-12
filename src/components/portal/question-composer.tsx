"use client";

import { useActionState } from "react";
import { TextAreaField } from "@/components/forms/controls";
import { askQuestion } from "@/lib/actions/portal";
import { idleState } from "@/lib/actions/types";
import { QUESTION_MAX_LENGTH } from "@/lib/validators/portal";
import { FormFeedback, SubmitButton } from "./form-controls";

/**
 * Ask the adjuster something.
 *
 * `noValidate` is not a detail. Without it Chrome answers an empty textarea with
 * its own bubble at the first invalid field and never submits, so the designed
 * inline error — the ember border, the message under the box, the
 * `aria-describedby` that points at it — is never reached, and the two forms on
 * this page would refuse in two different visual languages.
 *
 * `defaultValue={state.values?.body ?? ""}` is the other half of a refusal.
 * React 19 resets a form when its action *resolves*, not when it succeeds: a
 * question refused by the rate limiter came back to an empty box under a message
 * about waiting a few minutes, which asks a person to retype four paragraphs
 * about their roof. The action echoes the submitted string on every refusal and
 * omits it on success, so a refusal keeps the text and a sent question clears
 * the box.
 */
export function QuestionComposer({ claimId }: { claimId: string }) {
  const [state, formAction] = useActionState(askQuestion, idleState);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="claimId" value={claimId} />

      <TextAreaField
        name="body"
        label="Your question"
        size="sm"
        required
        maxLength={QUESTION_MAX_LENGTH}
        defaultValue={state.values?.body ?? ""}
        error={state.fieldErrors?.body}
        placeholder="Ask us anything about your claim — what a letter means, when someone is coming, what we need from you."
        hint="Your adjuster answers here, and we email you when they do."
      />

      <div className="mt-[16px]">
        <SubmitButton pendingLabel="Sending…">Send question</SubmitButton>
      </div>

      <FormFeedback state={state} />
    </form>
  );
}
