import type { PartnerStatus } from "@/lib/admin/partners";
import { cx } from "@/lib/cx";

/**
 * The same pill metrics as `StatusPill`, on the two tones a company can be in.
 * Active borrows the `resolved` bronze rather than the accent: a working
 * relationship is the settled state, and gold in this workspace means "someone
 * has to do something" (see the tone table in `status-pill.tsx`). Inactive is
 * drawn down to the muted outline instead of a red — ending a partnership is an
 * ordinary business event, not a fault.
 */
export function PartnerStatusPill({
  status,
  className,
}: {
  status: PartnerStatus;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[11px] font-medium leading-[1.45]",
        status === "active"
          ? "border-bronze-400/38 bg-bronze-500/12 text-bronze-300"
          : "border-ink/12 text-ink/55",
        className,
      )}
    >
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

/**
 * A count where zero is the quiet, ordinary case. Renders as a hairline dash
 * rather than "0" — the same idiom the nav's queue badges use, so a column of
 * counts reads as "these two have something" instead of as a wall of numerals.
 */
export function CountCell({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span aria-hidden="true" className="text-ink/22">
        —
      </span>
    );
  }

  return <span className="tabular-nums text-ink/85">{value}</span>;
}
