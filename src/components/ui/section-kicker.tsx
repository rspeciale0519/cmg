import { cx } from "@/lib/cx";

export type SectionKickerProps = {
  label: string;
  className?: string;
};

export function SectionKicker({ label, className }: SectionKickerProps) {
  return (
    <div className={cx("flex items-center gap-[14px]", className)}>
      <span aria-hidden="true" className="h-px w-10 flex-none bg-accent" />
      <span className="text-xs uppercase tracking-[0.2em] text-accent-300">
        {label}
      </span>
    </div>
  );
}
