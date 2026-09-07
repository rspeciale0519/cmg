"use client";

import { useActionState, useId, useState } from "react";
import { acceptIntake, rejectIntake } from "@/lib/actions/intake-queue";
import { idleState, resilient } from "@/lib/actions/types";
import { cx } from "@/lib/cx";
import type { AdjusterOption, PartnerOption } from "@/lib/claims/queries";
/* `intake-options`, not `@/lib/validators/intake` — that module builds the zod
   schema, and a client component importing from it ships zod to the browser. */
import {
  CARRIER_TENURE_OPTIONS,
  LOR_CONTRACT_TYPE_OPTIONS,
} from "@/lib/validators/intake-options";
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
  needsPolicyDetails,
  canAccept,
  canLinkPartner,
}: {
  claimId: string;
  claimRef: string;
  adjusters: AdjusterOption[];
  partners: PartnerOption[];
  referrerName: string | null;
  /** A partner referral arrives with no carrier, policy number or tenure — §6
   *  has staff take them from the homeowner at this moment. */
  needsPolicyDetails: boolean;
  canAccept: boolean;
  canLinkPartner: boolean;
}) {
  const [open, setOpen] = useState<"accept" | "reject" | null>(null);

  if (!canAccept) {
    return (
      <p className="border-t border-ink/9 px-[clamp(14px,1.6vw,20px)] py-[13px] text-[12.5px] leading-[1.6] text-ink/55">
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
          needsPolicyDetails={needsPolicyDetails}
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
  needsPolicyDetails,
  canLinkPartner,
}: {
  claimId: string;
  adjusters: AdjusterOption[];
  partners: PartnerOption[];
  referrerName: string | null;
  needsPolicyDetails: boolean;
  canLinkPartner: boolean;
}) {
  const [state, formAction] = useActionState(resilient(acceptIntake), idleState);

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
      noValidate
      className="border-t border-ink/9 bg-canvas/40 px-[clamp(14px,1.6vw,20px)] py-[16px]"
    >
      <input type="hidden" name="claimId" value={claimId} />
      {/* The submitted value, mirrored out of client state — the radios below
          carry `partnerChoiceUi`, which nothing reads. React 19 clears a
          controlled radio's `.checked` on the post-action reset without
          re-rendering, so after the routine refusal "Pick the referring
          company." the chip still read "Existing", the company select was still
          on screen holding its choice, and `partnerChoice` was absent from the
          next submission — which `intake-queue.ts` reads as "none". The intake
          would have been accepted, successfully and silently, with no referring
          partner attached to the claim. */}
      <input type="hidden" name="partnerChoice" value={choice} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField
          name="adjusterId"
          label="Assign to"
          error={state.fieldErrors?.adjusterId}
        >
          <AdminSelect
            name="adjusterId"
            required
            defaultValue={state.values?.adjusterId ?? ""}
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
            <legend className="mb-[5px] text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/55">
              Referring company
            </legend>
            {/* Chips, like the workspace's other two radio groups — the status
                advance and the event composer's audience. This was the one bare
                native group left: a 13px control in a 19.5px label, 4.5px under
                the 24px target floor and 11px under it for the dot itself, on
                the form that decides whether a claim carries a referral. The
                input stays in the DOM as `sr-only` so it is still a real radio
                for the keyboard and for the form. */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["none", "None"],
                  ["existing", "Existing"],
                  ["new", "Create"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={cx(
                    "inline-flex cursor-pointer items-center rounded-md border px-[12px] py-[7px] text-[13px] leading-[1.4] transition-colors duration-150",
                    "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
                    choice === value
                      ? "border-accent bg-accent/16 text-accent"
                      : "border-ink/16 text-ink/78 hover:border-accent/55 hover:text-ink",
                  )}
                >
                  <input
                    type="radio"
                    name="partnerChoiceUi"
                    value={value}
                    checked={choice === value}
                    onChange={() => setChoice(value)}
                    className="sr-only"
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
                  defaultValue={state.values?.partnerCompanyId ?? ""}
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
                  defaultValue={state.values?.newPartnerName ?? referrerName ?? ""}
                  placeholder="Company name"
                  error={state.fieldErrors?.newPartnerName}
                />
              ) : null}
            </div>
          </fieldset>
        ) : (
          <p className="self-end text-[12px] leading-[1.55] text-ink/55">
            Attributing a claim to a referring company is the owner&rsquo;s to set.
          </p>
        )}
      </div>

      {/* Only for a referral. A submission from /file-a-claim already carries
          all three, and re-asking for them here would invite an operator to
          overwrite what the homeowner typed with what they remember of a phone
          call. The condition is the claim's own `carrier`, read on the server —
          the accept action re-derives it from the row rather than trusting these
          fields to be present, because a form field is a thing a client can
          omit. */}
      {needsPolicyDetails ? (
        <fieldset className="mt-4 min-w-0 border border-accent/28 bg-accent/5 p-[13px]">
          <legend className="px-[6px] text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-accent">
            Policy — taken on this call
          </legend>
          <p className="mb-[10px] text-[12px] leading-[1.6] text-ink/62">
            This came in as a partner referral, so the referring rep was not asked
            for the policy. Take these from the homeowner before you accept.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminField
              name="carrier"
              label="Carrier"
              error={state.fieldErrors?.carrier}
            >
              <AdminInput
                name="carrier"
                required
                maxLength={120}
                defaultValue={state.values?.carrier ?? ""}
                error={state.fieldErrors?.carrier}
                placeholder="Insurance company"
              />
            </AdminField>

            <AdminField
              name="policyNumber"
              label="Policy number"
              error={state.fieldErrors?.policyNumber}
            >
              <AdminInput
                name="policyNumber"
                required
                maxLength={80}
                defaultValue={state.values?.policyNumber ?? ""}
                error={state.fieldErrors?.policyNumber}
              />
            </AdminField>

            <AdminField
              name="carrierTenure"
              label="With this carrier"
              error={state.fieldErrors?.carrierTenure}
            >
              <AdminSelect
                name="carrierTenure"
                required
                defaultValue={state.values?.carrierTenure ?? ""}
                error={state.fieldErrors?.carrierTenure}
              >
                <option value="" disabled>
                  How long…
                </option>
                {CARRIER_TENURE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>

            <AdminField
              name="lorContractType"
              label="Agreement type"
              error={state.fieldErrors?.lorContractType}
            >
              <AdminSelect
                name="lorContractType"
                required
                defaultValue={state.values?.lorContractType ?? ""}
                error={state.fieldErrors?.lorContractType}
              >
                <option value="" disabled>
                  Choose type…
                </option>
                {LOR_CONTRACT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
          </div>
        </fieldset>
      ) : null}

      <AdminField
        name="note"
        label="Note"
        hint="optional — goes to the homeowner"
        className="mt-4"
      >
        <AdminTextarea
          name="note"
          rows={2}
          defaultValue={state.values?.note ?? ""}
          placeholder="Anything the homeowner should read alongside the update."
        />
      </AdminField>

      <p className="mt-[12px] text-[12px] leading-[1.6] text-ink/55">
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
  const [state, formAction] = useActionState(resilient(rejectIntake), idleState);

  return (
    <form
      action={formAction}
      noValidate
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
          defaultValue={state.values?.reason ?? ""}
          error={state.fieldErrors?.reason}
          placeholder="Outside our service area · loss predates the policy · already represented"
        />
      </AdminField>

      <p className="mt-[12px] text-[12px] leading-[1.6] text-ink/55">
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
