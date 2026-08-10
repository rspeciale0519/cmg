import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { AuditFilters } from "@/components/admin/audit-filters";
import { AuditMeta } from "@/components/admin/audit-meta";
import {
  AUDIT_PAGE_SIZE,
  hasActiveFilters,
  loadActorOptions,
  loadAuditPage,
  readAuditFilters,
  type AuditEntry,
} from "@/lib/admin/audit";
import { actionLabel, entityLabel, splitAction } from "@/lib/admin/audit-vocabulary";
import { requireRole } from "@/lib/authz";
import { cx } from "@/lib/cx";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit",
  robots: { index: false, follow: false },
};

/**
 * Owner only — `audit_log_select_owner` is the only policy on the table, and
 * `requireRole("owner")` answers everyone else with `notFound()` (spec §7.9).
 *
 * The table is append-only by construction: no UPDATE or DELETE policy exists on
 * it and `authenticated` holds no grant beyond SELECT, so this screen is a
 * reader and there is nothing here that could edit an entry.
 *
 * Reverse-chronological, keyset-paged on the primary key. See `loadAuditPage`
 * for why the cursor is the id rather than the timestamp — briefly, `created_at`
 * is transaction start time and can tie, and a `<` cursor on a tied value drops
 * whichever row sat on the page boundary.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("owner");

  const raw = await searchParams;
  const filters = readAuditFilters(raw);

  const [page, actors] = await Promise.all([
    loadAuditPage(filters),
    loadActorOptions(),
  ]);

  const filtered = hasActiveFilters(filters);
  const paged = filters.before !== null || filters.after !== null;

  function pageHref(cursor: "before" | "after", id: number): string {
    const params = new URLSearchParams();
    if (filters.action) params.set("action", filters.action);
    if (filters.entity) params.set("entity", filters.entity);
    if (filters.actor) params.set("actor", filters.actor);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set(cursor, String(id));
    return `/admin/audit?${params.toString()}`;
  }

  return (
    <>
      <PageHeader
        eyebrow="Owner · newest first"
        title="Audit trail."
        lede="Every change the database and the app record: who did it, what it was before, and what it became. Entries are written by triggers and by the app, and nothing in this product can edit or remove one."
      />

      <AuditFilters actors={actors} />

      <Panel
        title={filtered ? "Matching entries" : "All activity"}
        meta={
          page.entries.length === 0
            ? undefined
            : page.entries.length === AUDIT_PAGE_SIZE
              ? `${AUDIT_PAGE_SIZE} shown`
              : `${page.entries.length} shown`
        }
      >
        {page.entries.length === 0 ? (
          <EmptyState
            headline={filtered ? "Nothing matches those filters." : "Nothing recorded yet."}
          >
            {filtered
              ? "Widen the date range, or clear the filters to see the whole trail."
              : "Accepting an intake, advancing a status, issuing an invitation or opening a document all leave an entry here."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink/8">
            {page.entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </Panel>

      {page.entries.length > 0 && (page.olderThan || page.newerThan || paged) ? (
        <nav
          aria-label="Audit pages"
          className="flex items-center justify-between gap-4 pt-[clamp(14px,1.6vw,20px)]"
        >
          <PageLink href={page.newerThan ? pageHref("after", page.newerThan) : null}>
            ← Newer
          </PageLink>

          {paged ? (
            <Link
              href="/admin/audit"
              className="text-[12.5px] leading-[1.4] text-ink/45 no-underline transition-colors duration-150 hover:text-accent"
            >
              Back to newest
            </Link>
          ) : (
            <span />
          )}

          <PageLink href={page.olderThan ? pageHref("before", page.olderThan) : null}>
            Older →
          </PageLink>
        </nav>
      ) : null}
    </>
  );
}

/**
 * A timestamp spine down the left, then the event. Chronology is the axis this
 * page is read on, so the times form one straight tabular-numeral column the eye
 * can run down; everything else hangs off it.
 *
 * The action is split at the dot: the subject repeats for pages at a time and
 * recedes, while the event is what the reader is scanning for and carries the
 * weight. That is a fact the data already encodes — `claims.update` really is a
 * subject and a verb — rather than a decoration applied to it.
 */
function AuditRow({ entry }: { entry: AuditEntry }) {
  const { family } = splitAction(entry.action);
  const href = subjectHref(entry);

  return (
    <li className="grid gap-x-5 gap-y-[6px] px-[clamp(14px,1.6vw,20px)] py-[13px] transition-colors duration-150 hover:bg-ink/[0.03] md:grid-cols-[112px_minmax(0,1fr)]">
      <div className="flex items-baseline gap-x-2 md:block">
        <time
          dateTime={entry.createdAt}
          className="block text-[13px] leading-[1.4] tabular-nums text-ink/78"
        >
          {clockTime(entry.createdAt)}
        </time>
        <span className="block text-[11.5px] leading-[1.5] tabular-nums text-ink/38">
          {dayStamp(entry.createdAt)}
        </span>
      </div>

      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-[2px] text-[13px] leading-[1.45]">
          <span className="font-medium text-ink">{actionLabel(entry.action)}</span>
          <span className="text-[11px] uppercase tracking-[0.13em] text-ink/32">
            {family || entityLabel(entry.entity)}
          </span>
          {href ? (
            <Link
              href={href}
              className="text-[12px] text-accent/85 no-underline transition-colors duration-150 hover:text-accent-300"
            >
              open
            </Link>
          ) : null}
        </p>

        <p className="mt-[2px] flex flex-wrap items-baseline gap-x-2 text-[12.5px] leading-[1.5]">
          {entry.actorName ? (
            <>
              <span className="text-ink/62">{entry.actorName}</span>
              <span className="text-[11px] uppercase tracking-[0.13em] text-ink/30">
                {entry.actorRole}
              </span>
            </>
          ) : entry.actorId ? (
            /* An id with no profile. `audit_log` holds no foreign key precisely
               so that deleting a person cannot rewrite history, so this is the
               expected end state for a departed account — not an error. */
            <span className="font-mono text-[11.5px] text-ink/38">
              {entry.actorId}
            </span>
          ) : (
            <span className="text-ink/38">System</span>
          )}
          {entry.ip ? (
            <span className="tabular-nums text-[11.5px] text-ink/28">{entry.ip}</span>
          ) : null}
        </p>

        <AuditMeta meta={entry.meta} />
      </div>
    </li>
  );
}

/**
 * The two subjects that have a screen to open. Everything else stays plain: a
 * link that leads to a route which does not exist is worse than no link.
 */
function subjectHref(entry: AuditEntry): string | null {
  if (!entry.entityId) return null;
  if (entry.entity === "claims") return `/admin/claims/${entry.entityId}`;
  if (entry.entity === "partner_companies") return `/admin/partners/${entry.entityId}`;
  return null;
}

function PageLink({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span
        aria-hidden="true"
        className="text-[12.5px] leading-[1.4] text-ink/20"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cx(
        "min-h-[34px] rounded-md border border-ink/16 px-3 py-[7px] text-[12.5px] leading-[1.4] text-ink/78 no-underline",
        "transition-colors duration-150 hover:border-ink/32 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Fixed to the business's zone, matching `formatTimestamp` — two staff reading
 * the same entry must see the same clock, and one of them travelling must not
 * change what the log says happened when.
 */
const BUSINESS_TIME_ZONE = "America/New_York";

const CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  month: "short",
  day: "2-digit",
});

function clockTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : CLOCK.format(date);
}

function dayStamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : DAY.format(date);
}
