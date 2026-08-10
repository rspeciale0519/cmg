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
      {/* Deliberate, documented deviation from the prototype's literal value.
          The prototype sets `max-width: 30ch` on the <figure>, where `ch`
          resolves against the inherited 15px body type — but nothing inside
          the figure renders at 15px: the blockquote is clamped 28→42px and
          the figcaption is 14px. So that 30ch is a unit bug, not an editorial
          measure. Honoured literally it is a 284px column carrying 42px type
          at three or four words a line, ten lines deep, inside a full-bleed
          band that is then four fifths empty colour.

          The measure therefore moves to the <blockquote>, where `ch` resolves
          against the size the author was counting characters against: 30ch of
          42px measures 813px at 1440, four lines instead of ten. (Inter is
          optically sized, so `ch` is a wider fraction of the em at 42px than
          at 15px — hence 813 rather than the 795 a flat scale would predict.)
          The figcaption keeps the prototype's own 14px and, released from the
          284px cap, stops breaking mid-attribution ("R. DELGADO ·" /
          "HOMEOWNER, ORLANDO"). */}
      {/* Two anchors, not one. At 813px the quote alone still leaves the
          right half of the band as bare colour, so the attribution is pushed
          to the field's right edge and the band resolves between them — the
          same device `closing-cta` uses to settle its own row. Below 1360px
          the attribution no longer fits beside a 30ch quote without wrapping,
          so it returns to sitting under it, as the prototype has it. */}
      <figure className="min-[1360px]:flex min-[1360px]:items-end min-[1360px]:justify-between min-[1360px]:gap-x-16">
        <blockquote className="max-w-[30ch] text-display-5 font-medium leading-[1.25] tracking-[-0.028em]">
          &ldquo;{quote}&rdquo;
        </blockquote>
        {/* The 40px accent rule is the same mark the section kickers use,
            which ties the attribution back into the page's structural
            vocabulary instead of leaving it free-floating. The 5px sets the
            attribution's baseline on the quote's last line: above 1360px the
            quote is always at its 42px cap, so the offset is a constant. */}
        <figcaption className="mt-10 text-sm uppercase leading-[1.55] tracking-[0.1em] text-ink/85 min-[1360px]:mt-0 min-[1360px]:shrink-0 min-[1360px]:pb-[5px] min-[1360px]:text-right">
          <span
            aria-hidden="true"
            className="mb-5 block h-px w-10 bg-accent min-[1360px]:ml-auto"
          />
          {attribution}
        </figcaption>
      </figure>
    </Section>
  );
}
