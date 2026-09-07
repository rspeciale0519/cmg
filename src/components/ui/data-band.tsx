import type { ReactNode } from "react";
import { Section } from "./section";

export type DataPoint = {
  readonly value: string;
  readonly label: string;
};

export type DataBandProps = {
  heading: string;
  headingAs?: "h2" | "h3";
  intro?: ReactNode;
  points: readonly DataPoint[];
  source?: ReactNode;
  label?: string;
  className?: string;
};

export function DataBand({
  heading,
  headingAs: Heading = "h2",
  intro,
  points,
  source,
  label,
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
            {/* Proportional figures, as the prototype sets them. These sit in
                `max-content` tracks, so nothing is aligned across columns for
                tabular widths to help — and at 76px they widened "747%" from
                200px to 211.06px, which pushed the whole second column 11px
                off the prototype's x=400.5. */}
            <p className="text-figure-lg font-medium leading-none tracking-[-0.04em]">
              {point.value}
            </p>
            {/* The prototype's 24ch. A wider measure sets the caption in two
                lines instead of three and pushes each figure column out to
                257px, which is a different band. `text-wrap: balance` was
                tried against the "— NON- / CATASTROPHE" break and produced
                byte-identical line boxes (138.4 / 58.2 / 166.1px): the em
                dash and the hyphen are the only break opportunities in the
                measure, so there is nothing for it to rebalance. Left off
                rather than kept as a no-op. */}
            <p className="mt-[18px] max-w-[24ch] text-xs uppercase leading-[1.6] tracking-[0.14em] text-ink/85">
              {point.label}
            </p>
          </div>
        ))}
      </div>
      {/* Left, on the same spine as the heading, the intro and the figures —
          the prototype's own alignment. An earlier pass ran it right to close
          the band's open right edge; the citation is the smallest ink in the
          band and cannot carry that corner, and moving it broke the one
          vertical line every other element in the band shares. */}
      {source ? (
        <p className="mt-[clamp(40px,5vw,64px)] text-[13px] leading-[1.7] text-ink/85">
          {source}
        </p>
      ) : null}
    </Section>
  );
}
