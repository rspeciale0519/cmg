import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * A real `<table>`, not a grid of divs. Row and column relationships are the
 * content here, and a screen reader announcing "row 4, Status, Filed" is worth
 * more than any layout convenience — `display: grid` on a table element throws
 * that away in several browsers, so the table stays a table and the widths are
 * `table-fixed` plus explicit column classes.
 *
 * `table-fixed` is stated on the element rather than merely described in this
 * comment. It was described here and never applied, so the resolved
 * `table-layout` was `auto` and the `w-[132px]` on a header was a suggestion
 * the content could outvote — the Reference column measured 133.4px with the
 * webfont pending and 145px after it loaded, which moved every column to its
 * right on font swap. With `fixed`, the first row's declared widths are the
 * whole answer and the layout is decided before a glyph is measured.
 *
 * The horizontal scroll lives on the wrapper rather than the page: a claims
 * table that pushes the whole document sideways takes the nav with it. See
 * `scroll-x-edged` in `globals.css` for why the wrapper is not a bare
 * `overflow-x-auto`.
 *
 * `minWidth` is the floor the columns are designed against, and it is a prop
 * because the tables differ: four percentage columns work at any width, while
 * the seven-column claims list has 746px of fixed columns before its one
 * flexible column gets anything at all.
 */
export function DataTable({
  head,
  children,
  caption,
  minWidth = 860,
  stickyFirstColumn = true,
}: {
  head: ReactNode;
  children: ReactNode;
  caption?: string;
  minWidth?: number;
  /**
   * Pins the identifying first column while the rest scrolls. Default on,
   * because every table in this workspace opens with the thing the row *is* —
   * a claim reference, a person, a company — and the reviewer's measurement was
   * that at 390px the staff table is 860px wide in a 356px box with a 504px
   * scroll range, so past about 200px of travel the PERSON column is gone and
   * the row reads "Never / Deactivate" with nothing to attach it to.
   */
  stickyFirstColumn?: boolean;
}) {
  return (
    <div className="scroll-x-edged">
      <table
        style={{ minWidth: `${minWidth}px` }}
        className={cx(
          "w-full table-fixed border-collapse text-left",
          stickyFirstColumn && "sticky-first-col",
        )}
      >
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-ink/10">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/**
 * A column that can be ordered on. `state` is this column's *current*
 * participation in the sort, and `href` is the link that changes it — the
 * server decides the next direction, so the header never has to hold a second
 * copy of the toggle rule.
 */
export type ColumnSort = {
  href: string;
  state: "none" | "asc" | "desc";
  /** Announced on the link, e.g. "Sort by loss date, oldest first". */
  label: string;
};

const ARIA_SORT = {
  none: "none",
  asc: "ascending",
  desc: "descending",
} as const;

/**
 * Column headers sit at `ink/40` — 3.19:1 on the panel fill — and that is a
 * decision rather than an oversight, so it is written down here to stop it being
 * "fixed" on the next contrast pass.
 *
 * A header is not content. It is a persistent label for a column whose values
 * are the thing being read, it is 11px uppercase at 0.13em tracking so it is
 * unmistakable as structure, and its meaning is recoverable from the column
 * itself. Lifting it to the 4.5:1 tier would put it in the same visual register
 * as the data and make every table read as two competing grids. WCAG's own
 * carve-out for incidental and decorative text is narrower than this, so it is
 * being claimed knowingly, not leaned on.
 *
 * The em-dash placeholder used across these surfaces (`ink/28`, about 1.91:1) is
 * the same kind of decision one step further: it is not text at all but a mark
 * meaning "nothing here", it never carries information a reader needs to
 * extract, and at full strength it would draw the eye to every empty cell in a
 * table — the exact opposite of what an absence should do.
 *
 * What is *not* covered by either argument is a real value that happens to be
 * quiet. "Direct" in the REFERRED BY column is a fact about the claim — no
 * referring company — and it read at 2.56:1, below both. That one was raised.
 */
export function Th({
  children,
  className,
  align = "left",
  sort,
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
  sort?: ColumnSort;
}) {
  return (
    <th
      scope="col"
      aria-sort={sort ? ARIA_SORT[sort.state] : undefined}
      className={cx(
        "px-[clamp(10px,1.1vw,14px)] py-[9px] text-[11px] font-medium uppercase leading-[1.4] tracking-[0.13em] text-ink/40",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {sort ? (
        <Link
          href={sort.href}
          aria-label={sort.label}
          scroll={false}
          className={cx(
            /* The link fills the header cell rather than wrapping the glyph.
               Sized to the text it was 15.4px tall inside a 33.9px `th`, so
               the two-thirds of the cell a thumb naturally lands on did
               nothing — under the 24px WCAG 2.2 target floor, and the sort
               control is the header's whole purpose. The negative margins give
               the padding back, so the box grows without moving the label. */
            "group -my-[9px] flex items-center gap-[5px] py-[9px] text-inherit no-underline",
            "transition-colors duration-150 hover:text-ink/72",
            align === "right" ? "flex-row-reverse" : undefined,
            sort.state !== "none" && "text-ink/72",
          )}
        >
          {children}
          <SortGlyph state={sort.state} />
        </Link>
      ) : (
        children
      )}
    </th>
  );
}

/**
 * The sorted column shows a solid caret; the others show the same caret at a
 * whisper, brightening on hover and on keyboard focus. A header row where only
 * one column is visibly clickable teaches that the others are not.
 */
function SortGlyph({ state }: { state: ColumnSort["state"] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className={cx(
        "size-[9px] shrink-0 transition-[opacity,rotate] duration-150",
        state === "none"
          ? "opacity-0 group-hover:opacity-45 group-focus-visible:opacity-45"
          : "text-accent opacity-100",
        state === "asc" && "rotate-180",
      )}
    >
      <path d="M5 8L1 3h8z" fill="currentColor" />
    </svg>
  );
}

/**
 * Rows are separated by a hairline and lit on hover, never striped. Zebra
 * striping on a dark surface at this density reads as two different kinds of
 * row; the hover fill says "this one" without implying anything about the
 * others.
 *
 * The fill is `ink/8.5`, and the number is the point. At `ink/4.5` the hovered
 * row was 1.12:1 against the panel while the hairline that merely separates
 * two rows was 1.25:1 — so the incidental rule was louder than the deliberate
 * pointer, and on a 13" screen the hover simply did not register. `8.5%` puts
 * the fill at 1.27:1, just past the rule it has to out-argue. The rule stays
 * visible inside a hovered row because the border composites over the fill
 * rather than replacing it.
 */
export function Tr({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cx(
        "border-b border-ink/8 transition-colors duration-150 last:border-b-0 hover:bg-ink/[0.085]",
        // `focus-within` matters as much as hover: the row link is what a
        // keyboard lands on, and without this the only feedback is the link's
        // own focus ring floating in an unmarked row.
        "focus-within:bg-ink/[0.085]",
        className,
      )}
    >
      {children}
    </tr>
  );
}

/**
 * `align` is for *quantities* — a column of counts or money is read by
 * comparing magnitudes, and that needs a common right edge. Dates are not
 * quantities: these cells render words ("3d ago", "Aug 10, 2026", "Never"), and
 * right-aligning strings of unequal length just leaves a ragged left edge for
 * the eye to hunt along. Dates are therefore left-aligned everywhere in this
 * workspace, with `tabular-nums` so the digits inside them still line up. The
 * two claims tables used to right-align theirs and the three partner/staff
 * tables did not; this is the convention they were reconciled to.
 */
export function Td({
  children,
  className,
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <td
      className={cx(
        "px-[clamp(10px,1.1vw,14px)] py-[11px] text-[13px] leading-[1.45] text-ink/78 align-middle",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * Secondary text inside a cell — the address under a name, the city under a
 * street.
 *
 * `title` is not optional decoration here. These lines are `truncate`, and a
 * truncated cell inside a table whose own overflow is hidden is unrecoverable:
 * measured at 390px, the dashboard's property address clipped from 220px to
 * 102px, and scrolling the table sideways does not reveal it because the
 * clipping happens in the cell rather than in the scroller. Where the text is
 * generated from data, pass it.
 */
export function CellMeta({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="mt-[2px] block truncate text-[12px] leading-[1.4] text-ink/55"
    >
      {children}
    </span>
  );
}

/**
 * A label/value pair, used for every claim fact panel. `dl` semantics so the
 * relationship survives being read aloud.
 */
export function FactList({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
}) {
  return (
    <dl
      className={cx(
        "grid gap-x-8 gap-y-[15px]",
        columns === 1
          ? "grid-cols-1"
          : columns === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {children}
    </dl>
  );
}

export function Fact({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    /* `col-span-full` (`grid-column: 1 / -1`) rather than a hard `lg:col-span-3`,
       which assumed every list it lands in has three tracks. In the claim
       Overview's two-column list it forced an implicit third track and the grid
       charged a second 32px gap for it: "The loss" resolved to
       `451.5px 451.5px 0px` while "Policy and carrier" directly below it
       resolved to `467.5px 467.5px`, so the second column of two stacked panels
       sat 16px out of line and 32px of the row was dead. Spanning to the end of
       the explicit grid is the same instruction without the assumption. */
    <div className={cx("min-w-0", wide && "col-span-full")}>
      <dt className="text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/58">
        {label}
      </dt>
      <dd className="mt-[5px] text-[14px] leading-[1.55] text-ink/85">{children}</dd>
    </div>
  );
}
