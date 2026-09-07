import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/forms/contact-form";
import { PageGlow } from "@/components/marketing/page-glow";
import { ProseLink } from "@/components/marketing/prose-link";
import { FaqItem } from "@/components/ui/faq-item";
import { Section } from "@/components/ui/section";
import { SectionKicker } from "@/components/ui/section-kicker";
import { claimHref } from "@/lib/nav";
import { emailHref, site, telHref } from "@/lib/site";

const DESCRIPTION =
  "Tell us what happened and a licensed Florida public adjuster will call you back within one business day. Free claim review, no fee unless we recover.";

export const metadata: Metadata = {
  title: "Contact",
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: site.name,
    url: "/contact",
    title: `Contact — ${site.name}`,
    description: DESCRIPTION,
  },
};

/* `leading-none` closed the eyebrow's box to its own 11px; the prototype
   sets no line-height on these and they take the body's 1.55 (17.05px),
   which is what puts the 10px gap where it lands. */
const DETAIL_LABEL =
  "m-0 mb-[10px] text-[11px] uppercase leading-[1.55] tracking-[0.18em] text-ink/55";
const DETAIL_BLOCK = "border-t border-ink/11 pt-5";

export default function ContactPage() {
  return (
    <>
      <PageGlow />

      <Section space="none" className="pt-[clamp(64px,8vw,112px)]">
        <SectionKicker label="Contact" className="mb-[26px]" />
        <h1 className="m-0 max-w-[16ch] text-display-3 font-medium leading-[1.05] tracking-[-0.035em]">
          Start your free claim review.
        </h1>
        <p className="mt-7 max-w-[56ch] text-lede leading-[1.7] text-ink/85">
          Tell us what happened and we&apos;ll call you back within one business day. If the
          damage is urgent, call — the line is answered around the clock.
        </p>
      </Section>

      <Section
        space="none"
        className="pt-[clamp(40px,5vw,64px)] pb-[clamp(56px,7vw,96px)]"
        containerClassName="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-x-[clamp(40px,6vw,96px)] gap-y-12"
      >
        <div className="flex flex-col gap-8">
          <div className={DETAIL_BLOCK}>
            <p className={DETAIL_LABEL}>Call 24/7</p>
            <Link
              href={telHref}
              className="inline-flex min-h-11 items-center text-figure-sm font-medium tracking-[-0.025em] text-accent transition-colors duration-200 hover:text-accent-300 active:text-accent-200"
            >
              {site.phone}
            </Link>
          </div>

          <div className={DETAIL_BLOCK}>
            <p className={DETAIL_LABEL}>Email</p>
            {/* Not a `ProseLink`: this is a display link in the contact
                rail, the twin of the phone number above it, and the
                prototype sets `text-decoration: none` on it. What it was
                missing is the transition its twin already had. */}
            <Link
              href={emailHref}
              className="inline-flex min-h-11 max-w-full items-center break-words text-[17px] text-accent transition-colors duration-200 hover:text-accent-300 active:text-accent-200"
            >
              {site.email}
            </Link>
          </div>

          <div className={DETAIL_BLOCK}>
            <p className={DETAIL_LABEL}>Office</p>
            <p className="m-0 text-base leading-[1.65]">
              Orlando, Florida
              <br />
              Serving the state of Florida
            </p>
          </div>

          <div className={DETAIL_BLOCK}>
            <p className={DETAIL_LABEL}>Service area</p>
            <p className="m-0 mb-4 max-w-[34ch] text-base leading-[1.65] text-ink/72">
              Licensed across Florida, catastrophe response statewide.
            </p>
            <span className="inline-flex items-center rounded-[6px] bg-accent-800 px-[10px] py-[3px] text-[11px] tracking-[0.02em] text-accent-100">
              Se habla español
            </span>
          </div>

          <p className="m-0 text-[15px] leading-[1.7]">
            Ready to move?{" "}
            <ProseLink href={claimHref}>Complete the claim intake →</ProseLink>
          </p>
        </div>

        <ContactForm />
      </Section>

      <Section space="none" className="pb-[clamp(72px,9vw,120px)]">
        <SectionKicker label="Common questions" className="mb-[34px]" />
        {/* The prototype's 820px, restored. The row is the structure —
            question at the left edge, chevron at the right — and at the full
            1248px field those two ends sit ~1050px apart, which stops reading
            as one control. 820px keeps the chevron within reach of the
            question and still clears the answer's own 62ch measure. */}
        <div className="max-w-[820px]">
          <FaqItem question="What does it cost?">
            Nothing up front. Our fee is a fixed percentage of the settlement, agreed in
            writing before we start. If we recover nothing, you owe nothing.
          </FaqItem>
          <FaqItem question="My claim was denied or underpaid. Can you still help?">
            Usually, yes. Many closed claims can be reopened, appraised or re-negotiated.
            Send us the denial letter or the carrier&apos;s estimate and we&apos;ll review
            it free.
          </FaqItem>
          <FaqItem question="How long does a claim take?">
            Straightforward claims often settle in weeks; complex or disputed losses take
            longer. Either way, you&apos;ll know where your claim stands at every step.
          </FaqItem>
          <FaqItem question="Do I have to deal with the insurance company myself?">
            No. Once you appoint us, we handle the carrier&apos;s calls, inspections and
            paperwork. Your job is to approve the settlement.
          </FaqItem>
        </div>
      </Section>
    </>
  );
}
