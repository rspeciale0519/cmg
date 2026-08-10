import type { Metadata } from "next";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { PageGlow } from "@/components/marketing/page-glow";
import { RuleList } from "@/components/marketing/rule-list";
import { Button } from "@/components/ui/button";
import { Card, CardGrid } from "@/components/ui/card-grid";
import { ImageSlot } from "@/components/ui/image-slot";
import { Section } from "@/components/ui/section";
import { SectionKicker } from "@/components/ui/section-kicker";
import { claimHref } from "@/lib/nav";
import { site, telHref } from "@/lib/site";

const DESCRIPTION =
  "Licensed, bonded Florida public adjusters with 45 years of combined experience across residential and commercial losses. Headquartered in Orlando, responding statewide. Se habla español.";

export const metadata: Metadata = {
  title: "About CMG",
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: site.name,
    url: "/about",
    title: `About CMG — ${site.name}`,
    description: DESCRIPTION,
  },
};

const VALUES = [
  {
    eyebrow: "01",
    title: "Integrity",
    body: "Our fee agreement is in writing before we start, our estimates are documented line by line, and we never promise a number we can't support.",
  },
  {
    eyebrow: "02",
    title: "Communication",
    body: "You will always know where your claim stands. We keep you informed at every step, answer your questions plainly, and return every call the same day.",
  },
  {
    eyebrow: "03",
    title: "Results",
    body: "We are paid only from your settlement, so our incentive is yours: recover the full value of the loss and restore the property, as fast as the claim allows.",
  },
] as const;

const SERVICE_AREA = [
  { label: "Orlando & Central Florida" },
  { label: "Tampa Bay" },
  { label: "Fort Myers & Naples" },
  { label: "Miami & the Keys" },
  { label: "Jacksonville" },
  { label: "The Panhandle" },
] as const;

export default function AboutPage() {
  return (
    <>
      <PageGlow />

      {/* Hero's compact variant renders `body` inside a single measured <p>,
          so the two-column intro below is composed from the same primitives
          and type scale instead. */}
      <Section
        space="none"
        containerClassName="pb-[clamp(48px,6vw,72px)] pt-[clamp(64px,8vw,112px)]"
      >
        <SectionKicker label="About CMG" className="mb-[26px]" />
        <h1 className="max-w-[16ch] text-display-3 font-medium leading-[1.05] tracking-[-0.035em]">
          Licensed adjusters on the policyholder&apos;s side.
        </h1>
        <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-[clamp(32px,5vw,88px)] gap-y-6">
          <p className="text-lede leading-[1.7] text-ink/84">
            After a catastrophe, insurance carriers field thousands of claims at
            once &mdash; often with new, hurried adjusters. Things get missed,
            understated or denied. CMG Property Solutions exists to balance that
            table: experienced, licensed adjusters who read the fine print,
            document everything and advocate for the property owner alone.
          </p>
          <p className="text-base leading-[1.75] text-ink/68">
            We are licensed and bonded in every state where we work, bound by
            each state&apos;s code of ethics for public adjusters, and members
            of professional adjusting associations. Se habla espa&ntilde;ol.
          </p>
        </div>
      </Section>

      <Section space="none" containerClassName="pb-[clamp(56px,7vw,96px)]">
        <CardGrid track="md">
          {VALUES.map((value) => (
            <Card
              key={value.title}
              size="md"
              titleAs="h2"
              eyebrow={value.eyebrow}
              title={value.title}
            >
              {value.body}
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section
        space="none"
        containerClassName="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-x-[clamp(32px,5vw,88px)] gap-y-10 pb-[clamp(56px,7vw,96px)]"
      >
        <div>
          <SectionKicker label="The team" className="mb-[22px]" />
          <h2 className="max-w-[15ch] text-display-5 font-medium leading-[1.12] tracking-[-0.03em]">
            Adjusters first, salespeople never.
          </h2>
          <p className="mt-[22px] max-w-[46ch] text-base leading-[1.7] text-ink/72">
            Our team brings 45 years of combined experience across residential
            and commercial losses &mdash; carrier-side training, policyholder-side
            loyalty. Every file is worked by a licensed adjuster, not handed to a
            call center.
          </p>
        </div>
        <ImageSlot label="The CMG field team" />
      </Section>

      <Section tone="section" space="lg">
        <h2 className="max-w-[18ch] text-display-6 font-medium leading-[1.12] tracking-[-0.03em]">
          Where we work.
        </h2>
        <p className="mb-[clamp(40px,5vw,56px)] mt-[22px] max-w-[56ch] text-base leading-[1.7] text-ink/88">
          Headquartered in Orlando and licensed across Florida, with catastrophe
          response statewide. Our service area grows every season &mdash; if
          you&apos;re outside it, ask anyway.
        </p>
        <RuleList
          items={SERVICE_AREA}
          label="Service area"
          track="sm"
          tone="section"
        />
      </Section>

      <Section space="xl">
        <ClosingCta
          heading="Talk to an adjuster today."
          intro={
            <>
              Questions about a loss, a policy or a denial &mdash; we&apos;re
              happy to talk it through before you commit to anything.
            </>
          }
          actions={
            <>
              <Button href={claimHref}>File a claim</Button>
              <Button href={telHref} variant="secondary">
                Call 24/7
              </Button>
            </>
          }
        />
      </Section>
    </>
  );
}
