import { cx } from "@/lib/cx";

export type SectionKickerProps = {
  label: string;
  className?: string;
};

export function SectionKicker({ label, className }: SectionKickerProps) {
  return (
    /* The rule is set against the label's *first line*, not against the
       label's box. `items-center` is identical to this for a one-line label,
       but the home hero's "Licensed Florida public adjusters" takes two lines
       at 390 and the centred rule landed in the gap between them, attached to
       neither. `1.55em` on a 12px rule is one line of the label beside it, so
       `(1.55em - 1px) / 2` is that line's optical centre at every width — the
       same 8.8px `items-center` was already producing on one line. */
    <div className={cx("flex items-start gap-[14px]", className)}>
      <span
        aria-hidden="true"
        className="mt-[calc((1.55em-1px)/2)] h-px w-10 flex-none bg-accent text-xs"
      />
      <span className="text-xs uppercase leading-[1.55] tracking-[0.2em] text-accent-300">
        {label}
      </span>
    </div>
  );
}
