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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-9">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-[clamp(32px,3.4vw,46px)] font-medium leading-none tracking-[-0.03em] tabular-nums">
                {stat.value}
                {stat.suffix ? (
                  <span className="text-accent">{stat.suffix}</span>
                ) : null}
              </p>
              <p className="mt-[14px] text-xs uppercase tracking-[0.14em] text-ink/55">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
