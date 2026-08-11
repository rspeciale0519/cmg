import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { CellMeta, DataTable, Td, Th, Tr } from "@/components/admin/data-table";
import { PipelineLadder, type StatusCounts } from "@/components/admin/pipeline-ladder";
import { ClaimRef, StatusPill } from "@/components/admin/status-pill";
import { isClaimStatus } from "@/lib/claims/status";
import { requireStaff } from "@/lib/authz";
import { formatAddressLine, formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { InvitePanel, type InvitableClaimant } from "./invite-panel";

export const dynamic = "force-dynamic";

const LEDE: Record<string, string> = {
  owner: "Every claim in the business, and the queues that need a decision today.",
  adjuster: "Your caseload. The stage counts below are your claims, not the firm's.",
  assistant: "Every claim in the business, read-only. Notes and documents are yours to add.",
};

export default async function AdminDashboard() {
  const session = await requireStaff("/admin");
  const supabase = await createClient();

  const [statuses, intake, questions, recent, uninvited] = await Promise.all([
    // One narrow column for every claim the caller may see, tallied below.
    // PostgREST has no GROUP BY without a view, and at CMG's volume — hundreds
    // of claims a year — an enum-per-row is cheaper than the round trips a
    // count-per-status would cost. If the table ever reaches six figures this
    // is the query to replace with a view.
    supabase.from("claims").select("status"),
    supabase
      .from("claims")
      .select(
        "id, claim_ref, created_at, property_street, property_city, property_state, property_zip, referrer_name, claimants(first_name, last_name, is_primary)",
      )
      .eq("status", "new_intake")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("claim_events")
      .select("id, body, created_at, claim_id, claims!claim_events_claim_id_fkey(claim_ref)")
      .eq("type", "question")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("claims")
      .select("id, claim_ref, status, updated_at, property_street, property_city, claimants(first_name, last_name, is_primary)")
      .neq("status", "rejected")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("claimants")
      .select("id, first_name, last_name, email, claims!inner(claim_ref, status)")
      .is("user_id", null)
      .neq("claims.status", "new_intake")
      .neq("claims.status", "rejected")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const counts: StatusCounts = {};
  for (const row of statuses.data ?? []) {
    if (isClaimStatus(row.status)) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
  }

  const total = (statuses.data ?? []).length;

  const invitable: InvitableClaimant[] = (uninvited.data ?? []).map((row) => ({
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    claimRef: row.claims?.claim_ref ?? "—",
  }));

  return (
    <>
      <PageHeader
        eyebrow={`${total} claim${total === 1 ? "" : "s"} in view`}
        title="Claims desk."
        lede={LEDE[session.role]}
      />

      <PipelineLadder counts={counts} />

      <div className="mt-[clamp(28px,3.4vw,44px)] grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel
          title="Waiting on triage"
          meta={
            (counts.new_intake ?? 0) > 0 ? (
              <Link
                href="/admin/intake"
                className="text-accent no-underline transition-colors duration-150 hover:text-accent-300"
              >
                Open the queue
              </Link>
            ) : undefined
          }
        >
          {(intake.data ?? []).length === 0 ? (
            <EmptyState headline="Nothing waiting.">
              New submissions from the public claim form land here for a decision.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-ink/8">
              {(intake.data ?? []).map((claim) => {
                const primary =
                  claim.claimants?.find((person) => person.is_primary) ??
                  claim.claimants?.[0];

                return (
                  <li key={claim.id}>
                    <Link
                      href={`/admin/intake#${claim.id}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 px-[clamp(14px,1.6vw,20px)] py-[12px] no-underline transition-colors duration-150 hover:bg-ink/[0.045]"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] leading-[1.45] text-ink/88">
                          {primary
                            ? `${primary.first_name} ${primary.last_name}`.trim()
                            : "Unnamed homeowner"}
                        </span>
                        <span className="mt-[2px] block truncate text-[12px] leading-[1.4] text-ink/42">
                          {formatAddressLine({
                            street: claim.property_street,
                            city: claim.property_city,
                            state: claim.property_state,
                            zip: claim.property_zip,
                          })}
                        </span>
                      </span>
                      <span className="flex items-baseline gap-3 text-[12px] leading-[1.4] text-ink/42">
                        <ClaimRef value={claim.claim_ref} className="text-ink/62" />
                        {formatRelative(claim.created_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Questions from homeowners">
          {(questions.data ?? []).length === 0 ? (
            <EmptyState headline="No open questions.">
              Anything a homeowner asks from their portal arrives here and on the
              claim&rsquo;s activity tab.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-ink/8">
              {(questions.data ?? []).map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/admin/claims/${event.claim_id}/activity`}
                    className="block px-[clamp(14px,1.6vw,20px)] py-[12px] no-underline transition-colors duration-150 hover:bg-ink/[0.045]"
                  >
                    <span className="line-clamp-2 block text-[13px] leading-[1.5] text-ink/82">
                      {event.body}
                    </span>
                    <span className="mt-[5px] flex items-baseline gap-3 text-[12px] leading-[1.4] text-ink/42">
                      <ClaimRef
                        value={event.claims?.claim_ref ?? "—"}
                        className="text-ink/58"
                      />
                      {formatRelative(event.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel
          title="Recently touched"
          meta={
            <Link
              href="/admin/claims"
              className="text-accent no-underline transition-colors duration-150 hover:text-accent-300"
            >
              All claims
            </Link>
          }
        >
          {(recent.data ?? []).length === 0 ? (
            <EmptyState headline="No claims yet.">
              Accepted intakes appear here as they move through the pipeline.
            </EmptyState>
          ) : (
            <DataTable
              caption="Recently updated claims"
              /* The default floor is 860, which is the claims list's number: seven
                 columns with 746px of fixed width before the flexible one gets
                 anything. This table has four columns totalling 398px of fixed
                 width and sits in a 3fr track — 804px at 1440 — so the default
                 forced a 56px overflow there and 294px at 1024. The visible cost
                 was the last header rendering as "UPDATI" on the first screen
                 every staff member sees. 520 leaves the flexible Homeowner column
                 122px at the floor and measures zero overflow at 1440, 1366, 1280
                 and 1024 with no cell newly truncated. */
              minWidth={520}
              head={
                <>
                  <Th className="w-[132px]">Reference</Th>
                  <Th>Homeowner</Th>
                  <Th className="w-[150px]">Status</Th>
                  <Th className="w-[116px]">Updated</Th>
                </>
              }
            >
              {(recent.data ?? []).map((claim) => {
                const primary =
                  claim.claimants?.find((person) => person.is_primary) ??
                  claim.claimants?.[0];

                return (
                  <Tr key={claim.id}>
                    <Td>
                      <Link
                        href={`/admin/claims/${claim.id}`}
                        className="text-ink no-underline hover:text-accent"
                      >
                        <ClaimRef value={claim.claim_ref} />
                      </Link>
                    </Td>
                    <Td>
                      <span className="block truncate">
                        {primary
                          ? `${primary.first_name} ${primary.last_name}`.trim()
                          : "—"}
                      </span>
                      <CellMeta>
                        {claim.property_street}, {claim.property_city}
                      </CellMeta>
                    </Td>
                    <Td>
                      {isClaimStatus(claim.status) ? (
                        <StatusPill status={claim.status} />
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums text-ink/50">
                      {formatRelative(claim.updated_at)}
                    </Td>
                  </Tr>
                );
              })}
            </DataTable>
          )}
        </Panel>

        <Panel
          title="Awaiting portal access"
          meta={invitable.length > 0 ? `${invitable.length} to send` : undefined}
        >
          <InvitePanel claimants={invitable} />
        </Panel>
      </div>
    </>
  );
}
