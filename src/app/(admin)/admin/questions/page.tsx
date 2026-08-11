import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { ListPager, listMeta } from "@/components/admin/list-pager";
import { ClaimRef, StatusPill } from "@/components/admin/status-pill";
import { pageCursors } from "@/lib/admin/audit-range";
import {
  firstParam,
  formatTimeCursor,
  pageSlice,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
} from "@/lib/admin/paging";
import { isClaimStatus } from "@/lib/claims/status";
import { requireStaff } from "@/lib/authz";
import { formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Questions",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 40;

/**
 * Every question a homeowner has asked, across every claim the reader may see.
 *
 * This screen exists because the dashboard panel that showed four of them had
 * nowhere to send anyone for the fifth. `type = 'question'` is written by the
 * portal and read in exactly two places: the claim's own activity tab, which is
 * scoped to one claim, and the dashboard excerpt — so with thirteen questions on
 * file, nine of them were in the database, counted by nothing and reachable from
 * no list. A queue you can only see the head of is not a queue.
 *
 * Ordered newest-first and keyset-paged on `(created_at, id)`, the same
 * mechanism the activity feed uses and for the same reason: a question posted
 * while the reader is on page 1 would shift every later row under an offset and
 * silently skip whichever sat on the boundary — in an inbox of things people are
 * waiting on, the one row nobody would notice missing.
 *
 * No answered/unanswered column, deliberately. The activity tab decides that per
 * claim with a `limit(1)` read of the newest reply, which is exact; doing it for
 * forty claims at once would mean a reply query with no bound on it, and a
 * capped read reporting "waiting" over a question that was answered is the same
 * class of defect this round is here to remove. The claim is one click away and
 * answers it exactly.
 *
 * RLS scopes the list and the total together — an adjuster sees questions on the
 * claims assigned to them, an owner and an assistant see all of them — so the
 * number in the header is the number of rows this reader can reach.
 */
export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaff("/admin/questions");
  const raw = await searchParams;
  const supabase = await createClient();

  const forward = parseTimeCursor(firstParam(raw, "next"));
  const backward = forward ? null : parseTimeCursor(firstParam(raw, "prev"));
  const cursor = forward ?? backward;
  const reversed = backward !== null;

  let query = supabase
    .from("claim_events")
    .select(
      "id, body, created_at, claim_id, claims!claim_events_claim_id_fkey(claim_ref, status)",
    )
    .eq("type", "question")
    .order("created_at", { ascending: reversed })
    .order("id", { ascending: reversed })
    .limit(PAGE_SIZE + 1);

  if (cursor) query = query.or(timeKeysetClause(reversed ? "asc" : "desc", cursor));

  const [questions, count] = await Promise.all([
    query,
    // Counted rather than measured off the page, so the header states the size
    // of the queue and not the size of the window onto it.
    supabase
      .from("claim_events")
      .select("id", { count: "exact", head: true })
      .eq("type", "question"),
  ]);

  if (questions.error) {
    console.error("[questions] list query failed", questions.error.message);
  }

  const page = pageSlice(questions.data ?? [], PAGE_SIZE, reversed);
  const rows = page.rows;
  const total = count.count ?? rows.length;

  const { olderThan: nextCursor, newerThan: prevCursor } = pageCursors({
    ids: rows.map((event) => formatTimeCursor(timeCursorFrom(event))),
    hasMore: page.hasMore,
    ascending: reversed,
    cameFromCursor: cursor !== null,
  });

  const base = "/admin/questions";
  const pageHref = (key: "next" | "prev", value: string) => `${base}?${key}=${value}`;

  const scope =
    session.role === "adjuster"
      ? "Questions asked from the homeowner portal on the claims assigned to you. Answering happens on the claim."
      : "Questions asked from the homeowner portal, across every claim. Answering happens on the claim, so each one opens where the reply is written.";

  return (
    <>
      <PageHeader
        eyebrow={`${total} question${total === 1 ? "" : "s"}`}
        title="Questions from homeowners."
        lede={scope}
      />

      <Panel
        title="Newest first"
        meta={listMeta(rows.length, total, "question", "questions")}
      >
        {rows.length === 0 ? (
          cursor ? (
            <EmptyState headline="You have reached the end of the queue.">
              <Link
                href={base}
                className="text-accent no-underline hover:text-accent-300"
              >
                Back to the newest
              </Link>
            </EmptyState>
          ) : (
            <EmptyState headline="No open questions.">
              Anything a homeowner asks from their portal arrives here and on the
              claim&rsquo;s activity tab.
            </EmptyState>
          )
        ) : (
          <>
            <ul className="divide-y divide-ink/8">
              {rows.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/admin/claims/${event.claim_id}/activity`}
                    className="block px-[clamp(14px,1.6vw,20px)] py-[13px] no-underline transition-colors duration-150 hover:bg-ink/[0.045]"
                  >
                    {/* The question itself carries the row. On a cross-claim
                        queue the words are what the reader is triaging — which
                        claim it belongs to is the attribution underneath, the
                        same order the audit trail puts "what happened" and "who
                        did it" in. Three lines, not two: these are typed by a
                        homeowner and run longer than a note. */}
                    <span className="line-clamp-3 block max-w-[86ch] text-[13.5px] leading-[1.6] text-ink/85">
                      {event.body}
                    </span>
                    <span className="mt-[7px] flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] leading-[1.4] text-ink/42">
                      <ClaimRef
                        value={event.claims?.claim_ref ?? "—"}
                        className="text-ink/62"
                      />
                      {event.claims && isClaimStatus(event.claims.status) ? (
                        <StatusPill status={event.claims.status} />
                      ) : null}
                      <time dateTime={event.created_at}>
                        {formatTimestamp(event.created_at)}
                      </time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <ListPager
              label="Question pages"
              noun="question"
              pluralNoun="questions"
              placement="footer"
              shown={rows.length}
              total={total}
              prevHref={prevCursor ? pageHref("prev", prevCursor) : null}
              nextHref={nextCursor ? pageHref("next", nextCursor) : null}
              startHref={cursor ? base : null}
            />
          </>
        )}
      </Panel>
    </>
  );
}
