import { cx } from "@/lib/cx";

export type Step = {
  readonly label: string;
  readonly title: string;
  readonly body: string;
};

export type StepListProps = {
  steps: readonly Step[];
  className?: string;
};

export function StepList({ steps, className }: StepListProps) {
  return (
    <ol
      className={cx(
        "grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-[clamp(32px,5vw,72px)] gap-y-10",
        className,
      )}
    >
      {steps.map((step) => (
        <li key={step.title} className="border-t border-ink/22 pt-6">
          <span className="text-xs uppercase leading-[1.55] tracking-[0.16em] text-accent-300">
            {step.label}
          </span>
          <h3 className="mt-[18px] text-step font-medium leading-[1.2] tracking-[-0.02em]">
            {step.title}
          </h3>
          <p className="mt-3 text-[15px] leading-[1.7] text-ink/85">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
