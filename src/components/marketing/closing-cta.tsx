import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const MEASURE = {
  sm: "max-w-[14ch]",
  md: "max-w-[15ch]",
  lg: "max-w-[16ch]",
} as const;

const SCALE = {
  md: "text-close-md",
  lg: "text-display-4",
} as const;

export type ClosingCtaProps = {
  heading: string;
  intro: ReactNode;
  actions: ReactNode;
  measure?: keyof typeof MEASURE;
  scale?: keyof typeof SCALE;
  bordered?: boolean;
  className?: string;
};

export function ClosingCta({
  heading,
  intro,
  actions,
  measure = "sm",
  scale = "lg",
  bordered = false,
  className,
}: ClosingCtaProps) {
  return (
    <div
      className={cx(
        "grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-end gap-x-16 gap-y-8",
        bordered
          ? "border-t border-ink/11 pt-[clamp(40px,5vw,64px)]"
          : null,
        className,
      )}
    >
      <div>
        <h2
          className={cx(
            "font-medium leading-[1.1] tracking-[-0.03em]",
            MEASURE[measure],
            SCALE[scale],
          )}
        >
          {heading}
        </h2>
        <p className="mt-[22px] max-w-[48ch] text-base leading-[1.7] text-ink/72">
          {intro}
        </p>
      </div>
      {/* The prototype's own `display:flex; gap:12px; flex-wrap:wrap` with no
          `justify-content` — the pair starts at the second column's leading
          edge, 64px after the copy ends. An earlier pass pushed it to the
          field's right edge to "anchor" the band; at 1440 that opened a 392px
          void through the middle of it and detached the buttons from the copy
          they answer, at the terminal conversion moment. Left alignment is the
          prototype's and it stays. */}
      <div className="flex flex-wrap justify-start gap-3">{actions}</div>
    </div>
  );
}
