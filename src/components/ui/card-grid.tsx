import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const TRACK = {
  sm: "grid-cols-[repeat(auto-fit,minmax(230px,1fr))]",
  md: "grid-cols-[repeat(auto-fit,minmax(260px,1fr))]",
  lg: "grid-cols-[repeat(auto-fit,minmax(270px,1fr))]",
} as const;

/* Each size is one prototype grid: sm = the four-step process, md = the values
   trio, lg = the partner-benefits four-up, xl = the home feature cards. */
const CARD = {
  sm: {
    box: "min-h-[230px] p-[clamp(24px,2.6vw,36px)]",
    title: "text-[21px]",
    titleGap: "mt-5",
    bodyGap: "mt-3",
  },
  md: {
    box: "min-h-[260px] p-[clamp(26px,2.8vw,40px)]",
    title: "text-[23px]",
    titleGap: "mt-[22px]",
    bodyGap: "mt-[14px]",
  },
  lg: {
    box: "min-h-[280px] p-[clamp(26px,2.8vw,40px)]",
    title: "text-[23px]",
    titleGap: "mt-[22px]",
    bodyGap: "mt-[14px]",
  },
  xl: {
    box: "min-h-[300px] p-[clamp(28px,3vw,44px)]",
    title: "text-[24px]",
    titleGap: "mt-[22px]",
    bodyGap: "mt-[14px]",
  },
} as const;

export type CardGridTrack = keyof typeof TRACK;
export type CardSize = keyof typeof CARD;

export type CardGridProps = {
  track?: CardGridTrack;
  className?: string;
  children: ReactNode;
};

export function CardGrid({ track = "md", className, children }: CardGridProps) {
  return (
    <div
      className={cx(
        "grid gap-px border border-ink/11 bg-ink/11",
        TRACK[track],
        className,
      )}
    >
      {children}
    </div>
  );
}

export type CardProps = {
  title: string;
  eyebrow?: string;
  titleAs?: "h2" | "h3" | "h4";
  size?: CardSize;
  href?: string;
  action?: string;
  className?: string;
  children?: ReactNode;
};

export function Card({
  title,
  eyebrow,
  titleAs: Title = "h3",
  size = "lg",
  href,
  action,
  className,
  children,
}: CardProps) {
  const metrics = CARD[size];

  const body = (
    <>
      {eyebrow ? (
        <span className="text-xs uppercase tracking-[0.16em] text-accent tabular-nums">
          {eyebrow}
        </span>
      ) : null}
      <Title
        className={cx(
          metrics.title,
          "leading-[1.2] tracking-[-0.02em]",
          eyebrow ? metrics.titleGap : null,
        )}
      >
        {title}
      </Title>
      {children ? (
        <p
          className={cx(
            "text-[15px] leading-[1.7] text-ink/72",
            metrics.bodyGap,
            action ? "flex-1" : null,
          )}
        >
          {children}
        </p>
      ) : null}
      {action ? (
        <span className="mt-6 text-sm text-accent">
          {action} <span aria-hidden="true">&rarr;</span>
        </span>
      ) : null}
    </>
  );

  const shell = cx("flex flex-col bg-canvas", metrics.box, className);

  if (href) {
    return (
      <Link
        href={href}
        className={cx(
          shell,
          "text-inherit no-underline transition-colors duration-200",
          "hover:bg-[color-mix(in_srgb,var(--color-accent)_7%,var(--color-canvas))]",
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
