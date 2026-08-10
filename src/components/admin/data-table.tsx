import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * A real `<table>`, not a grid of divs. Row and column relationships are the
 * content here, and a screen reader announcing "row 4, Status, Filed" is worth
 * more than any layout convenience — `display: grid` on a table element throws
 * that away in several browsers, so the table stays a table and the widths are
 * `table-fixed` plus explicit column classes.
 *
 * The horizontal scroll lives on the wrapper rather than the page: a claims
 * table that pushes the whole document sideways takes the nav with it.
 */
export function DataTable({
  head,
  children,
  caption,
}: {
  head: ReactNode;
  children: ReactNode;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-ink/10">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={cx(
        "px-[clamp(10px,1.1vw,14px)] py-[9px] text-[11px] font-medium uppercase leading-[1.4] tracking-[0.13em] text-ink/40",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

/**
 * Rows are separated by a hairline and lit on hover, never striped. Zebra
 * striping on a dark surface at this density reads as two different kinds of
 * row; the hover fill says "this one" without implying anything about the
 * others.
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
        "border-b border-ink/8 transition-colors duration-150 last:border-b-0 hover:bg-ink/[0.045]",
        // `focus-within` matters as much as hover: the row link is what a
        // keyboard lands on, and without this the only feedback is the link's
        // own focus ring floating in an unmarked row.
        "focus-within:bg-ink/[0.045]",
        className,
      )}
    >
      {children}
    </tr>
  );
}

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

/** Secondary text inside a cell — the address under a name, the city under a street. */
export function CellMeta({ children }: { children: ReactNode }) {
  return (
    <span className="mt-[2px] block truncate text-[12px] leading-[1.4] text-ink/42">
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
    <div className={cx("min-w-0", wide && "sm:col-span-2 lg:col-span-3")}>
      <dt className="text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/38">
        {label}
      </dt>
      <dd className="mt-[5px] text-[14px] leading-[1.55] text-ink/85">{children}</dd>
    </div>
  );
}
