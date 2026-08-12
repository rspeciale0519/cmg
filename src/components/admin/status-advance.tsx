"use client";

import { useActionState, useState } from "react";
import { advanceClaimStatus } from "@/lib/actions/claims";
import { idleState, resilient } from "@/lib/actions/types";
import { STATUS_LABEL, STATUS_MEANING, type ClaimStatus } from "@/lib/claims/status";
import type { TransitionBlock } from "@/lib/claims/transitions";
import { cx } from "@/lib/cx";
import { ActionFeedback, AdminField, AdminTextarea, SubmitButton } from "./form-controls";

/**
 * The signature control of this workspace, and the reason the status machine
 * lives in one place.
 *
 * `allowed` arrives from `public.allowed_claim_transitions()` — the same
 * function the BEFORE UPDATE trigger consults — so the options here cannot
 * drift from what the database will accept. There is no second transition map
 * in TypeScript to fall out of step with it. A claim at `settled` offers
 * exactly one move because Postgres says so, and a claim at `closed` offers
 * none and says why.
 *
 * A move that is legal by the machine but blocked by a condition it cannot
 * express — §5's requirement that a signed LOR exist on the file — is rendered
 * and disabled *with its reason*, never hidden. Hiding it teaches an adjuster
 * nothing; "upload the signed letter first" is precisely what they need told.
 * The disabled attribute is a courtesy either way: the action re-asks the same
 * function and re-checks the same document, and the trigger refuses underneath
 * both.
 */
export function StatusAdvance({
  claimId,
  current,
  allowed,
  blocked,
  canManage,
}: {
  claimId: string;
  current: ClaimStatus;
  allowed: ClaimStatus[];
  blocked: TransitionBlock[];
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(resilient(advanceClaimStatus), idleState);
  const [selected, setSelected] = useState<ClaimStatus | null>(null);

  const blockedFor = (status: ClaimStatus) =>
    blocked.find((entry) => entry.to === status)?.reason ?? null;

  /**
   * The selection, but only while it is still a move this claim can make.
   *
   * `selected` is client state and the options around it are server state. A
   * successful transition revalidates and `allowed` arrives new — a claim that
   * offered `settled` and `denied` now offers `closed` alone — while `selected`
   * still holds `settled`. Read directly, that stale value drove the label
   * ("Move to settled"), the meaning blurb, and `disabled`, which went false
   * over a radio group where nothing was checked. The button therefore offered a
   * move the claim no longer had, and submitting it sent no `to` at all: the
   * action answered "That is not a claim status." — an error naming a value the
   * operator never entered, about a step the screen had just invited.
   *
   * Derived rather than reset in an effect, because the same staleness has a
   * second cause with no event to hang an effect on: a colleague advancing the
   * claim, or uploading the LOR that lifts a block, changes `allowed` and
   * `blocked` under a selection this component never touched. One rule covers
   * both — a selection counts while the server still offers it, and stops
   * counting the moment it does not.
   */
  const activeSelection =
    selected !== null && allowed.includes(selected) && blockedFor(selected) === null
      ? selected
      : null;

  if (!canManage) {
    return (
      <p className="text-[13px] leading-[1.65] text-ink/55">
        This claim is at <strong className="font-medium text-ink/85">{STATUS_LABEL[current]}</strong>.{" "}
        {STATUS_MEANING[current]}
        <span className="mt-[9px] block text-ink/55">
          Moving a claim through the pipeline is done by the owner and by the
          adjuster it is assigned to.
        </span>
      </p>
    );
  }

  if (allowed.length === 0) {
    return (
      <p className="text-[13px] leading-[1.65] text-ink/55">
        This claim is at <strong className="font-medium text-ink/85">{STATUS_LABEL[current]}</strong>.{" "}
        {STATUS_MEANING[current]} There is no next step — the file is finished.
      </p>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="claimId" value={claimId} />

      <p className="text-[13px] leading-[1.65] text-ink/60">
        {STATUS_MEANING[current]}
      </p>

      <fieldset className="mt-[15px]">
        <legend className="mb-[9px] text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/55">
          Move to
        </legend>

        <div className="flex flex-wrap gap-2">
          {allowed.map((status) => {
            const reason = blockedFor(status);
            const disabled = reason !== null;
            const isSelected = activeSelection === status;

            return (
              <label
                key={status}
                className={cx(
                  "inline-flex cursor-pointer items-center rounded-md border px-[12px] py-[7px] text-[13px] leading-[1.4] transition-colors duration-150",
                  "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
                  disabled
                    ? "cursor-not-allowed border-ink/10 text-ink/28"
                    : isSelected
                      ? "border-accent bg-accent/16 text-accent"
                      : "border-ink/16 text-ink/78 hover:border-accent/55 hover:text-ink",
                )}
              >
                <input
                  type="radio"
                  name="to"
                  value={status}
                  disabled={disabled}
                  checked={isSelected}
                  onChange={() => setSelected(status)}
                  className="sr-only"
                />
                {STATUS_LABEL[status]}
              </label>
            );
          })}
        </div>

        {blocked.map((entry) => (
          <p
            key={entry.to}
            className="mt-[11px] border-l-2 border-ink/16 py-[2px] pl-[10px] text-[12.5px] leading-[1.6] text-ink/58"
          >
            <strong className="font-medium text-ink/72">
              {STATUS_LABEL[entry.to]}
            </strong>{" "}
            is not available yet. {entry.reason}
          </p>
        ))}
      </fieldset>

      {activeSelection ? (
        <p className="mt-[14px] border-l-2 border-accent/50 py-[2px] pl-[10px] text-[12.5px] leading-[1.6] text-ink/60">
          {STATUS_MEANING[activeSelection]}
        </p>
      ) : null}

      <AdminField
        name="note"
        label="Note"
        hint="optional — the homeowner reads this"
        className="mt-[15px] max-w-[70ch]"
      >
        {/* The radio group above is client state and survives the post-action
            reset on its own. This is not, so a refused move used to discard the
            sentence the adjuster had just written for the homeowner. */}
        <AdminTextarea
          name="note"
          rows={2}
          defaultValue={state.values?.note ?? ""}
          placeholder="What changed, in a sentence."
        />
      </AdminField>

      <div className="mt-[14px]">
        <SubmitButton disabled={activeSelection === null} pendingLabel="Moving…">
          {activeSelection
            ? `Move to ${STATUS_LABEL[activeSelection].toLowerCase()}`
            : "Move claim"}
        </SubmitButton>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
