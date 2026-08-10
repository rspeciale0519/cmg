import type { ReactNode } from "react";
import { HeroVideoRotator } from "@/components/hero-video-rotator";
import { SectionKicker } from "@/components/ui/section-kicker";
import { cx } from "@/lib/cx";

export type HeroVariant = "atmospheric" | "compact";

/* Named steps rather than a per-page arbitrary override. `lg` exists because
   the Contractors headline is a two-part line the prototype sets one step
   above the other page h1s; it is a scale, not a one-off. */
const HEADLINE = {
  md: { size: "text-display-3", measure: "max-w-[16ch]", leading: "leading-[1.05]" },
  lg: { size: "text-display-2", measure: "max-w-[15ch]", leading: "leading-[1.04]" },
  xl: { size: "text-display-1", measure: "max-w-[17ch]", leading: "leading-[1.04]" },
} as const;

export type HeroScale = keyof typeof HEADLINE;

/* Both buttons hug their labels, as they do everywhere else on the site and
   as the prototype has them — stretching them edge to edge at 390 made the
   hero the one place a CTA pair ran the full column. They stack below 420px
   because side by side they no longer fit, and `w-fit` on a column of
   stretched items sizes the column to the wider label, so the pair comes out
   equal (~251px) rather than near-equal (251/239), which is the one thing
   worse than either. */
const ACTIONS =
  "flex w-fit flex-col gap-3 min-[420px]:w-auto min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:[&>*]:flex-none";

export type HeroProps = {
  headline: ReactNode;
  kicker?: string;
  body?: ReactNode;
  actions?: ReactNode;
  variant?: HeroVariant;
  scale?: HeroScale;
  video?: boolean;
  className?: string;
};

export function Hero({
  headline,
  kicker,
  body,
  actions,
  variant = "atmospheric",
  scale,
  video = false,
  className,
}: HeroProps) {
  if (variant === "compact") {
    const step = HEADLINE[scale ?? "md"];

    return (
      <section
        className={cx(
          "mx-auto w-full max-w-[1360px] px-[clamp(20px,4vw,56px)] pb-[clamp(48px,6vw,72px)] pt-[clamp(64px,8vw,112px)]",
          className,
        )}
      >
        {kicker ? <SectionKicker label={kicker} className="mb-[26px]" /> : null}
        <h1
          className={cx(
            "font-medium tracking-[-0.035em]",
            step.size,
            step.measure,
            step.leading,
          )}
        >
          {headline}
        </h1>
        {body ? (
          <p className="mt-[28px] max-w-[56ch] text-lede leading-[1.7] text-ink/85">
            {body}
          </p>
        ) : null}
        {actions ? (
          <div className={cx("mt-9", ACTIONS)}>{actions}</div>
        ) : null}
      </section>
    );
  }

  const step = HEADLINE[scale ?? "xl"];

  return (
    <section
      className={cx(
        "relative isolate flex min-h-[min(90vh,880px)] items-end overflow-hidden",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[-3] [background:radial-gradient(120%_90%_at_70%_10%,#3B3F43_0%,#24272A_55%,#15171A_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-[-12%] z-[-3] animate-[drift-a_34s_ease-in-out_infinite] opacity-55 blur-[40px] [background:radial-gradient(closest-side,rgba(212,179,106,0.22),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-[-18%] z-[-3] animate-[drift-b_46s_ease-in-out_infinite] opacity-[0.42] blur-[56px] [background:radial-gradient(closest-side_at_40%_60%,rgba(138,112,83,0.48),transparent_68%)]"
      />

      {video ? <HeroVideoRotator /> : null}

      <div
        aria-hidden="true"
        className="absolute inset-0 z-[-2] animate-[rain_0.85s_linear_infinite] opacity-[0.16] [background-image:repeating-linear-gradient(74deg,rgba(243,237,224,0.5)_0_1px,transparent_1px_7px)] [background-size:260px_900px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[-2] animate-[flash_13s_ease-out_infinite] bg-[#F5EBD2] mix-blend-overlay"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[-1] [background:linear-gradient(180deg,rgba(21,23,26,0.74)_0%,rgba(21,23,26,0.32)_34%,rgba(21,23,26,0.88)_78%,var(--color-canvas)_100%)]"
      />

      <div className="relative mx-auto w-full max-w-[1360px] px-[clamp(20px,4vw,56px)] pb-[clamp(56px,7vh,84px)] pt-[clamp(120px,18vh,200px)]">
        {kicker ? <SectionKicker label={kicker} className="mb-[26px]" /> : null}
        <h1
          className={cx(
            "font-medium tracking-[-0.035em]",
            step.size,
            step.measure,
            step.leading,
          )}
        >
          {headline}
        </h1>
        {body ? (
          <p className="mt-[30px] max-w-[56ch] text-lede-lg leading-[1.65] text-ink/85">
            {body}
          </p>
        ) : null}
        {actions ? (
          <div className={cx("mt-[38px]", ACTIONS)}>{actions}</div>
        ) : null}
      </div>
    </section>
  );
}
