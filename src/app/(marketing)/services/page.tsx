import type { Metadata } from "next";
import { Hero } from "@/components/hero";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { PageGlow } from "@/components/marketing/page-glow";
import { ProseLink } from "@/components/marketing/prose-link";
import { ServiceRow } from "@/components/marketing/service-row";
import { Button } from "@/components/ui/button";
import { Card, CardGrid } from "@/components/ui/card-grid";
import { DataBand } from "@/components/ui/data-band";
import { Section } from "@/components/ui/section";
import { SectionKicker } from "@/components/ui/section-kicker";
import { claimHref } from "@/lib/nav";
import { site, telHref } from "@/lib/site";

const DESCRIPTION =
  "Public adjusting, appraisal and umpire work, expert testimony and free claim reviews for Florida policyholders. Our fee is a fixed percentage of what we recover — never charged up front.";

export const metadata: Metadata = {
  title: "Services",
  description: DESCRIPTION,
  alternates: { canonical: "/services" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: site.name,
    url: "/services",
    title: `Services — ${site.name}`,
    description: DESCRIPTION,
  },
};

const CLAIM_STEPS = [
  {
    eyebrow: "Step 1",
    title: "Review",
    body: "Send your policy and photos, or ask for an inspection. We tell you what the claim is worth pursuing — free.",
  },
  {
    eyebrow: "Step 2",
    title: "Document",
    body: "We inspect, measure and photograph the damage, and price the loss line by line against your policy.",
  },
  {
    eyebrow: "Step 3",
    title: "Negotiate",
    body: "We file the claim and handle every carrier meeting, inspection and demand until the offer matches the loss.",
  },
  {
    eyebrow: "Step 4",
    title: "Settle",
    body: "You approve the final number. Our fee is a fixed percentage of the recovery — nothing up front, ever.",
  },
] as const;

const OPPAGA_POINTS = [
  { value: "747%", label: "Higher payments — 2005 hurricane claims" },
  { value: "574%", label: "Higher payments — non-catastrophe claims" },
] as const;

export default function ServicesPage() {
  return (
    <>
      <PageGlow />

      <Hero
        variant="compact"
        kicker="Services"
        headline="What we do for policyholders."
        body="Four ways we put a licensed adjuster on your side of the table. Every engagement starts with a free review, and our fee is a fixed percentage of what we recover — never charged up front."
      />

      <Section space="none" containerClassName="pb-[clamp(56px,7vw,96px)]">
        <div>
          <ServiceRow index="01" title="Public adjusting">
            Full claim management, start to settlement. We inspect and document
            the damage, read the policy&rsquo;s fine print, prepare and file the
            claim, and handle every carrier meeting, inspection and negotiation
            on your behalf.
          </ServiceRow>
          <ServiceRow index="02" title="Appraisal & umpire">
            When a claim we didn&rsquo;t prepare comes back denied or underpaid,
            we re-examine the damage and issue an independent appraisal &mdash; a
            second expert opinion for your negotiation, or for the appraisal
            clause in your policy.
          </ServiceRow>
          <ServiceRow index="03" title="Expert testimony">
            If your dispute reaches litigation or arbitration, your counsel can
            retain us to testify on the scope and value of your loss, backed by
            our inspection records and estimates.
          </ServiceRow>
          <ServiceRow index="04" title="Free claim review">
            A no-obligation review of your policy and damage &mdash; new, denied
            or settled. We tell you plainly what your claim is worth pursuing and
            what we&rsquo;d do next.{" "}
            <ProseLink href={claimHref}>Request one</ProseLink>.
          </ServiceRow>
        </div>
      </Section>

      <DataBand
        label="Why representation pays"
        heading="The numbers favor representation."
        intro="Florida's legislative research office studied Citizens Property Insurance claims and found policyholders who used a public adjuster recovered far more than those who negotiated alone."
        points={OPPAGA_POINTS}
        source="Source: OPPAGA Report 10-06, Florida Legislature, January 2010."
      />

      <Section
        space="none"
        containerClassName="pb-[clamp(48px,6vw,80px)] pt-[clamp(72px,9vw,120px)]"
      >
        <SectionKicker label="How a claim works" className="mb-[26px]" />
        <h2 className="mb-[clamp(40px,5vw,64px)] max-w-[18ch] text-[clamp(26px,3.2vw,40px)] font-medium leading-[1.12] tracking-[-0.03em]">
          Four steps, and we carry all of them.
        </h2>
        <CardGrid track="sm">
          {CLAIM_STEPS.map((step) => (
            <Card
              key={step.title}
              size="sm"
              eyebrow={step.eyebrow}
              title={step.title}
            >
              {step.body}
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section
        space="none"
        containerClassName="pb-[clamp(72px,9vw,120px)] pt-[clamp(48px,6vw,80px)]"
      >
        <ClosingCta
          bordered
          measure="lg"
          scale="md"
          heading="Not sure your claim qualifies? Ask."
          intro="The review costs nothing, and if we don't think representation will help, we'll say so."
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
