"use client";

import { useActionState, useId, useState } from "react";
import { saveLawFirm, startLegalHandoff, prepareLegalPackage, recordLegalMilestone, cancelLegalPreparation } from "@/lib/actions/legal";
import { idleState, resilient } from "@/lib/actions/types";
import { LEGAL_LABEL, LEGAL_RETURN_STATUSES, LEGAL_SUMMARY_FIELDS, type LegalFirm, type LegalHandoff, type LegalPackageState } from "@/lib/legal/types";
import { allowedMilestones } from "@/lib/legal/validation";
import { STATUS_LABEL } from "@/lib/claims/status";
import { ActionFeedback, AdminField, AdminInput, AdminSelect, AdminTextarea, SubmitButton } from "./form-controls";
import { LegalPackageDownload } from "./legal-package-download";
import { retainFormInputs } from "./retain-form-inputs";

export function LawFirmForm({ firm }: { firm?: LegalFirm }) {
  const [state, action] = useActionState(resilient(saveLawFirm), idleState);
  const prefix = useId();
  const fields = [
    ["name", "Law firm", firm?.name ?? ""], ["contactName", "Contact name", firm?.contact_name ?? ""],
    ["contactEmail", "Contact email", firm?.contact_email ?? ""], ["contactPhone", "Contact phone", firm?.contact_phone ?? ""],
  ] as const;
  return <form action={action} noValidate className="grid gap-4">
    <input type="hidden" name="firmId" value={firm?.id ?? ""} />
    <div className="grid gap-4 sm:grid-cols-2">{fields.map(([name, label, initial]) => <AdminField key={name} id={`${prefix}-${name}`} name={name} label={label} error={state.fieldErrors?.[name]}>
      <AdminInput id={`${prefix}-${name}`} name={name} type={name === "contactEmail" ? "email" : "text"} defaultValue={state.values?.[name] ?? initial} required error={state.fieldErrors?.[name]} />
    </AdminField>)}</div>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={state.values ? state.values.isActive === "on" : firm?.is_active ?? true} /> Available for new handoffs</label>
    <div><SubmitButton pendingLabel="Saving…">Save law firm</SubmitButton></div>
    <ActionFeedback state={state} />
  </form>;
}

export function StartLegalForm({ claimId, firms, requestId }: { claimId: string; firms: LegalFirm[]; requestId: string }) {
  const [state, action] = useActionState(resilient(startLegalHandoff), idleState);
  return <form action={action} className="grid gap-4">
    <input type="hidden" name="claimId" value={claimId} />
    <input type="hidden" name="requestId" value={state.values?.requestId ?? requestId} />
    <AdminField name="firmId" label="Receiving law firm">
      <AdminSelect name="firmId" required defaultValue={state.values?.firmId ?? ""}>
        <option value="">Choose a law firm</option>{firms.filter((f) => f.is_active).map((firm) => <option key={firm.id} value={firm.id}>{firm.name}</option>)}
      </AdminSelect>
    </AdminField>
    <p className="text-sm text-ink/65">Start preparation for this claim. No documents or emails are sent by this step.</p>
    <div><SubmitButton pendingLabel="Starting…" disabled={!firms.some((f) => f.is_active)}>Start handoff preparation</SubmitButton></div>
    <ActionFeedback state={state} />
  </form>;
}

const SUMMARY_LABEL: Record<(typeof LEGAL_SUMMARY_FIELDS)[number], string> = {
  claim: "Claim reference", homeowners: "Homeowner names and contact details", property: "Property address",
  loss: "Loss date and description", insurance: "Carrier, policy, and claim numbers", adjuster: "CMG adjuster", settlement: "Recorded settlement amount",
};

export function LegalPackageForm({ handoffId, documents, requestId }: {
  handoffId: string; requestId: string;
  documents: { id: string; original_name: string; size_bytes: number }[];
}) {
  const [state, action] = useActionState(resilient(prepareLegalPackage), { status: "idle" } as LegalPackageState);
  const [selected, setSelected] = useState<string[]>([]);
  const [summary, setSummary] = useState<string[]>(["claim", "homeowners", "property", "loss", "insurance", "adjuster"]);
  const [note, setNote] = useState("");
  // React resets resolved actions. Package review must retain the visible selections.
  return <div className="grid gap-5">
    <form ref={retainFormInputs} action={action} className="grid gap-4">
      <input type="hidden" name="handoffId" value={handoffId} />
      <input type="hidden" name="requestId" value={state.values?.requestId ?? requestId} />
      <fieldset className="min-w-0"><legend className="mb-2 text-sm font-medium">Summary details to include</legend>
        <div className="grid gap-1 sm:grid-cols-2">{LEGAL_SUMMARY_FIELDS.map((field) => <label key={field} className="flex min-h-11 items-center gap-2 text-sm">
          <input name="summaryFields" type="checkbox" value={field} checked={summary.includes(field)} onChange={(e) => setSummary(e.target.checked ? [...summary, field] : summary.filter((v) => v !== field))} />{SUMMARY_LABEL[field]}
        </label>)}</div>
      </fieldset>
      <AdminField name="summaryNote" label="Summary for the law firm" hint="Only include text you intend to send.">
        <AdminTextarea name="summaryNote" value={note} onChange={(e) => setNote(e.target.value)} rows={5} maxLength={10000} />
      </AdminField>
      <fieldset className="min-w-0"><legend className="mb-2 text-sm font-medium">Original documents</legend>
        {documents.length === 0 ? <p className="text-sm text-ink/65">Add the documents to this claim before preparing a package.</p> : documents.map((document) => <label key={document.id} className="flex min-h-11 items-center gap-2 break-words text-sm">
          <input name="documentIds" type="checkbox" value={document.id} checked={selected.includes(document.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, document.id] : selected.filter((v) => v !== document.id))} />
          <span>{document.original_name} <span className="text-ink/60">({(document.size_bytes / 1048576).toFixed(1)} MiB)</span></span>
        </label>)}
      </fieldset>
      <div><SubmitButton pendingLabel="Preparing…" disabled={!selected.length || !summary.length}>Prepare package for review</SubmitButton></div>
      <ActionFeedback state={state} />
    </form>
    {state.package ? <LegalPackageDownload snapshot={state.package} /> : null}
  </div>;
}

export function LegalMilestoneForm({ handoff, requestId, hasPackage }: { handoff: LegalHandoff; requestId: string; hasPackage: boolean }) {
  const [state, action] = useActionState(resilient(recordLegalMilestone), idleState);
  const choices = allowedMilestones(handoff.milestone);
  const [milestone, setMilestone] = useState<string>(choices[0] ?? "");
  const returning = milestone === "declined" || milestone === "returned";
  if (!choices.length || handoff.ended_at) return null;
  // Preserve a refused submission. The keyed parent replaces this form after a saved milestone.
  return <form ref={retainFormInputs} action={action} className="grid gap-4">
    <input type="hidden" name="handoffId" value={handoff.id} />
    <input type="hidden" name="expectedVersion" value={handoff.version} />
    <input type="hidden" name="requestId" value={state.values?.requestId ?? requestId} />
    <AdminField name="milestone" label="Actual milestone">
      <AdminSelect name="milestone" value={milestone} onChange={(e) => setMilestone(e.target.value)}>{choices.map((choice) => <option key={choice} value={choice}>{LEGAL_LABEL[choice]}</option>)}</AdminSelect>
    </AdminField>
    <AdminField name="occurredOn" label="Date it occurred" error={state.fieldErrors?.occurredOn}>
      <AdminInput name="occurredOn" type="date" required defaultValue={state.values?.occurredOn ?? ""} error={state.fieldErrors?.occurredOn} />
    </AdminField>
    {returning ? <AdminField name="returnStatus" label="Confirm the current CMG stage" hint="The earlier stage is suggested. Check that it is still correct." error={state.fieldErrors?.returnStatus}>
      <AdminSelect name="returnStatus" defaultValue={state.values?.returnStatus || handoff.prior_status} required>{LEGAL_RETURN_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</AdminSelect>
    </AdminField> : <input name="returnStatus" type="hidden" value="" />}
    <label className="flex min-h-11 items-start gap-2 text-sm"><input name="confirmed" type="checkbox" required className="mt-1" />
      <span>I confirm this occurred. Recording it will notify the homeowner. Preparing or downloading a package does not mean it was sent.</span>
    </label>
    {milestone === "sent" && !hasPackage ? <p className="text-sm text-ink/65">Prepare and review the package first. Send it through your chosen method before confirming Sent.</p> : null}
    <div><SubmitButton pendingLabel="Recording…" disabled={milestone === "sent" && !hasPackage}>Record milestone</SubmitButton></div>
    <ActionFeedback state={state} />
  </form>;
}

export function CancelLegalPreparationForm({ handoff, requestId }: { handoff: LegalHandoff; requestId: string }) {
  const [state, action] = useActionState(resilient(cancelLegalPreparation), idleState);
  return <form action={action} className="grid gap-3 border-t border-ink/10 pt-4">
    <input type="hidden" name="handoffId" value={handoff.id} />
    <input type="hidden" name="expectedVersion" value={handoff.version} />
    <input type="hidden" name="requestId" value={state.values?.requestId ?? requestId} />
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirmed" required />Cancel this unsent preparation. Keep its history and packages.</label>
    <div><SubmitButton pendingLabel="Cancelling…">Cancel unsent preparation</SubmitButton></div>
    <ActionFeedback state={state} />
  </form>;
}
