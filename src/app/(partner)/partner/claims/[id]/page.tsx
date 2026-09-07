import { FactList, Panel, PanelBody } from "@/components/portal/surfaces";
import { formatDateStamp, formatMoney, humanizeEnum } from "@/lib/format";
import { partnerMilestones } from "@/lib/partner/presentation";
import { requirePartnerClaim } from "@/lib/partner/queries";

export default async function PartnerClaimSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const summary = await requirePartnerClaim(id);
  const milestones = partnerMilestones(summary);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <Panel title="Claim summary">
        <PanelBody>
          <FactList
            items={[
              { term: "Reference", value: <span className="tabular-nums">{summary.claim_ref}</span> },
              { term: "Status", value: humanizeEnum(summary.status) },
              { term: "Homeowner", value: summary.homeowner_name ?? "Name pending" },
              {
                term: "Property",
                value: [summary.property_street, summary.property_city].filter(Boolean).join(", ") || "Address pending",
              },
            ]}
          />
        </PanelBody>
      </Panel>

      <div className="grid gap-4">
        <Panel title="Milestones">
          {milestones.length === 0 ? (
            <PanelBody>
              <p className="text-[14px] leading-[1.7] text-ink/58">
                The first milestone appears here once the representation agreement is signed.
              </p>
            </PanelBody>
          ) : (
            <ol className="divide-y divide-ink/8">
              {milestones.map((milestone) => (
                <li key={milestone.label} className="px-5 py-4">
                  <p className="text-[14px] font-medium text-ink">{milestone.label}</p>
                  <time className="mt-1 block text-[13px] text-ink/58" dateTime={milestone.at}>
                    {formatDateStamp(milestone.at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Settlement">
          <PanelBody>
            {summary.settlement_amount === null ? (
              <p className="text-[14px] leading-[1.7] text-ink/62">
                The settlement amount remains private until the claim is settled.
              </p>
            ) : (
              <p className="text-[24px] font-medium tabular-nums text-ink">
                {formatMoney(summary.settlement_amount)}
              </p>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
