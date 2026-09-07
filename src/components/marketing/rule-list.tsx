import { cx } from "@/lib/cx";

/* Zero column gap is the point, not an oversight. The row's structure is one
   unbroken hairline running the full 1248px field, and a column gap cuts that
   rule into one stub per track — four separated segments on the home list, two
   orphaned stubs beside ~600px of empty canvas on the region list.

   A previous pass widened both floors to open a 10px gap between "Orlando &
   Central Florida" (198px) and "Tampa Bay", and paid for it with a 4+2 wrap
   and a broken rule. The tight pair is the smaller fault: the only lever that
   widens it without a column gap is tighter label tracking, and that is a
   deviation of its own on a set the prototype specifies at -0.01em. Both
   floors are therefore the prototype's own values.

   `region` — 180px floor: six tracks of 208px on one row at 1440.
   `quad`   — 190px floor: six tracks of 208px, eight labels, so 6+2. */
const TRACK = {
  region: "grid-cols-[repeat(auto-fit,minmax(180px,1fr))]",
  quad: "grid-cols-[repeat(auto-fit,minmax(190px,1fr))]",
} as const;

/* Hairline weight and row rhythm both change with the surface: the canvas
   rows sit on an 11% rule, the section-brown rows need 22% to read at all. */
const TONE = {
  canvas: { rule: "border-ink/11", row: "py-5" },
  section: { rule: "border-ink/22", row: "py-[18px]" },
} as const;

export type RuleListItem = {
  readonly label: string;
  readonly muted?: boolean;
};

export type RuleListProps = {
  items: readonly RuleListItem[];
  label: string;
  track?: keyof typeof TRACK;
  tone?: keyof typeof TONE;
  className?: string;
};

export function RuleList({
  items,
  label,
  track = "quad",
  tone = "canvas",
  className,
}: RuleListProps) {
  const surface = TONE[tone];

  return (
    <ul aria-label={label} className={cx("grid", TRACK[track], className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className={cx(
            "border-t text-[17px] leading-[1.55] tracking-[-0.01em]",
            surface.rule,
            surface.row,
            item.muted ? "text-ink/55" : null,
          )}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}
