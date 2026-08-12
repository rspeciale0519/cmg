import { EmptyState, Panel, PanelBody } from "@/components/admin/admin-shell";
import { EventComposer } from "@/components/admin/event-composer";
import { ListPager, listMeta } from "@/components/admin/list-pager";
import { VisibilityTag } from "@/components/admin/status-pill";
import { pageCursors } from "@/lib/admin/audit-range";
import {
  firstParam,
  formatTimeCursor,
  pageSlice,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
} from "@/lib/admin/paging";
import { loadClaimContext } from "@/lib/claims/queries";
import { cx } from "@/lib/cx";
import { formatTimestamp, initialsFor } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  status: "Status",
  note: "Note",
  question: "Question",
  reply: "Reply",
  document: "Document",
  system: "System",
};

/**
 * Forty. An entry is a header line and a paragraph, so a hundred and twenty of
 * them was a page nobody reached the bottom of — and the number under the panel
 * title counted only what had been fetched, while the tab-strip badge 40px above
 * it counted the whole table. At 121 events the two disagreed on one screen.
 */
const PAGE_SIZE = 40;

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { can } = await loadClaimContext(id);
  const raw = await searchParams;
  const supabase = await createClient();

  const forward = parseTimeCursor(firstParam(raw, "next"));
  const backward = forward ? null : parseTimeCursor(firstParam(raw, "prev"));
  const cursor = forward ?? backward;
  const reversed = backward !== null;

  const SELECT =
    "id, type, body, visibility, created_at, author_id, author:profiles!claim_events_author_id_fkey(first_name, last_name)";

  let query = supabase
    .from("claim_events")
    .select(SELECT)
    .eq("claim_id", id)
    .order("created_at", { ascending: reversed })
    .order("id", { ascending: reversed })
    .limit(PAGE_SIZE + 1);

  if (cursor) query = query.or(timeKeysetClause(reversed ? "asc" : "desc", cursor));

  const [events, count, question, reply] = await Promise.all([
    query,
    // The same `count: "exact"` the tab-strip badge reads, so the two numbers on
    // this screen are the same number rather than two measurements of it.
    supabase
      .from("claim_events")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", id),
    // The reply target is a fact about the claim, not about the page: read from
    // the whole table so page 2 does not offer to answer a different question
    // from the one page 1 offered.
    supabase
      .from("claim_events")
      .select("id, body, created_at")
      .eq("claim_id", id)
      .eq("type", "question")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("claim_events")
      .select("created_at")
      .eq("claim_id", id)
      .eq("type", "reply")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  const base = `/admin/claims/${id}/activity`;
  const pageHref = (key: "next" | "prev", value: string) => `${base}?${key}=${value}`;

  // The newest unanswered question, offered to the composer as a reply target.
  // "Unanswered" is read as "no reply posted after it", which is what a staff
  // member means by the word — the schema does not thread replies to questions,
  // and inventing a link would be a schema change to solve a display problem.
  const newestQuestion = question.data;
  const newestReply = reply.data;
  const unanswered =
    newestQuestion &&
    (!newestReply ||
      new Date(newestReply.created_at) < new Date(newestQuestion.created_at))
      ? { id: newestQuestion.id, body: newestQuestion.body }
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <Panel title="Activity" meta={listMeta(rows.length, total, "entry", "entries")}>
        {rows.length === 0 ? (
          <EmptyState headline="Nothing on the feed yet.">
            Status changes land here automatically. Notes you write and questions
            the homeowner asks appear alongside them.
          </EmptyState>
        ) : (
          <>
          <ol className="divide-y divide-ink/8">
            {rows.map((event) => {
              const author = event.author
                ? `${event.author.first_name ?? ""} ${event.author.last_name ?? ""}`.trim()
                : null;
              const isQuestion = event.type === "question";

              return (
                <li
                  key={event.id}
                  className={cx(
                    "px-[clamp(14px,1.6vw,20px)] py-[14px]",
                    isQuestion && "bg-accent/[0.035]",
                  )}
                >
                  {/* Two facts, one line — but only where a line will hold
                      them. "Note · Austin Graham · AG" and "CMG only ·
                      Aug 10, 2026, 4:22 PM" together need about 420px, and the
                      panel is 313px wide on a phone. As one flex row the left
                      half was a flex item with `min-width: auto`, so it refused
                      to shrink, its own `flex-wrap` never fired, and the header
                      simply grew past the panel. Stacked below `sm` each half
                      gets the full measure; from `sm` up they sit on one line
                      as before, and `min-w-0` keeps the left half shrinkable
                      there too. */}
                  <div className="flex flex-col gap-y-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-5">
                    <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-[12px] leading-[1.4]">
                      <span
                        className={cx(
                          "text-[11px] uppercase tracking-[0.12em]",
                          isQuestion ? "text-accent" : "text-ink/58",
                        )}
                      >
                        {TYPE_LABEL[event.type] ?? event.type}
                      </span>
                      <span className="text-ink/62">
                        {author ?? (
                          <span className="text-ink/58">
                            {isQuestion ? "Homeowner" : "System"}
                          </span>
                        )}
                      </span>
                      {author ? (
                        <span
                          aria-hidden="true"
                          className="rounded-full bg-ink/8 px-[6px] py-[1px] text-[10px] tracking-[0.06em] text-ink/58"
                        >
                          {initialsFor(author)}
                        </span>
                      ) : null}
                    </p>
                    <p className="flex shrink-0 items-baseline gap-3 text-[11.5px] leading-[1.4] text-ink/58">
                      <VisibilityTag visibility={event.visibility} />
                      <time dateTime={event.created_at}>
                        {formatTimestamp(event.created_at)}
                      </time>
                    </p>
                  </div>

                  <p className="mt-[7px] max-w-[86ch] whitespace-pre-line text-[13.5px] leading-[1.7] text-ink/82">
                    {event.body}
                  </p>
                </li>
              );
            })}
          </ol>

          <ListPager
            label="Activity pages"
            noun="entry"
            pluralNoun="entries"
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

      <div className="grid gap-4">
        {can.canPostNote ? (
          <Panel title={unanswered ? "Answer the homeowner" : "Post an entry"}>
            <PanelBody>
              <EventComposer
                claimId={id}
                canPostShared={can.canPostShared}
                replyTo={unanswered}
              />
            </PanelBody>
          </Panel>
        ) : (
          <Panel title="Post an entry">
            <PanelBody>
              <p className="text-[12.5px] leading-[1.7] text-ink/58">
                Notes and replies on this claim are written by the owner, the
                assigned adjuster, and the assistant.
              </p>
            </PanelBody>
          </Panel>
        )}

        <Panel title="Who reads what">
          <PanelBody>
            <dl className="grid gap-[11px] text-[12.5px] leading-[1.6]">
              <div>
                <dt className="text-ink/72">CMG only</dt>
                <dd className="text-ink/55">
                  Stays inside the firm. Nothing leaves the workspace.
                </dd>
              </div>
              <div>
                <dt className="text-ink/72">Homeowner</dt>
                <dd className="text-ink/55">
                  Appears in their portal and is emailed to them.
                </dd>
              </div>
              <div>
                <dt className="text-ink/72">Partner</dt>
                <dd className="text-ink/55">
                  Goes to the referring contractor, never to the homeowner.
                </dd>
              </div>
              <div>
                <dt className="text-ink/72">Homeowner + partner</dt>
                <dd className="text-ink/55">
                  A milestone both sides of the referral should know about.
                </dd>
              </div>
            </dl>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
