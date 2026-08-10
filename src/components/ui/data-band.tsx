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
      <Heading className="max-w-[18ch] text-[clamp(26px,3.2vw,40px)] font-medium leading-[1.12] tracking-[-0.03em]">
        {heading}
      </Heading>
      {intro ? (
        <p className="mt-[22px] max-w-[56ch] text-base leading-[1.7] text-ink/88">
          {intro}
        </p>
      ) : null}
      <div className="mt-[clamp(40px,5vw,64px)] grid grid-cols-[repeat(auto-fit,minmax(200px,max-content))] gap-x-[clamp(48px,8vw,112px)] gap-y-10">
        {points.map((point) => (
          <div key={point.label}>
            <p className="text-[clamp(44px,5.4vw,76px)] font-medium leading-none tracking-[-0.04em] tabular-nums">
              {point.value}
            </p>
            <p className="mt-[18px] max-w-[24ch] text-xs uppercase leading-[1.6] tracking-[0.14em] text-ink/85">
              {point.label}
            </p>
          </div>
        ))}
      </div>
      {source ? (
        <p className="mt-[clamp(40px,5vw,64px)] text-[13px] leading-[1.7] text-ink/82">
          {source}
        </p>
      ) : null}
    </Section>
  );
}
