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
    /* Deliberately the full 1360px field, not the `narrow` measure. Narrowing
       it moved the quote's left edge to 208.5px while every other band on the
       page starts its ink at 88.5px, which breaks the page's left spine — and
       it buys nothing here, because the band is full-bleed colour, so the
       "empty" field extends to the viewport edge whatever the container does. */
    <Section tone="section" space="lg" className={className}>
      {/* The measure belongs to the figure, exactly as the prototype sets it:
          `30ch` against the inherited 15px body type is a ~284px column, and
          the 42px quote is then deliberately narrow. Putting the 30ch on the
          blockquote instead resolves it against the quote's own 42px and
          gives an 813px line — a different design. Hence the explicit 15px
          here: this app's body type is 16px, so the figure has to restate the
          size the prototype was counting characters against. */}
      <figure className="max-w-[30ch] text-[15px]">
        <blockquote className="text-display-5 font-medium leading-[1.25] tracking-[-0.028em]">
          &ldquo;{quote}&rdquo;
        </blockquote>
        {/* The column is tall and narrow, so the attribution has to close it
            rather than trail off it. The 40px accent rule is the same mark
            the section kickers use, which ties the pull-quote back into the
            page's structural vocabulary instead of leaving it free-floating. */}
        <figcaption className="mt-10 text-sm uppercase leading-[1.6] tracking-[0.1em] text-ink/85">
          <span aria-hidden="true" className="mb-5 block h-px w-10 bg-accent" />
          {attribution}
        </figcaption>
      </figure>
    </Section>
  );
}
