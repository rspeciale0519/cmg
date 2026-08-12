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

/**
 * Both panels below are deliberate excerpts, not lists — the newest five
 * intakes and six homeowners still to invite. That is the right shape for a
 * dashboard, and it was the caption that was wrong: "6 to send" over a
 * `.limit(6)` states a total it has not measured, and at seven uninvited
 * homeowners it says 6 for ever. They keep their caps and state both numbers.
 */
const TRIAGE_EXCERPT = 5;
const INVITE_EXCERPT = 6;
const QUESTION_EXCERPT = 4;

const LEDE: Record<string, string> = {
  owner: "Every claim in the business, and the queues that need a decision today.",
  adjuster: "Your caseload. The stage counts below are your claims, not the firm's.",
  assistant: "Every claim in the business, read-only. Notes and documents are yours to add.",
};

export default async function AdminDashboard() {
  const session = await requireStaff("/admin");
  const supabase = await createClient();

  const [
    statuses,
    intake,
    questions,
    questionCount,
    recent,
    uninvited,
    uninvitedCount,
  ] = await Promise.all([
    // The tally, grouped in Postgres. This used to be `.select("status")` — one
    // enum per claim, counted in TypeScript — and PostgREST caps every
    // collection read at `db-max-rows` (1000, supabase/config.toml), so past a
    // thousand claims the array stopped being the claims table and became its
    // first page, with no error and nothing on the page that could tell.
    //
    // The failure was visible rather than theoretical: at 1522 claims one 1440
    // screen carried the nav badge "Intake 505 waiting" — a real `count: exact`
    // head request — beside the ladder's "01 New intake 5", under the eyebrow
    // "1000 claims in view", while /admin/claims said "Showing 60 of 1022".
    // All ten stage numbers came off that one clamped array.
    //
    // `claim_status_counts()` is SECURITY INVOKER, so `claims_select` scopes it
    // exactly as it scoped the old query: an adjuster's ladder still counts
    // their caseload and not the firm's. It returns at most one row per status,
    // so the row cap has nothing left to bite on.
    supabase.rpc("claim_status_counts"),
    supabase
      .from("claims")
      .select(
        "id, claim_ref, created_at, property_street, property_city, property_state, property_zip, referrer_name, claimants(first_name, last_name, is_primary)",
      )
      .eq("status", "new_intake")
      .order("created_at", { ascending: false })
      .limit(TRIAGE_EXCERPT),
    supabase
      .from("claim_events")
      .select("id, body, created_at, claim_id, claims!claim_events_claim_id_fkey(claim_ref)")
      .eq("type", "question")
      .order("created_at", { ascending: false })
      .limit(QUESTION_EXCERPT),
    // The same predicate, counted. Without it the panel stated nothing at all
    // about the questions it was not showing: at thirteen on file it displayed
    // four and said no word about the other nine, on the only screen in the
    // product that looks across claims for them.
    supabase
      .from("claim_events")
      .select("id", { count: "exact", head: true })
      .eq("type", "question"),
    supabase
      .from("claims")
      .select("id, claim_ref, status, updated_at, property_street, property_city, claimants(first_name, last_name, is_primary)")
      .neq("status", "rejected")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("claimants")
      .select(
        "id, first_name, last_name, email, claims!inner(claim_ref, status, assigned_adjuster_id)",
      )
      .is("user_id", null)
      .neq("claims.status", "new_intake")
      .neq("claims.status", "rejected")
      .order("created_at", { ascending: false })
      .limit(INVITE_EXCERPT),
    // The same predicate, counted rather than fetched. Without it the panel had
    // no way to know it was showing an excerpt, so it captioned six rows as the
    // whole repair list.
    supabase
      .from("claimants")
      .select("id, claims!inner(status)", { count: "exact", head: true })
      .is("user_id", null)
      .neq("claims.status", "new_intake")
      .neq("claims.status", "rejected"),
  ]);

  if (statuses.error) {
    console.error("[dashboard] status tally failed", statuses.error.message);
  }

  const counts: StatusCounts = {};
  for (const row of statuses.data ?? []) {
    if (isClaimStatus(row.status)) {
      counts[row.status] = (counts[row.status] ?? 0) + Number(row.claim_count);
    }
  }

  // Summed from the same tally the ladder draws, so the eyebrow and the ten
  // stage numbers under it are one measurement rather than two of the same set.
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  /**
   * The same rule `issueClaimantInvite` enforces — owner, or the adjuster the
   * claim is assigned to — decided per row rather than per session, because a
   * dashboard spans claims and an adjuster may hold some of them and not others.
   * `claimants_select` admits an assistant to all of these rows, so without this
   * the panel offered them a button the server refuses every time.
   */
  const invitable: InvitableClaimant[] = (uninvited.data ?? []).map((row) => ({
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    claimRef: row.claims?.claim_ref ?? "—",
    canInvite:
      session.role === "owner" ||
      (session.role === "adjuster" &&
        row.claims?.assigned_adjuster_id === session.userId),
  }));
  const invitableTotal = uninvitedCount.count ?? invitable.length;
  const sendableTotal = invitable.filter((row) => row.canInvite).length;

  const questionsShown = (questions.data ?? []).length;
  const questionsTotal = questionCount.count ?? questionsShown;

  const triageShown = (intake.data ?? []).length;
  // Read from the ladder's own tally rather than counted separately, so the
  // number in this caption and the number in the pipeline strip above it are
  // one number and cannot disagree on the same screen.
  const triageTotal = counts.new_intake ?? triageShown;

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
            triageTotal > 0 ? (
              <>
                {triageShown < triageTotal ? (
                  <>
                    Showing <span className="tabular-nums">{triageShown}</span> of{" "}
                    <span className="tabular-nums">{triageTotal}</span>
                    {" · "}
                  </>
                ) : null}
                <Link
                  href="/admin/intake"
                  className="tap-block text-accent no-underline transition-colors duration-150 hover:text-accent-300"
                >
                  Open the queue
                </Link>
              </>
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
                        <span className="mt-[2px] block truncate text-[12px] leading-[1.4] text-ink/55">
                          {formatAddressLine({
                            street: claim.property_street,
                            city: claim.property_city,
                            state: claim.property_state,
                            zip: claim.property_zip,
                          })}
                        </span>
                      </span>
                      <span className="flex items-baseline gap-3 text-[12px] leading-[1.4] text-ink/55">
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

        <Panel
          title="Questions from homeowners"
          meta={
            questionsTotal > 0 ? (
              <>
                {questionsShown < questionsTotal ? (
                  <>
                    Showing <span className="tabular-nums">{questionsShown}</span> of{" "}
                    <span className="tabular-nums">{questionsTotal}</span>
                    {" · "}
                  </>
                ) : null}
                <Link
                  href="/admin/questions"
                  className="tap-block text-accent no-underline transition-colors duration-150 hover:text-accent-300"
                >
                  Open the queue
                </Link>
              </>
            ) : undefined
          }
        >
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
                    <span className="mt-[5px] flex items-baseline gap-3 text-[12px] leading-[1.4] text-ink/55">
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
              className="tap-block text-accent no-underline transition-colors duration-150 hover:text-accent-300"
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
              stickyColumnWidth={132}
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
                        className="tap-block text-ink no-underline hover:text-accent"
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
                      <CellMeta
                        title={`${claim.property_street}, ${claim.property_city}`}
                      >
                        {claim.property_street}, {claim.property_city}
                      </CellMeta>
                    </Td>
                    <Td>
                      {isClaimStatus(claim.status) ? (
                        <StatusPill status={claim.status} />
                      ) : null}
                    </Td>
                    <Td tone="quiet" className="whitespace-nowrap tabular-nums">
                      {formatRelative(claim.updated_at)}
                    </Td>
                  </Tr>
                );
              })}
            </DataTable>
          )}
        </Panel>

        {/* "to send" is a count of work this reader can do, so it counts the
            rows they can act on. An assistant can act on none of them —
            issuance is the owner's or the assigned adjuster's — and the caption
            was saying "2 to send" over two rows that each read "No portal
            access", contradicting every line beneath it. */}
        <Panel
          title="Awaiting portal access"
          meta={
            invitableTotal === 0
              ? undefined
              : sendableTotal === 0
                ? `${invitableTotal} waiting on an owner or the assigned adjuster`
                : invitable.length < invitableTotal
                  ? `${invitable.length} of ${invitableTotal} to send`
                  : `${invitableTotal} to send`
          }
        >
          <InvitePanel claimants={invitable} total={invitableTotal} />
        </Panel>
      </div>
    </>
  );
}
