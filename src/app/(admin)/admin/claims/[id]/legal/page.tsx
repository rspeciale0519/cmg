import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { Panel, PanelBody } from "@/components/admin/admin-shell";
import { LawFirmForm, StartLegalForm, LegalPackageForm, LegalMilestoneForm, CancelLegalPreparationForm } from "@/components/admin/legal-handoff-forms";
import { LegalPackageDownload } from "@/components/admin/legal-package-download";
import { loadLegalWorkspace } from "@/lib/legal/queries";
import { LEGAL_LABEL } from "@/lib/legal/types";
import { formatDateOnly, formatTimestamp } from "@/lib/format";
import { adminTitle, NOT_FOUND_TITLE } from "@/lib/authz";
import { claimTitleContext } from "@/lib/claims/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const context = await claimTitleContext(id);
  const title = context?.can.canManage ? "Legal handoff" : NOT_FOUND_TITLE;
  return { title: { absolute: adminTitle(title) } };
}

export default async function LegalHandoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { claim, can, firms, handoffs, packages, documents, milestones } = await loadLegalWorkspace(id);
  const active = handoffs.find((handoff) => !handoff.ended_at);
  const activePackages = packages.filter((snapshot) => snapshot.handoffId === active?.id);
  const canStart = claim.lorSignedAt !== null && ["lor_signed", "documenting", "filed", "negotiating", "settlement_offered", "denied", "reopened"].includes(claim.status);
  return <div className="grid gap-4">
    <Panel title="Law-firm handoff"><PanelBody>
      <p className="mb-4 text-sm text-ink/65">This process works for direct homeowner claims and claims from any referring company. CMG keeps responsibility for recording updates.</p>
      {active ? <div className="grid gap-4">
        <div className="min-w-0 break-words"><h2 className="text-lg font-medium">{active.firm_snapshot.name}</h2><p className="text-sm">{active.firm_snapshot.contactName} · {active.firm_snapshot.email} · {active.firm_snapshot.phone}</p>
          <p className="mt-2 text-sm text-ink/65">{active.milestone ? LEGAL_LABEL[active.milestone] : "Preparing the handoff"}</p></div>
        <LegalMilestoneForm key={`${active.id}-${active.version}`} handoff={active} requestId={randomUUID()} hasPackage={activePackages.length > 0} />
        {!active.milestone ? <CancelLegalPreparationForm handoff={active} requestId={randomUUID()} /> : null}
      </div> : canStart ? <StartLegalForm claimId={id} firms={firms} requestId={randomUUID()} /> : <p className="text-sm">A handoff needs an active claim with signed representation.</p>}
    </PanelBody></Panel>
    {active ? <Panel title="Prepare a document package"><PanelBody><LegalPackageForm handoffId={active.id} documents={documents} requestId={randomUUID()} /></PanelBody></Panel> : null}
    {packages.length ? <Panel title="Prepared packages"><PanelBody><div className="grid gap-4">{packages.map((snapshot) => <details key={snapshot.id} className="min-w-0 border-b border-ink/10 pb-4"><summary className="cursor-pointer text-sm">{snapshot.firm.name} · {formatTimestamp(snapshot.createdAt)}</summary><LegalPackageDownload snapshot={snapshot} /></details>)}</div></PanelBody></Panel> : null}
    {handoffs.length ? <Panel title="Handoff history"><PanelBody><ul className="grid gap-4">{handoffs.map((handoff) => <li key={handoff.id} className="min-w-0 break-words text-sm">
      <span className="font-medium">{handoff.firm_snapshot.name}</span> · {handoff.milestone ? LEGAL_LABEL[handoff.milestone] : handoff.outcome === "cancelled" ? "Unsent preparation cancelled" : "Preparing"}{handoff.outcome === "settled" ? " · Claim settled" : ""}
      <span className="block text-ink/60">Started {formatTimestamp(handoff.created_at)}</span>
      <ol className="mt-2 grid gap-1">{milestones.filter((milestone) => milestone.handoff_id === handoff.id).map((milestone) => <li key={milestone.id}>{LEGAL_LABEL[milestone.milestone]} · {formatDateOnly(milestone.occurred_on)}<span className="block text-xs text-ink/60">Recorded {formatTimestamp(milestone.recorded_at)}</span></li>)}</ol>
    </li>)}</ul></PanelBody></Panel> : null}
    {can.isOwner ? <Panel title="Law-firm directory"><PanelBody><div className="grid gap-5"><details><summary className="mb-4 cursor-pointer text-sm font-medium">Add a law firm</summary><LawFirmForm /></details>{firms.map((firm) => <details key={firm.id}><summary className="mb-4 cursor-pointer text-sm font-medium">{firm.name}{!firm.is_active ? " · Inactive" : ""}</summary><LawFirmForm firm={firm} /></details>)}</div></PanelBody></Panel> : null}
  </div>;
}
