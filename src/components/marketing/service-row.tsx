import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type ServiceRowProps = {
  index: string;
  title: string;
  className?: string;
  children: ReactNode;
};

/* Below 861px the prototype drops the third track and tucks the description
   under the title, keeping it aligned to the same optical margin.

   Below 560px the ordinal track goes too, and that is a deliberate, retained
   deviation on the same precedent as the card-title mobile floors documented
   at `globals.css:66-77` — craft may exceed the prototype where the prototype
   never resolved the phone. The prototype keeps the two-column rule to 0:
   at 390 a 56px track plus a 20px gutter spends 76px — 21.7% of the 350px
   content column — on a two-character ordinal, and the densest copy on the
   page set 32 characters a line against the 41 of the lede directly above it
   at the same size. It was also the only text on the page that left the x=20
   spine. On its own row the ordinal still numbers the sequence, the body
   track returns to the full 350px, and the row's ink rejoins the spine. */
export function ServiceRow({
  index,
  title,
  className,
  children,
}: ServiceRowProps) {
  return (
    <div
      className={cx(
        "grid grid-cols-1 items-start gap-x-[clamp(20px,3vw,56px)] gap-y-3 border-t border-ink/11 py-[clamp(28px,3.5vw,44px)] last:border-b",
        "min-[560px]:grid-cols-[minmax(40px,56px)_minmax(0,1fr)]",
        "min-[861px]:grid-cols-[minmax(48px,88px)_minmax(0,1fr)_minmax(0,1.35fr)]",
        className,
      )}
    >
      <span className="text-xs leading-[1.9] tracking-[0.16em] text-accent tabular-nums">
        {index}
      </span>
      <h2 className="text-display-7 font-medium leading-[1.15] tracking-[-0.025em]">
        {title}
      </h2>
      <p className="max-w-[54ch] text-base leading-[1.75] text-ink/72 min-[560px]:col-start-2 min-[861px]:col-start-3">
        {children}
      </p>
    </div>
  );
}
