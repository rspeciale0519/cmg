import { cx } from "@/lib/cx";
import { STATUS_LABEL, STATUS_TONE, type ClaimStatus, type StatusTone } from "@/lib/claims/status";

/**
 * Four tones, and the accent is spent on exactly two statuses — the ones where
 * a person has to do something (a new intake nobody owns, an offer nobody has
 * answered) plus a reopened file. If every in-flight status wore gold the
 * colour would carry no information and the table would read as uniformly
 * urgent, which is the same as uniformly calm.
 *
 * No dot, no icon: the label is the content, and a coloured disc beside a
 * coloured word is the same fact twice.
 *
 * `resolved` is deliberately the darkest of the four, and that is the fix for
 * the one real weakness in this system. It used to be `bronze-300` (#d9c3a8)
 * against `attention`'s `accent-300` (#ebdaaf) — ΔE00 7.9, by some distance
 * the closest pair here, where every other pairing sits between 10.9 and 20.2.
 * It was also the pair the reader meets *adjacent*: "Settlement offered" is
 * followed by "Settled", so the two colours that had to be told apart at a
 * glance were the two that were nearly the same light tan.
 *
 * Dropping to `bronze-400` on a deeper `bronze-700` wash separates them on
 * lightness rather than on hue, which keeps the palette entirely inside the
 * brand's gold/bronze ramp and adds no fifth colour. It also says the right
 * thing: a settled or closed claim is finished, and finished work should sit
 * back from a table of live ones rather than glow next to them.
 */
const TONE_CLASS: Record<StatusTone, string> = {
  attention: "border-accent/40 bg-accent/12 text-accent-300",
  active: "border-ink/16 bg-ink/6 text-ink/78",
  resolved: "border-bronze-600/50 bg-bronze-700/24 text-bronze-400",
  halted: "border-[#E08C6A]/40 bg-[#E08C6A]/10 text-[#E8A98D]",
};

export function StatusPill({
  status,
  className,
}: {
  status: ClaimStatus;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[11px] font-medium leading-[1.45] tracking-[0.01em]",
        TONE_CLASS[STATUS_TONE[status]],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** The same four tones one surface along — `converted` tracks `resolved`. */
const LEAD_TONE: Record<string, string> = {
  new: "border-accent/40 bg-accent/12 text-accent-300",
  contacted: "border-ink/16 bg-ink/6 text-ink/78",
  converted: "border-bronze-600/50 bg-bronze-700/24 text-bronze-400",
  dismissed: "border-ink/12 bg-transparent text-ink/42",
};

const LEAD_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  dismissed: "Dismissed",
};

export function LeadPill({ status }: { status: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[11px] font-medium leading-[1.45]",
        LEAD_TONE[status] ?? LEAD_TONE.contacted,
      )}
    >
      {LEAD_LABEL[status] ?? status}
    </span>
  );
}

const VISIBILITY_LABEL: Record<string, string> = {
  internal: "CMG only",
  customer: "Homeowner",
  partner: "Partner",
  shared: "Homeowner + partner",
};

/**
 * Visibility is stated as an audience, never as the enum. "internal" is a
 * database word; "CMG only" is what a staff member needs to know before they
 * type something the homeowner will read.
 */
export function VisibilityTag({ visibility }: { visibility: string }) {
  const isPrivate = visibility === "internal";

  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap text-[11px] leading-[1.45] tracking-[0.04em]",
        isPrivate ? "text-ink/38" : "text-accent/78",
      )}
    >
      {VISIBILITY_LABEL[visibility] ?? visibility}
    </span>
  );
}

/**
 * The claim reference, everywhere it appears. Tabular figures and a fixed
 * tracking so a column of them forms a true vertical edge — `CMG-2026-0011`
 * and `CMG-2026-0002` are the same width only if the digits are.
 */
export function ClaimRef({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "whitespace-nowrap font-medium tabular-nums tracking-[0.01em]",
        className,
      )}
    >
      {value}
    </span>
  );
}
