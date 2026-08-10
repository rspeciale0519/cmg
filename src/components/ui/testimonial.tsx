import { Section } from "./section";

export type TestimonialProps = {
  quote: string;
  attribution: string;
  className?: string;
};

export function Testimonial({
  quote,
  attribution,
  className,
}: TestimonialProps) {
  return (
    <Section tone="section" space="lg" className={className}>
      {/* The prototype puts `max-width: 30ch` on the figure, where `ch`
          resolves against the inherited 15px body type — a 284px column for
          42px display text. The measure is kept on the quote instead, so the
          authored 30ch counts the quote's own characters. */}
      <figure>
        <blockquote className="max-w-[30ch] text-[clamp(24px,3.2vw,42px)] font-medium leading-[1.25] tracking-[-0.028em]">
          &ldquo;{quote}&rdquo;
        </blockquote>
        <figcaption className="mt-10 text-sm uppercase tracking-[0.1em] text-ink/85">
          {attribution}
        </figcaption>
      </figure>
    </Section>
  );
}
