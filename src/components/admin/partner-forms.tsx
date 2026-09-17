"use client";

import { useActionState, useState } from "react";
import {
  createPartnerCompany,
  deletePartnerCompany,
  invitePartnerRep,
  setPartnerCompanyStatus,
  updatePartnerCompany,
} from "@/lib/actions/partners";
import { idleInviteIssueState, idleState, resilient } from "@/lib/actions/types";
import {
  ActionFeedback,
  AdminField,
  AdminInput,
  AdminTextarea,
  SubmitButton,
} from "./form-controls";

type CompanyValues = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  defaultFeePercent: string;
  notes: string;
};

const EMPTY: CompanyValues = {
  name: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  defaultFeePercent: "",
  notes: "",
};

/**
 * One form for both adding and editing. The fields, their order and their
 * validation are identical, and two components would be two places for the
 * hint text under "Contact email" to drift.
 *
 * Only the name is required. The rest is what the owner happens to know when a
 * contractor first sends work, and a form that demands a contact email before a
 * company can exist is a form that gets a placeholder typed into it.
 *
 * Every field is uncontrolled and seeded from the server. React 19 resets a form
 * driven by a Server Action once that action resolves, which for uncontrolled
 * fields returns them to their `defaultValue` — so the caller keys this
 * component on the record's `updatedAt`, and a successful save re-seeds it with
 * the values that were actually stored rather than snapping back to whatever was
 * on screen when the page first rendered.
 *
 * That reset fires on a REFUSAL too, which the paragraph above never accounted
 * for. `state.values` is what closes it: the action hands the submitted strings
 * back, they become the defaults, and the reset lands on them. On the create
 * form the reset used to empty all five fields under a message telling the
 * owner to check the highlighted one; on the edit form it was worse than loss,
 * because the defaults are the *stored* values — the flagged Email field came
 * back holding a perfectly valid address while still wearing the invalid
 * border, and any other edits made in the same pass were gone.
 *
 * `noValidate` for the reason the public forms carry it: `name` is `required`
 * and `contactEmail` is `type="email"`, so Chrome would otherwise answer an
 * empty submit with an orange popup in its own UI font, sitting over the two
 * fields below, and stop at the first offender — the server never runs, no
 * field is marked, and flagging several at once is unreachable. Validation
 * belongs to the schema that also guards the database.
 */
export function PartnerCompanyForm({
  companyId,
  initial = EMPTY,
}: {
  companyId?: string;
  initial?: CompanyValues;
}) {
  const [state, formAction] = useActionState(
    resilient(companyId ? updatePartnerCompany : createPartnerCompany),
    idleState,
  );

  return (
    <form action={formAction} noValidate className="max-w-[720px]">
      {companyId ? <input type="hidden" name="companyId" value={companyId} /> : null}

      <div className="grid gap-x-6 gap-y-[15px] sm:grid-cols-2">
        <AdminField
          name="name"
          label="Company"
          error={state.fieldErrors?.name}
          className="sm:col-span-2"
        >
          <AdminInput
            name="name"
            defaultValue={state.values?.name ?? initial.name}
            required
            maxLength={120}
            autoComplete="organization"
            placeholder="Summit Exteriors LLC"
            error={state.fieldErrors?.name}
          />
        </AdminField>

        <AdminField
          name="contactName"
          label="Main contact"
          hint="optional"
          error={state.fieldErrors?.contactName}
        >
          <AdminInput
            name="contactName"
            defaultValue={state.values?.contactName ?? initial.contactName}
            maxLength={120}
            autoComplete="off"
            error={state.fieldErrors?.contactName}
          />
        </AdminField>

        <AdminField
          name="contactPhone"
          label="Phone"
          hint="optional"
          error={state.fieldErrors?.contactPhone}
        >
          <AdminInput
            name="contactPhone"
            type="tel"
            defaultValue={state.values?.contactPhone ?? initial.contactPhone}
            maxLength={40}
            autoComplete="off"
            error={state.fieldErrors?.contactPhone}
          />
        </AdminField>

        <AdminField
          name="contactEmail"
          label="Email"
          hint="optional"
          error={state.fieldErrors?.contactEmail}
          className="sm:col-span-2"
        >
          <AdminInput
            name="contactEmail"
            type="email"
            defaultValue={state.values?.contactEmail ?? initial.contactEmail}
            maxLength={254}
            autoComplete="off"
            error={state.fieldErrors?.contactEmail}
          />
        </AdminField>

        {/* Blank is the normal answer and the hint says what blank means, so an
            owner who has not negotiated a rate is not pushed into typing the
            standard one — a stored 20 would read as a decision about this
            company rather than as the absence of one, and it would then stay 20
            through any future change to CMG's standard fee. Text rather than
            `type="number"`, for the reason `noValidate` is on the form: the
            schema owns the shape, and a browser spinner on a percentage invites
            a scroll wheel to change a money term by accident. */}
        <AdminField
          name="defaultFeePercent"
          label="Vendor fee"
          hint="optional — blank uses CMG's standard fee"
          error={state.fieldErrors?.defaultFeePercent}
          className="sm:col-span-2"
        >
          <AdminInput
            name="defaultFeePercent"
            inputMode="decimal"
            defaultValue={state.values?.defaultFeePercent ?? initial.defaultFeePercent}
            maxLength={6}
            autoComplete="off"
            placeholder="15"
            error={state.fieldErrors?.defaultFeePercent}
          />
        </AdminField>

        <AdminField
          name="notes"
          label="Notes"
          hint="internal — never shown to the partner"
          error={state.fieldErrors?.notes}
          className="sm:col-span-2"
        >
          <AdminTextarea
            name="notes"
            defaultValue={state.values?.notes ?? initial.notes}
            maxLength={2000}
            rows={3}
            error={state.fieldErrors?.notes}
          />
        </AdminField>
      </div>

      <div className="mt-[15px]">
        <SubmitButton pendingLabel={companyId ? "Saving…" : "Adding…"}>
          {companyId ? "Save company" : "Add company"}
        </SubmitButton>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}

/**
 * Deactivation is the designed way to end a relationship, so it is the plain
 * button and it says what it does. The consequence is spelled out at the point
 * of the control rather than in a confirmation dialog afterwards: reps lose the
 * portal, referred claims keep the attribution.
 */
export function PartnerStatusForm({
  companyId,
  status,
}: {
  companyId: string;
  status: "active" | "inactive";
}) {
  const [state, formAction] = useActionState(resilient(setPartnerCompanyStatus), idleState);
  const next = status === "active" ? "inactive" : "active";

  return (
    <form action={formAction}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="status" value={next} />
      <SubmitButton
        variant="secondary"
        pendingLabel={next === "inactive" ? "Deactivating…" : "Reactivating…"}
      >
        {next === "inactive" ? "Deactivate company" : "Reactivate company"}
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}

/**
 * Delete is behind a typed confirmation because it is the one irreversible
 * control on the surface, and because the mistake it guards against is a person
 * reaching for it when they meant "deactivate". Typing the company's own name is
 * the check that cannot be satisfied by muscle memory.
 *
 * The refusal from `guard_partner_company_delete()` arrives through
 * `ActionFeedback` verbatim — it names the company, counts the reps in the way,
 * and points at deactivation.
 */
export function PartnerDeleteForm({
  companyId,
  companyName,
  repCount,
}: {
  companyId: string;
  companyName: string;
  repCount: number;
}) {
  const [state, formAction] = useActionState(resilient(deletePartnerCompany), idleState);
  const [typed, setTyped] = useState("");
  const armed = typed.trim() === companyName;

  return (
    /* `onReset` because React 19 resets the form once the action resolves: the
       text field empties itself, and without this the component's own `typed`
       state would still hold the company name — leaving a primed Delete button
       above a blank confirmation box. After a refusal the owner re-types, which
       is the right amount of friction for the one irreversible control here. */
    <form
      action={formAction}
      onReset={() => setTyped("")}
      className="max-w-[440px]"
    >
      <input type="hidden" name="companyId" value={companyId} />

      <AdminField
        name="confirmName"
        label="Type the company name to confirm"
        hint={companyName}
      >
        <AdminInput
          name="confirmName"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </AdminField>

      <div className="mt-[12px]">
        <SubmitButton variant="danger" disabled={!armed} pendingLabel="Deleting…">
          Delete permanently
        </SubmitButton>
      </div>

      {repCount > 0 ? (
        <p className="mt-[10px] text-[12.5px] leading-[1.55] text-ink/55">
          {repCount === 1
            ? "One rep profile is linked to this company, so the database will refuse the delete."
            : `${repCount} rep profiles are linked to this company, so the database will refuse the delete.`}{" "}
          Deactivating ends the relationship without losing the record.
        </p>
      ) : null}

      <ActionFeedback state={state} />
    </form>
  );
}

export function PartnerRepInviteForm({ companyId }: { companyId: string }) {
  const [state, formAction] = useActionState(resilient(invitePartnerRep), idleInviteIssueState);

  return (
    <form action={formAction} noValidate className="max-w-[560px]">
      <input type="hidden" name="companyId" value={companyId} />

      <div className="grid gap-x-6 gap-y-[15px] sm:grid-cols-2">
        <AdminField name="email" label="Rep email" error={state.fieldErrors?.email}>
          <AdminInput
            name="email"
            type="email"
            defaultValue={state.values?.email ?? ""}
            required
            maxLength={254}
            autoComplete="off"
            placeholder="rep@contractor.com"
            error={state.fieldErrors?.email}
          />
        </AdminField>

        <AdminField
          name="firstName"
          label="First name"
          hint="optional"
          error={state.fieldErrors?.firstName}
        >
          <AdminInput
            name="firstName"
            defaultValue={state.values?.firstName ?? ""}
            maxLength={80}
            autoComplete="off"
            error={state.fieldErrors?.firstName}
          />
        </AdminField>
      </div>

      <div className="mt-[15px]">
        <SubmitButton pendingLabel="Sending…">Send invitation</SubmitButton>
      </div>

      <p className="mt-[10px] max-w-[62ch] text-[12.5px] leading-[1.6] text-ink/55">
        The link works once and expires after 72 hours. A rep sees the status,
        milestones and settlement figure for claims they referred — never
        documents, policy numbers or homeowner contact details.
      </p>

      <ActionFeedback state={state} />

      {state.manualLink ? (
        <p className="mt-[8px] max-w-[62ch] break-all border-l-2 border-accent py-[2px] pl-[10px] font-mono text-[11.5px] leading-[1.55] text-accent">
          {state.manualLink}
        </p>
      ) : null}
    </form>
  );
}
