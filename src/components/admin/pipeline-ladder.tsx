import Link from "next/link";
import {
  BRANCH_STATUSES,
  PIPELINE,
  STATUS_LABEL,
  type ClaimStatus,
} from "@/lib/claims/status";
import { cx } from "@/lib/cx";

export type StatusCounts = Partial<Record<ClaimStatus, number>>;

/**
 * The dashboard's lead, and the one place this workspace spends its boldness.
 *
 * Every claims tool opens on stat cards — total open, settled this month, a
 * chart. Those answer questions about the business. An adjuster opening this
 * page has a different question, and it is always the same one: *where is the
 * work sitting today*. The lifecycle in spec §5 already answers it, and it is
 * not decoration imported onto the page — it is the same ten values
 * `public.allowed_claim_transitions()` moves a claim between, drawn in order.
 *
 * Ordinals are used here and nowhere else in the product, because this content
 * genuinely is a sequence: stage 07 comes after 06 for a reason a homeowner
 * would recognise, and the order is the information. Each stage is a segment of
 * one rule, so the row reads as a single pipeline with work distributed along
 * it rather than as ten cards that happen to be adjacent — gold where claims
 * are waiting, hairline where the stage is empty.
 */
export function PipelineLadder({ counts }: { counts: StatusCounts }) {
  const branchTotal = BRANCH_STATUSES.reduce(
    (total, status) => total + (counts[status] ?? 0),
    0,
  );

  return (
    <section aria-labelledby="pipeline-heading">
      <h2 id="pipeline-heading" className="sr-only">
        Claims by stage
      </h2>

      {/* The row becomes a grid below `lg`, and that is the whole fix rather
          than a responsive flourish. As one 860px row in a 358px scroller the
          phone showed stages 01–04, every one of them reading `0`, while both
          claims in the business sat at 08 and 09 — 262px and 348px past the
          right edge, with no scrollbar and no edge fade to say so. The element
          whose stated job is "where is the work sitting today" answered
          "nowhere". Ten stages cannot be legible side by side at 390: at 33px
          each, "Settlement offered" is a column of single letters. So they
          wrap — two up on a phone, five up on a tablet, and the single rule
          the row is a segment of only from `lg`, where it fits without
          scrolling. `scroll-x-edged` stays as the floor for a zoomed or narrow
          desktop window, and it is the utility rather than a bare
          `overflow-x-auto` so that a strip which does scroll says so. */}
      <div className="scroll-x-edged [--panel-fill:var(--color-canvas)]">
        <ol className="grid grid-cols-2 gap-x-[3px] gap-y-[22px] sm:grid-cols-5 lg:flex lg:min-w-[860px] lg:items-stretch lg:gap-[3px]">
          {PIPELINE.map((status, index) => (
            <Stage
              key={status}
              status={status}
              index={index + 1}
              count={counts[status] ?? 0}
            />
          ))}
        </ol>
      </div>

      {branchTotal > 0 ? (
        <p className="mt-[18px] flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] leading-[1.5] text-ink/55">
          <span className="text-[11px] uppercase tracking-[0.13em] text-ink/58">
            Off the line
          </span>
          {BRANCH_STATUSES.filter((status) => (counts[status] ?? 0) > 0).map((status) => (
            <Link
              key={status}
              href={`/admin/claims?status=${status}`}
              className="text-ink/62 no-underline transition-colors duration-150 hover:text-ink"
            >
              <span className="tabular-nums">{counts[status]}</span>{" "}
              {STATUS_LABEL[status].toLowerCase()}
            </Link>
          ))}
        </p>
      ) : null}
    </section>
  );
}

function Stage({
  status,
  index,
  count,
}: {
  status: ClaimStatus;
  index: number;
  count: number;
}) {
  const occupied = count > 0;

  return (
    <li className="lg:flex-1">
      <Link
        href={`/admin/claims?status=${status}`}
        className="group block no-underline"
      >
        <span
          aria-hidden="true"
          className={cx(
            "block h-[3px] w-full transition-colors duration-200",
            occupied
              ? "bg-accent group-hover:bg-accent-300"
              : "bg-ink/12 group-hover:bg-ink/25",
          )}
        />
        <span
          className={cx(
            "mt-[11px] block text-[10px] leading-none tabular-nums tracking-[0.14em] transition-colors duration-200",
            /* The ordinal follows `occupied` like the count and the label do.
               It was pinned at `ink/28` — the tier reserved for the em-dash that
               means "nothing here" — on every stage including the two holding
               work, so the one span that carries "the order is the information"
               was the one span that never joined the distinction. 2.30:1
               against 5.49:1. */
            occupied ? "text-ink/62" : "text-ink/28",
          )}
        >
          {String(index).padStart(2, "0")}
        </span>
        <span
          className={cx(
            "mt-[7px] block text-[22px] leading-none tabular-nums transition-colors duration-200",
            occupied ? "text-ink" : "text-ink/22",
          )}
        >
          {count}
        </span>
        <span
          className={cx(
            "mt-[7px] block text-[11.5px] leading-[1.35] transition-colors duration-200",
            occupied ? "text-ink/62 group-hover:text-ink/85" : "text-ink/32",
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      </Link>
    </li>
  );
}
