import type { ReactNode } from "react";
import { HeroVideoRotator } from "@/components/hero-video-rotator";
import { SectionKicker } from "@/components/ui/section-kicker";
import { cx } from "@/lib/cx";

export type HeroVariant = "atmospheric" | "compact";

export type HeroProps = {
  headline: ReactNode;
  kicker?: string;
  body?: ReactNode;
  actions?: ReactNode;
  variant?: HeroVariant;
  video?: boolean;
  className?: string;
};

export function Hero({
  headline,
  kicker,
  body,
  actions,
  variant = "atmospheric",
  video = false,
  className,
}: HeroProps) {
  if (variant === "compact") {
    return (
      <section
        className={cx(
          "mx-auto w-full max-w-[1360px] px-[clamp(20px,4vw,56px)] pb-[clamp(48px,6vw,72px)] pt-[clamp(64px,8vw,112px)]",
          className,
        )}
      >
        {kicker ? <SectionKicker label={kicker} className="mb-[26px]" /> : null}
        <h1 className="max-w-[16ch] text-[clamp(36px,5.4vw,76px)] font-medium leading-[1.05] tracking-[-0.035em]">
          {headline}
        </h1>
        {body ? (
          <p className="mt-[28px] max-w-[56ch] text-[clamp(16px,1.5vw,18px)] leading-[1.7] text-ink/84">
            {body}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-9 flex flex-wrap gap-3">{actions}</div>
        ) : null}
      </section>
    );
  }

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
        <h1 className="max-w-[17ch] text-[clamp(40px,7vw,92px)] font-medium leading-[1.04] tracking-[-0.035em]">
          {headline}
        </h1>
        {body ? (
          <p className="mt-[30px] max-w-[56ch] text-[clamp(16px,1.6vw,19px)] leading-[1.65] text-ink/84">
            {body}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-[38px] flex flex-wrap gap-3">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}
