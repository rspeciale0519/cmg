import type { Metadata } from "next";
import { PortalPager } from "@/components/portal/pager";
import { QuestionComposer } from "@/components/portal/question-composer";
import { EmptyState, Panel, PanelBody } from "@/components/portal/surfaces";
import { pageCursors } from "@/lib/admin/audit-range";
import { cx } from "@/lib/cx";
import { formatTimestamp } from "@/lib/format";
import {
  firstParam,
  formatTimeCursor,
  pageSlice,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
} from "@/lib/paging";
import { portalSectionTitle, requirePortalClaim } from "@/lib/portal/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return portalSectionTitle(id, "Activity");
}

/**
 * Twenty. An entry is a header line and a paragraph, and this is a screen read
 * on a phone — forty of them is a page nobody reaches the bottom of, and the
 * homeowner's own questions are the entries they scroll back for.
 */
const PAGE_SIZE = 20;

/**
 * What each kind of entry is, said to the person it happened to.
 *
 * `status` and `system` deliberately collapse into one word. The distinction
 * between "an adjuster moved this claim" and "the software moved this claim" is
 * real inside CMG and means nothing to a homeowner, who wants to know that the
 * claim moved.
 */
const TYPE_LABEL: Record<string, string> = {
  status: "Update",
  system: "Update",
  note: "From CMG",
  question: "You asked",
  reply: "CMG replied",
  document: "Document",
};

export default async function PortalActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await requirePortalClaim(id);

  const raw = await searchParams;
  const supabase = await createClient();

  const forward = parseTimeCursor(firstParam(raw, "next"));
  const backward = forward ? null : parseTimeCursor(firstParam(raw, "prev"));
  const cursor = forward ?? backward;
  const reversed = backward !== null;

  /* No `.eq("visibility", …)`. `claim_events_select` gives a customer entries
     marked `customer` or `shared` on their own claim and nothing else, so an
     unfiltered select over this claim already *is* the customer-visible feed —
     internal notes are not filtered out here, they are not returned. A WHERE
     clause would be a second, weaker copy of that rule sitting in front of the
     real one, and the copy is what a future edit would break. */
  let query = supabase
    .from("claim_events")
    .select("id, type, body, created_at")
    .eq("claim_id", id)
    .order("created_at", { ascending: reversed })
    .order("id", { ascending: reversed })
    .limit(PAGE_SIZE + 1);

  if (cursor) query = query.or(timeKeysetClause(reversed ? "asc" : "desc", cursor));

  const [events, count] = await Promise.all([
    query,
    supabase
      .from("claim_events")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", id),
  ]);

  const page = pageSlice(events.data ?? [], PAGE_SIZE, reversed);
  const rows = page.rows;
  const total = count.count ?? rows.length;

  const { olderThan: nextCursor, newerThan: prevCursor } = pageCursors({
    ids: rows.map((event) => formatTimeCursor(timeCursorFrom(event))),
    hasMore: page.hasMore,
    ascending: reversed,
    cameFromCursor: cursor !== null,
  });

  const base = `/portal/claims/${id}/activity`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <Panel title="Everything on your claim">
        {rows.length === 0 ? (
          <EmptyState headline="Nothing has happened on the claim yet.">
            Every update, every answer from your adjuster and every question you
            ask lands here, newest first.
          </EmptyState>
        ) : (
          <>
            <ol className="divide-y divide-ink/8">
              {rows.map((event) => {
                const mine = event.type === "question";

                return (
                  <li
                    key={event.id}
                    className={cx(
                      "px-[clamp(18px,2.4vw,28px)] py-[16px]",
                      mine && "bg-accent/[0.035]",
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                      <p
                        className={cx(
                          "text-[11px] uppercase leading-[1.4] tracking-[0.14em]",
                          mine ? "text-accent" : "text-ink/58",
                        )}
                      >
                        {TYPE_LABEL[event.type] ?? "Update"}
                      </p>
                      <time
                        dateTime={event.created_at}
                        className="shrink-0 text-[12px] leading-[1.45] text-ink/58"
                      >
                        {formatTimestamp(event.created_at)}
                      </time>
                    </div>

                    <p className="mt-[8px] max-w-[70ch] whitespace-pre-line text-[14.5px] leading-[1.75] text-ink/85">
                      {event.body}
                    </p>
                  </li>
                );
              })}
            </ol>

            <PortalPager
              label="Activity pages"
              noun="entry"
              pluralNoun="entries"
              shown={rows.length}
              total={total}
              prevHref={prevCursor ? `${base}?prev=${prevCursor}` : null}
              nextHref={nextCursor ? `${base}?next=${nextCursor}` : null}
              startHref={cursor ? base : null}
            />
          </>
        )}
      </Panel>

      <Panel title="Ask a question">
        <PanelBody>
          <QuestionComposer claimId={id} />
        </PanelBody>
      </Panel>
    </div>
  );
}
