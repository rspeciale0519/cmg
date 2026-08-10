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
    title: "text-card-sm",
    titleGap: "mt-5",
    bodyGap: "mt-3",
  },
  md: {
    box: "min-h-[260px] p-[clamp(26px,2.8vw,40px)]",
    title: "text-card-md",
    titleGap: "mt-[22px]",
    bodyGap: "mt-[14px]",
  },
  lg: {
    box: "min-h-[280px] p-[clamp(26px,2.8vw,40px)]",
    title: "text-card-md",
    titleGap: "mt-[22px]",
    bodyGap: "mt-[14px]",
  },
  xl: {
    box: "min-h-[300px] p-[clamp(28px,3vw,44px)]",
    title: "text-card-lg",
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
        <span className="text-xs uppercase leading-[1.55] tracking-[0.16em] text-accent tabular-nums">
          {eyebrow}
        </span>
      ) : null}
      <Title
        className={cx(
          metrics.title,
          "leading-[1.2] tracking-[-0.02em] transition-colors duration-200",
          /* Inert unless an ancestor carries `group` — i.e. only on the
             linked card, never on the static one. */
          "group-hover:text-accent-100",
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
        <span className="mt-6 inline-flex items-center gap-1.5 text-sm leading-[1.55] text-accent">
          {action}
          <span
            aria-hidden="true"
            className="transition-transform duration-200 ease-out group-hover:translate-x-1 group-active:translate-x-1.5"
          >
            &rarr;
          </span>
        </span>
      ) : null}
    </>
  );

  const shell = cx("flex flex-col bg-canvas", metrics.box, className);

  if (href) {
    return (
      /* The card is one target, so it moves as one: the ground lifts, the
         edge steps in from the 1px grid gap, and the arrow leads. Restrained
         on purpose — no lift, no shadow, no scale. */
      <Link
        href={href}
        className={cx(
          shell,
          "group relative text-inherit no-underline transition-colors duration-200",
          "hover:bg-[color-mix(in_srgb,var(--color-accent)_7%,var(--color-canvas))]",
          "active:bg-[color-mix(in_srgb,var(--color-accent)_11%,var(--color-canvas))]",
          /* Drawn as an inset ring so it reads on top of the grid's own 1px
             gap lines instead of displacing the card by a border width. */
          "after:pointer-events-none after:absolute after:inset-0 after:transition-shadow after:duration-200",
          "hover:after:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-ink)_22%,transparent)]",
          /* Focus is not hover. The keyboard already gets the global 2px gold
             outline around the card; repeating the ink hover ring inside it
             put two rings on one card and made the inner one read as a
             pointer that was not there. The inset ring goes gold instead, so
             the two rings are one statement — outer outline, inner echo — and
             the ink ring stays the pointer's alone. */
          "focus-visible:after:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_55%,transparent)]",
          "focus-visible:bg-[color-mix(in_srgb,var(--color-accent)_5%,var(--color-canvas))]",
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
