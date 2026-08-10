import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const MEASURE = {
  sm: "max-w-[14ch]",
  md: "max-w-[15ch]",
  lg: "max-w-[16ch]",
} as const;

const SCALE = {
  md: "text-display-5",
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
      {/* Pushed to the field's right edge once the grid is genuinely two
          columns, so the band resolves as two anchors — heading at the left
          edge, actions at the right — instead of leaving the buttons adrift
          in the middle with nothing in front of them. */}
      <div className="flex flex-wrap justify-start gap-3 min-[900px]:justify-end">
        {actions}
      </div>
    </div>
  );
}
