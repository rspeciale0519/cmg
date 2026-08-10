import { EmptyState, Panel, PanelBody } from "@/components/admin/admin-shell";
import { StatusPill } from "@/components/admin/status-pill";
import { loadClaimContext } from "@/lib/claims/queries";
import { isClaimStatus } from "@/lib/claims/status";
import { formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "claims.update": "Claim changed",
  "claims.insert": "Claim created",
  "documents.insert": "Document added",
  "documents.update": "Document changed",
  "documents.delete": "Document removed",
  "claim_status_history.insert": "Status recorded",
  "claim_financials.insert": "Figures recorded",
  "claim_financials.update": "Figures changed",
  "claimants.insert": "Claimant added",
  "claimants.update": "Claimant changed",
  "consents.insert": "Consent captured",
  "consents.update": "Consent changed",
  "document.signed_url_issued": "Download link issued",
  "claim.intake_accepted": "Intake accepted",
  "claim.intake_rejected": "Intake declined",
  "invite.issued": "Invitation sent",
  "invite.accepted": "Invitation accepted",
};

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { can } = await loadClaimContext(id);
  const supabase = await createClient();

  const [history, audit] = await Promise.all([
    supabase
      .from("claim_status_history")
      .select(
        "id, from_status, to_status, note, created_at, changed_by, actor:profiles!claim_status_history_changed_by_fkey(first_name, last_name)",
      )
      .eq("claim_id", id)
      .order("created_at", { ascending: false }),
    // `audit_log_select_owner` is exactly what its name says, so this query
    // returns nothing for an adjuster or an assistant rather than failing. The
    // panel is only rendered for an owner so the difference is never mistaken
    // for "nothing has happened on this claim".
    can.isOwner
      ? supabase
          .from("audit_log")
          .select("id, action, entity, actor_id, meta, created_at")
          .eq("entity_id", id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = history.data ?? [];
  const trail = audit.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <Panel title="Status history" meta={`${rows.length} moves`}>
        {rows.length === 0 ? (
          <EmptyState headline="No moves recorded.">
            Every status change writes a line here with who made it and why.
          </EmptyState>
        ) : (
          <ol className="divide-y divide-ink/8">
            {rows.map((entry) => {
              const actor = entry.actor
                ? `${entry.actor.first_name ?? ""} ${entry.actor.last_name ?? ""}`.trim()
                : null;

              return (
                <li key={entry.id} className="px-[clamp(14px,1.6vw,20px)] py-[13px]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                    {entry.from_status && isClaimStatus(entry.from_status) ? (
                      <>
                        <StatusPill status={entry.from_status} />
                        <span aria-hidden="true" className="text-ink/28">
                          →
                        </span>
                      </>
                    ) : null}
                    {isClaimStatus(entry.to_status) ? (
                      <StatusPill status={entry.to_status} />
                    ) : null}
                  </div>

                  <p className="mt-[7px] text-[11.5px] leading-[1.4] text-ink/38">
                    {actor ?? "System"} · {formatTimestamp(entry.created_at)}
                  </p>

                  {entry.note ? (
                    <p className="mt-[7px] max-w-[70ch] whitespace-pre-line text-[13px] leading-[1.65] text-ink/72">
                      {entry.note}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      {can.isOwner ? (
        <Panel title="Audit trail" meta={`${trail.length} entries`}>
          {trail.length === 0 ? (
            <EmptyState headline="Nothing recorded against this claim id.">
              Row-level changes and every signed download link land here.
            </EmptyState>
          ) : (
            <ol className="divide-y divide-ink/8">
              {trail.map((entry) => (
                <li key={entry.id} className="px-[clamp(14px,1.6vw,20px)] py-[11px]">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[12.5px] leading-[1.45] text-ink/78">
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </p>
                    <time
                      dateTime={entry.created_at}
                      className="shrink-0 text-[11.5px] leading-[1.4] tabular-nums text-ink/32"
                    >
                      {formatTimestamp(entry.created_at)}
                    </time>
                  </div>
                  <p className="mt-[3px] font-mono text-[11px] leading-[1.45] text-ink/30">
                    {entry.action}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      ) : (
        <Panel title="Audit trail">
          <PanelBody>
            <p className="text-[12.5px] leading-[1.7] text-ink/50">
              The full audit trail — every row change, every invitation, every
              download link issued — is readable by the owner. It is append-only
              and carries no update or delete permission for anyone, including
              them.
            </p>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
