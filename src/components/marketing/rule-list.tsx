import { cx } from "@/lib/cx";

const TRACK = {
  sm: "grid-cols-[repeat(auto-fit,minmax(180px,1fr))]",
  md: "grid-cols-[repeat(auto-fit,minmax(190px,1fr))]",
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
  track = "md",
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
