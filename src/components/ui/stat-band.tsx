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
        {/* The prototype's 24px column gap at every width. A previous pass
            widened it to 40px below `md` so the wrapped 2×2 would not read as
            a table; it cost 8px off each track (155px vs the prototype's
            163px) and the phone is where those labels are tightest. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-9">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-figure-md font-medium leading-none tracking-[-0.03em] tabular-nums">
                {stat.value}
                {stat.suffix ? (
                  <span className="text-accent">{stat.suffix}</span>
                ) : null}
              </p>
              {/* The prototype's 14px. The figure sets on `leading-none`, so
                  its box ends at the numeral and the 14px is all optical
                  space — 18px read as a gap between two things rather than
                  one label under one number. */}
              <p className="mt-[14px] text-xs uppercase leading-[1.55] tracking-[0.14em] text-ink/55">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
