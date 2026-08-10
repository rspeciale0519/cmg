import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Section } from "./section";

export type DataPoint = {
  readonly value: string;
  readonly label: string;
};

/* 24ch of 12px type with 1.68px of tracking is a 182px measure, which broke
   "Higher payments — non-catastrophe claims" over three lines and hyphenated
   at the em dash, leaving "— NON-" dangling. The labels are captions, not
   body copy: give them room to set in two lines. */
const LABEL_MEASURE = {
  default: "max-w-[24ch]",
  wide: "max-w-[34ch]",
} as const;

export type DataBandMeasure = keyof typeof LABEL_MEASURE;

export type DataBandProps = {
  heading: string;
  headingAs?: "h2" | "h3";
  intro?: ReactNode;
  points: readonly DataPoint[];
  source?: ReactNode;
  label?: string;
  measure?: DataBandMeasure;
  className?: string;
};

export function DataBand({
  heading,
  headingAs: Heading = "h2",
  intro,
  points,
  source,
  label,
  measure = "default",
  className,
}: DataBandProps) {
  return (
    <Section
      tone="section"
      space="lg"
      aria-label={label}
      className={className}
    >
      <Heading className="max-w-[18ch] text-display-6 font-medium leading-[1.12] tracking-[-0.03em]">
        {heading}
      </Heading>
      {intro ? (
        <p className="mt-[22px] max-w-[56ch] text-base leading-[1.7] text-ink/85">
          {intro}
        </p>
      ) : null}
      <div className="mt-[clamp(40px,5vw,64px)] grid grid-cols-[repeat(auto-fit,minmax(200px,max-content))] gap-x-[clamp(48px,8vw,112px)] gap-y-10">
        {points.map((point) => (
          <div key={point.label}>
            <p className="text-figure-lg font-medium leading-none tracking-[-0.04em] tabular-nums">
              {point.value}
            </p>
            <p
              className={cx(
                "mt-[18px] text-xs uppercase leading-[1.6] tracking-[0.14em] text-ink/85",
                LABEL_MEASURE[measure],
              )}
            >
              {point.label}
            </p>
          </div>
        ))}
      </div>
      {/* The band's second anchor. Two `max-content` figure columns leave the
          last ink at x=669 in a 1248px field — 668px of bare colour down the
          full 700px height of the largest saturated block on the site, and
          `section.tsx` makes closing both edges the rule. The source line is
          already a full-width block carrying short ink, so aligning it right
          costs nothing and runs the composition corner to corner. Below
          1100px the field is narrow enough that the figures reach it on their
          own, and the citation returns under them. */}
      {source ? (
        <p className="mt-[clamp(40px,5vw,64px)] text-[13px] leading-[1.7] text-ink/85 min-[1100px]:text-right">
          {source}
        </p>
      ) : null}
    </Section>
  );
}
