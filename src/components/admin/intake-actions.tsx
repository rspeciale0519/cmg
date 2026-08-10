"use client";

import { useActionState, useId, useState } from "react";
import { acceptIntake, rejectIntake } from "@/lib/actions/intake-queue";
import { idleState } from "@/lib/actions/types";
import { cx } from "@/lib/cx";
import type { AdjusterOption, PartnerOption } from "@/lib/claims/queries";
import {
  ActionFeedback,
  AdminField,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  SubmitButton,
} from "./form-controls";

type PartnerChoice = "none" | "existing" | "new";

/**
 * Accept and decline sit side by side and open in place. A modal would be the
 * conventional answer and is the wrong one here: triage is a comparison —
 * "does this loss date sit inside the policy period, is this address one we
 * already have" — and a dialog covers the very facts the decision is made
 * against. Opening inline keeps the intake's own detail on screen while the
 * form is filled in.
 *
 * Only one of the two panels is open at a time. They are opposite decisions on
 * the same file, and a UI that lets both stand open invites filling in the
 * wrong one.
 */
export function IntakeActions({
  claimId,
  claimRef,
  adjusters,
  partners,
  referrerName,
  canAccept,
  canLinkPartner,
}: {
  claimId: string;
  claimRef: string;
  adjusters: AdjusterOption[];
  partners: PartnerOption[];
  referrerName: string | null;
  canAccept: boolean;
  canLinkPartner: boolean;
}) {
  const [open, setOpen] = useState<"accept" | "reject" | null>(null);

  if (!canAccept) {
    return (
      <p className="border-t border-ink/9 px-[clamp(14px,1.6vw,20px)] py-[13px] text-[12.5px] leading-[1.6] text-ink/45">
        Accepting or declining an intake assigns it and moves it, which the owner
        does. Nothing here is yours to action yet — once {claimRef} is accepted and
        assigned, it appears in Claims.
      </p>
    );
  }

  return (
    <div className="border-t border-ink/9">
      <div className="flex flex-wrap gap-2 px-[clamp(14px,1.6vw,20px)] py-[13px]">
        <button
          type="button"
          onClick={() => setOpen(open === "accept" ? null : "accept")}
          aria-expanded={open === "accept"}
          className={cx(
            "inline-flex min-h-[34px] items-center rounded-md border px-[13px] text-[13px] font-medium leading-[1.4] transition-colors duration-150",
            open === "accept"
              ? "border-accent bg-accent/16 text-accent"
              : "border-accent text-accent hover:bg-accent/12",
          )}
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "reject" ? null : "reject")}
          aria-expanded={open === "reject"}
          className={cx(
            "inline-flex min-h-[34px] items-center rounded-md border px-[13px] text-[13px] font-medium leading-[1.4] transition-colors duration-150",
            open === "reject"
              ? "border-[#E08C6A]/70 bg-[#E08C6A]/14 text-[#E8A98D]"
              : "border-ink/16 text-ink/72 hover:border-[#E08C6A]/55 hover:text-[#E8A98D]",
          )}
        >
          Decline
        </button>
      </div>

      {open === "accept" ? (
        <AcceptForm
          claimId={claimId}
          adjusters={adjusters}
          partners={partners}
          referrerName={referrerName}
          canLinkPartner={canLinkPartner}
        />
      ) : null}

      {open === "reject" ? <RejectForm claimId={claimId} /> : null}
    </div>
  );
}

function AcceptForm({
  claimId,
  adjusters,
  partners,
  referrerName,
  canLinkPartner,
}: {
  claimId: string;
  adjusters: AdjusterOption[];
  partners: PartnerOption[];
  referrerName: string | null;
  canLinkPartner: boolean;
}) {
  const [state, formAction] = useActionState(acceptIntake, idleState);

  // Pre-selected from the intake's own referral fields: if the submission named
  // a referring contractor, the operator is almost always about to link one, and
  // the default that saves a click is the one the data already implies.
  const [choice, setChoice] = useState<PartnerChoice>(
    referrerName && canLinkPartner ? "new" : "none",
  );
  const groupName = useId();

  return (
    <form
      action={formAction}
      className="border-t border-ink/9 bg-canvas/40 px-[clamp(14px,1.6vw,20px)] py-[16px]"
    >
      <input type="hidden" name="claimId" value={claimId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField
          name="adjusterId"
          label="Assign to"
          error={state.fieldErrors?.adjusterId}
        >
          <AdminSelect
            name="adjusterId"
            required
            defaultValue=""
            error={state.fieldErrors?.adjusterId}
          >
            <option value="" disabled>
              Choose an adjuster…
            </option>
            {adjusters.map((adjuster) => (
              <option key={adjuster.id} value={adjuster.id}>
                {adjuster.name}
              </option>
            ))}
          </AdminSelect>
        </AdminField>

        {canLinkPartner ? (
          <fieldset className="min-w-0">
            <legend className="mb-[5px] text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/45">
              Referring company
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(
                [
                  ["none", "None"],
                  ["existing", "Existing"],
                  ["new", "Create"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-[6px] text-[13px] leading-[1.5] text-ink/78"
                >
                  <input
                    type="radio"
                    name="partnerChoice"
                    value={value}
                    checked={choice === value}
                    onChange={() => setChoice(value)}
                    className="size-[13px] accent-[#d4b36a]"
                    aria-controls={groupName}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div id={groupName} className="mt-[8px]">
              {choice === "existing" ? (
                <AdminSelect
                  name="partnerCompanyId"
                  defaultValue=""
                  error={state.fieldErrors?.partnerCompanyId}
                >
                  <option value="" disabled>
                    Choose a company…
                  </option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </AdminSelect>
              ) : null}

              {choice === "new" ? (
                <AdminInput
                  name="newPartnerName"
                  defaultValue={referrerName ?? ""}
                  placeholder="Company name"
                  error={state.fieldErrors?.newPartnerName}
                />
              ) : null}
            </div>
          </fieldset>
        ) : (
          <p className="self-end text-[12px] leading-[1.55] text-ink/42">
            Attributing a claim to a referring company is the owner&rsquo;s to set.
          </p>
        )}
      </div>

      <AdminField
        name="note"
        label="Note"
        hint="optional — goes to the homeowner"
        className="mt-4"
      >
        <AdminTextarea
          name="note"
          rows={2}
          placeholder="Anything the homeowner should read alongside the update."
        />
      </AdminField>

      <p className="mt-[12px] text-[12px] leading-[1.6] text-ink/45">
        Accepting assigns the adjuster, moves the claim to under review, and emails
        a portal invitation to every claimant on the file.
      </p>

      <div className="mt-[13px]">
        <SubmitButton pendingLabel="Accepting…">Accept intake</SubmitButton>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}

function RejectForm({ claimId }: { claimId: string }) {
  const [state, formAction] = useActionState(rejectIntake, idleState);

  return (
    <form
      action={formAction}
      className="border-t border-ink/9 bg-canvas/40 px-[clamp(14px,1.6vw,20px)] py-[16px]"
    >
      <input type="hidden" name="claimId" value={claimId} />

      <AdminField
        name="reason"
        label="Why is CMG declining this?"
        error={state.fieldErrors?.reason}
      >
        <AdminTextarea
          name="reason"
          rows={2}
          required
          error={state.fieldErrors?.reason}
          placeholder="Outside our service area · loss predates the policy · already represented"
        />
      </AdminField>

      <p className="mt-[12px] text-[12px] leading-[1.6] text-ink/45">
        The claim is archived with the reason on its record. No portal invitation is
        ever sent, and the homeowner receives no email from this action.
      </p>

      <div className="mt-[13px]">
        <SubmitButton variant="danger" pendingLabel="Declining…">
          Decline intake
        </SubmitButton>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
