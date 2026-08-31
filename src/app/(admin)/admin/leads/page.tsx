import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { LeadStatusForm } from "@/components/admin/lead-status-form";
import { ListPager } from "@/components/admin/list-pager";
import { LeadPill } from "@/components/admin/status-pill";
import { pageCursors } from "@/lib/admin/audit-range";
import { requireStaff } from "@/lib/authz";
import { formatRelative, formatTimestamp } from "@/lib/format";
import {
  formatLeadCursor,
  leadCursorFrom,
  leadKeysetClause,
  LEADS_PAGE_SIZE,
  parseLeadCursor,
} from "@/lib/leads/list";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database-app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

type LeadStatus = Database["public"]["Enums"]["lead_status"];

const FILTERS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
  { value: "dismissed", label: "Dismissed" },
] as const satisfies readonly { value: "" | LeadStatus; label: string }[];

function isLeadStatus(value: string): value is LeadStatus {
  return value === "new" || value === "contacted" || value === "converted" || value === "dismissed";
}

/**
 * A list rather than a table: a lead is mostly a paragraph, and the paragraph
 * is the reason to call the person back. Truncating it into a cell would hide
 * the only field that tells the operator what the call is about.
 *
 * §4 gives adjusters read on leads and writes to the owner and assistant, so
 * the status control is simply absent for an adjuster — `leads_update_staff`
 * would return zero rows, and a save button that never saves is worse than no
 * button.
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaff("/admin/leads");
  const raw = await searchParams;
  const first = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const statusParam = first("status");
  const status = FILTERS.some((filter) => filter.value === statusParam)
    ? (statusParam ?? "")
    : "";

  // Forward wins if both are present: a URL carrying two cursors is hand-made,
  // and honouring the one that means "onwards" is the harmless reading.
  const forward = parseLeadCursor(first("next"));
  const backward = forward ? null : parseLeadCursor(first("prev"));
  const cursor = forward ?? backward;

  // Paging backwards means walking the opposite way from the cursor and
  // reversing the window, so the reader still sees newest-first on every page.
  const reversed = backward !== null;
  const ascending = reversed;

  const supabase = await createClient();

  /**
   * The one filter the reader can set, applied to both the page query and the
   * total-count query so the two can never disagree about what "matching"
   * means. Written as a method type so the concrete builder — whose `eq` is
   * keyed to the row's own column union — still satisfies it.
   */
  function applyFilter<Q extends { eq(column: string, value: string): Q }>(query: Q): Q {
    return isLeadStatus(status) ? query.eq("status", status) : query;
  }

  let query = applyFilter(
    supabase.from("leads").select("id, name, phone, email, message, status, created_at"),
  )
    .order("created_at", { ascending })
    // The tie-break is what makes the cursor safe; ordering on it is what makes
    // the cursor *match* the order.
    .order("id", { ascending })
    .limit(LEADS_PAGE_SIZE + 1);

  if (cursor) query = query.or(leadKeysetClause(ascending ? "asc" : "desc", cursor));

  // The total is counted without the keyset predicate. Folding it into the main
  // query would make `count` mean "matches on this page and after it", so the
  // header would count down as the reader paged — the opposite of what a total
  // is for.
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    query,
    applyFilter(supabase.from("leads").select("id", { count: "exact", head: true })),
  ]);

  if (error) console.error("[leads] list query failed", error.message);
  if (countError) console.error("[leads] count query failed", countError.message);

  const fetched = data ?? [];
  const hasMore = fetched.length > LEADS_PAGE_SIZE;
  const window = fetched.slice(0, LEADS_PAGE_SIZE);
  const leads = reversed ? [...window].reverse() : window;
  const total = count ?? leads.length;
  const canEdit = session.role === "owner" || session.role === "assistant";

  const { olderThan: nextCursor, newerThan: prevCursor } = pageCursors({
    ids: leads.map((lead) => formatLeadCursor(leadCursorFrom(lead))),
    hasMore,
    ascending: reversed,
    cameFromCursor: cursor !== null,
  });

  /** Rebuilt from the parsed filter, so a junk parameter never survives a click. */
  function href(extra?: Record<string, string>): string {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
    const query = params.toString();
    return query ? `/admin/leads?${query}` : "/admin/leads";
  }

  const paged = cursor !== null;

  return (
    <>
      <PageHeader
        eyebrow={`${total} ${status || "total"}`}
        title="Leads."
        lede={
          canEdit
            ? "Enquiries from the contact form. Mark one contacted when you have called back, converted when it becomes a claim."
            : "Enquiries from the contact form, read-only. The owner and the assistant work this list."
        }
      />

      <nav aria-label="Filter leads" className="flex flex-wrap gap-1 pb-[clamp(14px,1.6vw,20px)]">
        {FILTERS.map((filter) => {
          const active = status === filter.value;
          return (
            <Link
              key={filter.value}
              href={filter.value ? `/admin/leads?status=${filter.value}` : "/admin/leads"}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-md border border-accent/45 bg-accent/12 px-[11px] py-[6px] text-[12.5px] leading-[1.4] text-accent no-underline"
                  : "rounded-md border border-transparent px-[11px] py-[6px] text-[12.5px] leading-[1.4] text-ink/55 no-underline transition-colors duration-150 hover:border-ink/14 hover:text-ink"
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <Panel>
        {leads.length === 0 ? (
          paged ? (
            <EmptyState headline="You have reached the end of the list.">
              <Link href={href()} className="text-accent no-underline hover:text-accent-300">
                Back to the start
              </Link>
            </EmptyState>
          ) : (
            <EmptyState headline={status ? `Nothing ${status}.` : "No enquiries yet."}>
              Submissions from the contact form arrive here with the caller&rsquo;s
              number and what they wrote.
            </EmptyState>
          )
        ) : (
          <ul className="divide-y divide-ink/8">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className="px-[clamp(14px,1.6vw,20px)] py-[15px] transition-colors duration-150 hover:bg-ink/[0.03]"
              >
                {/* `basis-[240px]` is what makes `flex-wrap` above mean
                    anything. `min-w-0` is needed — an email address is a single
                    unbreakable token and without it the row grew wider than the
                    phone — but it also removes the floor the wrap decision is
                    made against, so at 390 the row never wrapped: the enquiry
                    took 111.5px and the status control beside it took 192.5px,
                    and the message set seven lines of about sixteen characters
                    while the address broke as `rosa.delgado@exa` / `mple.test`.
                    The control that acts on a lead was 73% wider than the lead.
                    A basis states the width the column wants; the row now breaks
                    at 390 and the column takes the full 328. */}
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1 basis-[240px]">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-[14px] font-medium leading-[1.35] tracking-[-0.01em]">
                        {lead.name}
                      </h2>
                      <LeadPill status={lead.status} />
                      <time
                        dateTime={lead.created_at}
                        title={formatTimestamp(lead.created_at)}
                        className="text-[12px] leading-[1.4] text-ink/58"
                      >
                        {formatRelative(lead.created_at)}
                      </time>
                    </div>

                    {/* `min-w-0` on the address, and wrapping rather than
                        truncation. These are flex items, so their default
                        `min-width: auto` is their whole content width: an
                        address longer than the column pushed the row wider than
                        the phone could show instead of wrapping, and the tail
                        of it was clipped by `body { overflow-x: clip }`. Half an
                        email address is worse than none — it looks like an
                        address and cannot be used as one — so it breaks across
                        lines instead. */}
                    <p className="mt-[5px] flex flex-wrap gap-x-4 text-[12.5px] leading-[1.5] text-ink/58">
                      <a
                        href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
                        className="tap-block tabular-nums text-ink/72 no-underline transition-colors duration-150 hover:text-accent"
                      >
                        {lead.phone}
                      </a>
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="tap-block min-w-0 [overflow-wrap:anywhere] text-ink/72 no-underline transition-colors duration-150 hover:text-accent"
                        >
                          {lead.email}
                        </a>
                      ) : null}
                    </p>

                    {lead.message ? (
                      <p className="mt-[9px] max-w-[86ch] whitespace-pre-line text-[13px] leading-[1.65] text-ink/72">
                        {lead.message}
                      </p>
                    ) : (
                      <p className="mt-[9px] text-[13px] leading-[1.6] text-ink/58">
                        No message left.
                      </p>
                    )}
                  </div>

                  <LeadStatusForm
                    leadId={lead.id}
                    status={lead.status}
                    canEdit={canEdit}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {leads.length > 0 ? (
        <ListPager
          label="Lead pages"
          noun="lead"
          pluralNoun="leads"
          shown={leads.length}
          total={total}
          prevHref={prevCursor ? href({ prev: prevCursor }) : null}
          nextHref={nextCursor ? href({ next: nextCursor }) : null}
          startHref={paged ? href() : null}
        />
      ) : null}
    </>
  );
}
