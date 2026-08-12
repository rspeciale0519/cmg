import { Panel, PanelBody } from "@/components/admin/admin-shell";
import { Fact, FactList } from "@/components/admin/data-table";
import { ReassignForm } from "@/components/admin/reassign-form";
import { StatusAdvance } from "@/components/admin/status-advance";
import { loadAdjusters, loadClaimContext } from "@/lib/claims/queries";
import { legalTransitions, transitionBlocks } from "@/lib/claims/transitions";
import {
  formatDateOnly,
  formatTimeOnly,
  formatTimestamp,
  humanizeEnum,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClaimOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { claim, can } = await loadClaimContext(id);

  const supabase = await createClient();
  const allowed = await legalTransitions(supabase, claim.status);
  const [blocked, adjusters] = await Promise.all([
    transitionBlocks(supabase, id, allowed),
    can.canManage ? loadAdjusters() : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="grid gap-4">
        <Panel title="Where this claim stands">
          <PanelBody>
            <StatusAdvance
              claimId={id}
              current={claim.status}
              allowed={allowed}
              blocked={blocked}
              canManage={can.canManage}
            />
          </PanelBody>
        </Panel>

        <Panel title="The loss">
          <PanelBody>
            <FactList columns={2}>
              <Fact label="Date and time of loss">
                <span className="tabular-nums">{formatDateOnly(claim.lossDate)}</span>
                <span className="text-ink/55"> · {formatTimeOnly(claim.lossTime)}</span>
              </Fact>
              <Fact label="Cause">{humanizeEnum(claim.cause)}</Fact>
              <Fact label="What happened" wide>
                <span className="block max-w-[80ch] whitespace-pre-line text-[13.5px] leading-[1.7] text-ink/72">
                  {claim.description}
                </span>
              </Fact>
            </FactList>
          </PanelBody>
        </Panel>

        <Panel title="Policy and carrier">
          <PanelBody>
            <FactList columns={2}>
              <Fact label="Carrier">{claim.carrier}</Fact>
              <Fact label="Policy number">
                <span className="tabular-nums">{claim.policyNumber}</span>
              </Fact>
              <Fact label="With this carrier">
                {humanizeEnum(claim.carrierTenure)}
              </Fact>
              <Fact label="Carrier claim number">
                {claim.claimNumber ? (
                  <span className="tabular-nums">{claim.claimNumber}</span>
                ) : (
                  <span className="text-ink/58">Not issued yet</span>
                )}
              </Fact>
              <Fact label="Prior roof claim">
                {claim.priorRoofClaim
                  ? humanizeEnum(claim.priorOutcome)
                  : "None reported"}
              </Fact>
              <Fact label="Property">
                {claim.propertyStreet}
                {claim.propertyStreet2 ? `, ${claim.propertyStreet2}` : ""}
                <span className="block text-[13px] text-ink/55">
                  {claim.propertyCity}, {claim.propertyState}{" "}
                  <span className="tabular-nums">{claim.propertyZip}</span>
                </span>
              </Fact>
            </FactList>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-4">
        <Panel title="Assignment">
          <PanelBody>
            <ReassignForm
              claimId={id}
              currentAdjusterId={claim.assignedAdjusterId}
              adjusters={adjusters}
              canManage={can.canManage}
            />
          </PanelBody>
        </Panel>

        <Panel title="Referral">
          <PanelBody>
            <FactList columns={1}>
              <Fact label="Company">
                {claim.partnerName ?? (
                  <span className="text-ink/55">Direct — no referring company</span>
                )}
              </Fact>
              {claim.referrerName ? (
                <Fact label="Named on the intake">
                  {claim.referrerName}
                  {claim.referrerEmail ? (
                    <span className="block text-[13px] text-ink/58">
                      {claim.referrerEmail}
                    </span>
                  ) : null}
                </Fact>
              ) : null}
            </FactList>
          </PanelBody>
        </Panel>

        <Panel title="Milestones">
          <PanelBody>
            <FactList columns={1}>
              <Fact label="Intake received">{formatTimestamp(claim.createdAt)}</Fact>
              <Fact label="Representation signed">
                {claim.lorSignedAt ? (
                  formatTimestamp(claim.lorSignedAt)
                ) : (
                  <span className="text-ink/38">—</span>
                )}
              </Fact>
              <Fact label="Filed with carrier">
                {claim.filedAt ? (
                  formatTimestamp(claim.filedAt)
                ) : (
                  <span className="text-ink/38">—</span>
                )}
              </Fact>
              {claim.deniedAt ? (
                <Fact label="Denied">{formatTimestamp(claim.deniedAt)}</Fact>
              ) : null}
              <Fact label="Settled">
                {claim.settledAt ? (
                  formatTimestamp(claim.settledAt)
                ) : (
                  <span className="text-ink/38">—</span>
                )}
              </Fact>
            </FactList>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
