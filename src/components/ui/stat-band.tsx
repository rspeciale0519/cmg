import { cx } from "@/lib/cx";
import { Container } from "./section";

export type Stat = {
  readonly value: string;
  readonly suffix?: string;
  readonly label: string;
};

export type StatBandProps = {
  stats: readonly Stat[];
  label: string;
  bordered?: boolean;
  className?: string;
};

export function StatBand({
  stats,
  label,
  bordered = true,
  className,
}: StatBandProps) {
  return (
    <section
      aria-label={label}
      className={cx(bordered ? "border-b border-ink/9" : null, className)}
    >
      <Container className="py-[clamp(40px,5vw,64px)]">
        {/* The prototype's 24px column gap, but only from the width at which
            the band is a single row of four. Below that it wraps to 2×2, and
            a 24px column gap under a 36px row gap makes the four figures read
            as a table with rows rather than as four independent stats — so
            the wider gap stays where the wrap actually happens. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-10 gap-y-9 md:gap-x-6">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-figure-md font-medium leading-none tracking-[-0.03em] tabular-nums">
                {stat.value}
                {stat.suffix ? (
                  <span className="text-accent">{stat.suffix}</span>
                ) : null}
              </p>
              {/* 14px under a 46px figure was tighter than the type could
                  carry; 18px binds the pair without loosening it. */}
              <p className="mt-[18px] text-xs uppercase tracking-[0.14em] text-ink/55">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
