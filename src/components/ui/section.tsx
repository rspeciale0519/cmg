import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "@/lib/cx";

const CONTAINER = "mx-auto w-full max-w-[1360px] px-[clamp(20px,4vw,56px)]";

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
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx(CONTAINER, className)}>{children}</div>;
}

export type SectionProps = Omit<
  ComponentPropsWithoutRef<"section">,
  "className" | "children"
> & {
  space?: SectionSpace;
  tone?: SectionTone;
  bleed?: boolean;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
};

export function Section({
  space = "md",
  tone = "canvas",
  bleed = false,
  className,
  containerClassName,
  children,
  ...rest
}: SectionProps) {
  const inner = bleed ? (
    children
  ) : (
    <div className={cx(CONTAINER, SPACE[space], containerClassName)}>
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
