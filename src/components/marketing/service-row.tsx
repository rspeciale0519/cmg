import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type ServiceRowProps = {
  index: string;
  title: string;
  className?: string;
  children: ReactNode;
};

/* Below 861px the prototype drops the third track and tucks the description
   under the title, keeping it aligned to the same optical margin. */
export function ServiceRow({
  index,
  title,
  className,
  children,
}: ServiceRowProps) {
  return (
    <div
      className={cx(
        "grid grid-cols-[minmax(40px,56px)_minmax(0,1fr)] items-start gap-x-[clamp(20px,3vw,56px)] gap-y-3 border-t border-ink/11 py-[clamp(28px,3.5vw,44px)] last:border-b",
        "min-[861px]:grid-cols-[minmax(48px,88px)_minmax(0,1fr)_minmax(0,1.35fr)]",
        className,
      )}
    >
      <span className="text-xs leading-[1.9] tracking-[0.16em] text-accent tabular-nums">
        {index}
      </span>
      <h2 className="text-[clamp(22px,2.4vw,30px)] font-medium leading-[1.15] tracking-[-0.025em]">
        {title}
      </h2>
      <p className="col-start-2 max-w-[54ch] text-base leading-[1.75] text-ink/72 min-[861px]:col-start-3">
        {children}
      </p>
    </div>
  );
}
