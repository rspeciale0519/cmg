import { Panel, PanelBody } from "./surfaces";
import { LEGAL_LABEL, type LegalProgress as LegalProgressData } from "@/lib/legal/types";
import { formatDateOnly } from "@/lib/format";

export function LegalProgress({ progress }: { progress: LegalProgressData }) {
  if (!progress.milestones.length) return null;
  return <Panel title="Law-firm progress"><PanelBody>
    <ol className="grid gap-3">{progress.milestones.map((milestone) => <li key={milestone.id} className="text-sm"><span className="font-medium">{LEGAL_LABEL[milestone.milestone]}</span><span className="block text-ink/65">{formatDateOnly(milestone.occurred_on)}</span></li>)}</ol>
    {progress.contact ? <div className="mt-5 border-t border-ink/10 pt-4"><p className="font-medium">{progress.contact.name}</p><p className="text-sm">{progress.contact.contactName}</p><div className="mt-2 grid text-sm">
      <a className="flex min-h-11 items-center break-all text-accent" href={`mailto:${encodeURIComponent(progress.contact.email)}`}>{progress.contact.email}</a>
      <a className="flex min-h-11 items-center text-accent" href={`tel:${progress.contact.phone.replace(/[^+\d]/g, "")}`}>{progress.contact.phone}</a>
    </div></div> : null}
  </PanelBody></Panel>;
}
