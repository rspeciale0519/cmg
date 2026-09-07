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
      {/* The measure is the only thing that moves. The composition around it
          is the prototype's, unchanged: a plain block figure, the caption
          directly beneath the quote on the same left spine, at the
          prototype's own `margin: 40px 0 0` and 14px, with no rule above it.
          An earlier pass pushed the caption to the field's right edge and
          gave it a 40px accent hairline; both were workarounds for the old
          284px quote leaving the band four fifths empty, and at 813px the
          band no longer needs either. */}
      <figure>
        <blockquote className="max-w-[30ch] text-quote font-medium leading-[1.25] tracking-[-0.028em]">
          &ldquo;{quote}&rdquo;
        </blockquote>
        <figcaption className="mt-10 text-sm uppercase leading-[1.55] tracking-[0.1em] text-ink/85">
          {attribution}
        </figcaption>
      </figure>
    </Section>
  );
}
