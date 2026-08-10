import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "@/lib/cx";

/* Two field widths. `wide` is the prototype's 1360px and is the page's left
   spine: every band on every route starts its ink at the same x, and that
   alignment is load-bearing.

   `narrow` exists for a band that has to stand apart from that spine —
   a standalone text page, a legal or confirmation view. Reach for it only
   when the band is genuinely not part of the spine, because a centred
   narrower container shifts the left edge inward and a reader reads that
   as a mistake. A band that merely strands its right edge is a composition
   problem, not a width problem: give it a second anchor instead (see
   `closing-cta`, the `/file-a-claim` rail, and the full-width `/contact`
   FAQ rows). */
const MEASURE = {
  wide: "max-w-[1360px]",
  narrow: "max-w-[1120px]",
} as const;

const CONTAINER = "mx-auto w-full px-[clamp(20px,4vw,56px)]";

export type SectionMeasure = keyof typeof MEASURE;

const SPACE = {
  none: "",
  sm: "py-[clamp(40px,5vw,64px)]",
  md: "py-[clamp(48px,6vw,80px)]",
  lg: "py-[clamp(64px,8vw,112px)]",
  xl: "py-[clamp(72px,9vw,120px)]",
} as const;

const TONE = {
  canvas: "",
  section:
    "bg-section [background-image:radial-gradient(1000px_500px_at_80%_-10%,color-mix(in_srgb,var(--color-section-glow)_62%,transparent),transparent_66%)]",
} as const;

export type SectionSpace = keyof typeof SPACE;
export type SectionTone = keyof typeof TONE;

export function Container({
  measure = "wide",
  className,
  children,
}: {
  measure?: SectionMeasure;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx(CONTAINER, MEASURE[measure], className)}>{children}</div>
  );
}

export type SectionProps = Omit<
  ComponentPropsWithoutRef<"section">,
  "className" | "children"
> & {
  space?: SectionSpace;
  tone?: SectionTone;
  measure?: SectionMeasure;
  bleed?: boolean;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
};

export function Section({
  space = "md",
  tone = "canvas",
  measure = "wide",
  bleed = false,
  className,
  containerClassName,
  children,
  ...rest
}: SectionProps) {
  const inner = bleed ? (
    children
  ) : (
    <div
      className={cx(
        CONTAINER,
        MEASURE[measure],
        SPACE[space],
        containerClassName,
      )}
    >
      {children}
    </div>
  );

  return (
    <section
      className={cx(TONE[tone], bleed ? SPACE[space] : null, className)}
      {...rest}
    >
      {inner}
    </section>
  );
}
