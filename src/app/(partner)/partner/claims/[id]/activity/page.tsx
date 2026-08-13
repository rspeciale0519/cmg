import type { Metadata } from "next";
import { PortalPager } from "@/components/portal/pager";
import { EmptyState, Panel } from "@/components/portal/surfaces";
import { pageCursors } from "@/lib/admin/audit-range";
import { formatTimestamp } from "@/lib/format";
import {
  firstParam,
  formatTimeCursor,
  pageSlice,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
} from "@/lib/paging";
import { requirePartnerClaim } from "@/lib/partner/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner activity" };

const PAGE_SIZE = 20;
const TYPE_LABEL: Record<string, string> = {
  status: "Status update",
  system: "CMG update",
  note: "From CMG",
  question: "Question",
  reply: "Reply",
  document: "Document update",
};

export default async function PartnerActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await requirePartnerClaim(id);
  const raw = await searchParams;
  const forward = parseTimeCursor(firstParam(raw, "next"));
  const backward = forward ? null : parseTimeCursor(firstParam(raw, "prev"));
  const cursor = forward ?? backward;
  const reversed = backward !== null;
  const supabase = await createClient();

  // RLS is the audience filter: a partner receives only partner/shared events
  // on a claim attributed to their active company. Do not duplicate it here.
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
    supabase.from("claim_events").select("id", { count: "exact", head: true }).eq("claim_id", id),
  ]);
  if (events.error) throw new Error(`Partner activity could not be loaded: ${events.error.message}`);
  if (count.error) throw new Error(`Partner activity count could not be loaded: ${count.error.message}`);

  const page = pageSlice(events.data ?? [], PAGE_SIZE, reversed);
  const rows = page.rows;
  const { olderThan, newerThan } = pageCursors({
    ids: rows.map((event) => formatTimeCursor(timeCursorFrom(event))),
    hasMore: page.hasMore,
    ascending: reversed,
    cameFromCursor: cursor !== null,
  });
  const base = `/partner/claims/${id}/activity`;

  return (
    <Panel title="Updates shared with your company">
      {rows.length === 0 ? (
        <EmptyState headline="No partner updates have been posted yet.">
          When CMG shares progress with your company, it appears here newest first.
        </EmptyState>
      ) : (
        <>
          <ol className="divide-y divide-ink/8">
            {rows.map((event) => (
              <li key={event.id} className="px-[clamp(18px,2.4vw,28px)] py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-accent">
                    {TYPE_LABEL[event.type] ?? "Update"}
                  </p>
                  <time dateTime={event.created_at} className="text-[12px] text-ink/58">
                    {formatTimestamp(event.created_at)}
                  </time>
                </div>
                <p className="mt-2 max-w-[70ch] whitespace-pre-line text-[14.5px] leading-[1.75] text-ink/85">
                  {event.body}
                </p>
              </li>
            ))}
          </ol>
          <PortalPager
            label="Partner activity pages"
            noun="update"
            pluralNoun="updates"
            shown={rows.length}
            total={count.count ?? rows.length}
            prevHref={newerThan ? `${base}?prev=${newerThan}` : null}
            nextHref={olderThan ? `${base}?next=${olderThan}` : null}
            startHref={cursor ? base : null}
          />
        </>
      )}
    </Panel>
  );
}
