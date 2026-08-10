import { cx } from "@/lib/cx";

/* Both lists ran at `column-gap: normal` — 0px — so a track only ever showed
   a gap when its label happened to be short, and the rhythm across a row was
   whatever the words left over. Each track now carries a real 40px column
   gap, and the track floors are set from the labels each list actually holds.

   `region` — six labels, the longest ("Orlando & Central Florida") 198px. Six
   tracks plus five 40px gaps only fit a 1248px field if the floor drops to
   ~174px, which wraps that label; four 282px tracks wrap the list 4+2 instead
   and leave every label its own column.

   `quad` — eight labels. An auto-fit track lays them out over six columns and
   leaves a ragged 6+2. Four fixed columns split them 4+4, and the ramp below
   halves that to 2+2+2+2 before going single-column. */
const TRACK = {
  region: "grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-10",
  quad: "grid-cols-1 gap-x-10 min-[560px]:grid-cols-2 min-[1000px]:grid-cols-4",
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
            "border-t text-[17px] tracking-[-0.01em]",
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
