"use client";

import { useActionState, useState } from "react";
import { postClaimEvent } from "@/lib/actions/claims";
import { idleState } from "@/lib/actions/types";
import { cx } from "@/lib/cx";
import { ActionFeedback, AdminTextarea, SubmitButton } from "./form-controls";

type Visibility = "internal" | "customer" | "partner" | "shared";

const AUDIENCE: { value: Visibility; label: string; caption: string }[] = [
  { value: "internal", label: "CMG only", caption: "Nobody outside the firm sees this." },
  { value: "customer", label: "Homeowner", caption: "The homeowner reads this in their portal." },
  { value: "partner", label: "Partner", caption: "The referring contractor reads this." },
  {
    value: "shared",
    label: "Homeowner + partner",
    caption: "Both the homeowner and the referring contractor read this.",
  },
];

/**
 * Audience is chosen before the text is written, and the choice is always
 * visible while typing. The opposite arrangement — write, then pick who sees it
 * — is how an internal note about a carrier's tactics gets posted to the
 * homeowner, and there is no unsend.
 *
 * `internal` is the default for a note and `customer` for a reply, because a
 * reply exists in response to a question somebody asked and answering it
 * privately answers nobody.
 */
export function EventComposer({
  claimId,
  canPostShared,
  replyTo,
}: {
  claimId: string;
  canPostShared: boolean;
  replyTo?: { id: string; body: string } | null;
}) {
  const [state, formAction] = useActionState(postClaimEvent, idleState);
  const [visibility, setVisibility] = useState<Visibility>(
    replyTo ? "customer" : "internal",
  );

  const options = AUDIENCE.filter(
    (option) =>
      canPostShared || (option.value !== "partner" && option.value !== "shared"),
  );
  const active = AUDIENCE.find((option) => option.value === visibility);

  return (
    <form action={formAction}>
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="isReply" value={replyTo ? "true" : "false"} />

      {replyTo ? (
        <p className="mb-[11px] border-l-2 border-accent/45 py-[2px] pl-[10px] text-[12.5px] leading-[1.6] text-ink/55">
          Replying to: <span className="text-ink/72">{replyTo.body}</span>
        </p>
      ) : null}

      <fieldset>
        <legend className="mb-[8px] text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/45">
          Who sees this
        </legend>
        <div className="flex flex-wrap gap-[6px]">
          {options.map((option) => {
            const selected = visibility === option.value;
            return (
              <label
                key={option.value}
                className={cx(
                  "inline-flex cursor-pointer items-center rounded-md border px-[10px] py-[6px] text-[12.5px] leading-[1.4] transition-colors duration-150",
                  "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
                  selected
                    ? option.value === "internal"
                      ? "border-ink/32 bg-ink/10 text-ink"
                      : "border-accent bg-accent/16 text-accent"
                    : "border-ink/14 text-ink/58 hover:border-ink/30 hover:text-ink/85",
                )}
              >
                <input
                  type="radio"
                  name="visibilityChoice"
                  value={option.value}
                  checked={selected}
                  onChange={() => setVisibility(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
        {active ? (
          <p
            className={cx(
              "mt-[8px] text-[12px] leading-[1.5]",
              visibility === "internal" ? "text-ink/40" : "text-accent/72",
            )}
          >
            {active.caption}
          </p>
        ) : null}
      </fieldset>

      <div className="mt-[13px]">
        <label htmlFor="admin-body" className="sr-only">
          Entry
        </label>
        <AdminTextarea
          name="body"
          rows={3}
          required
          maxLength={4000}
          placeholder={
            replyTo
              ? "Answer the question in plain terms."
              : "What happened, what you did, what comes next."
          }
        />
      </div>

      <div className="mt-[13px]">
        <SubmitButton pendingLabel="Posting…">
          {replyTo ? "Post reply" : "Post entry"}
        </SubmitButton>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
