import type { Metadata } from "next";
import { Hero } from "@/components/hero";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { PageGlow } from "@/components/marketing/page-glow";
import { StepList } from "@/components/marketing/step-list";
import { Button } from "@/components/ui/button";
import { Card, CardGrid } from "@/components/ui/card-grid";
import { Section } from "@/components/ui/section";
import { claimHref } from "@/lib/nav";
import { site, telHref } from "@/lib/site";

const DESCRIPTION =
  "Refer your customer's claim to CMG and keep building. Licensed Florida public adjusters document, file and negotiate the claim — higher settlements, more selling time, and no risk of adjusting without a license.";

export const metadata: Metadata = {
  title: "For Contractors",
  description: DESCRIPTION,
  alternates: { canonical: "/contractors" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: site.name,
    url: "/contractors",
    title: `For Contractors — ${site.name}`,
    description: DESCRIPTION,
  },
};

const BENEFITS = [
  {
    eyebrow: "01",
    title: "Higher settlements",
    body: "We negotiate and settle claims at higher amounts, with every line item documented and paid — so the approved scope covers the work you actually quote.",
  },
  {
    eyebrow: "02",
    title: "More time to sell",
    body: "We manage the entire claims process, so your sales reps aren't chasing adjusters and paperwork. They spend their time where it pays — selling the next job.",
  },
  {
    eyebrow: "03",
    title: "Less risk",
    body: "Negotiating claims without a license can cost a contractor their business. With CMG on the file, the adjusting is done by licensed public adjusters — your company stays clear of it.",
  },
  {
    eyebrow: "04",
    title: "Partner benefits",
    body: "Referral partners get direct file access and claim transparency, direct claim payments, and settlement minimums — you always know where a claim stands.",
  },
] as const;

const REFERRAL_STEPS = [
  {
    label: "Step 1",
    title: "You refer",
    body: "Your rep spots covered damage and introduces us. One call or a form — we take it from there.",
  },
  {
    label: "Step 2",
    title: "We adjust",
    body: "We document, file and negotiate the homeowner's claim, keeping you and the client informed throughout.",
  },
  {
    label: "Step 3",
    title: "You build",
    body: "The claim settles at the documented scope, the homeowner is paid, and your crew gets to work.",
  },
] as const;

export default function ContractorsPage() {
  return (
    <>
      <PageGlow />

      <Hero
        variant="compact"
        className="[&_h1]:max-w-[15ch] [&_h1]:text-[clamp(38px,6vw,84px)] [&_h1]:leading-[1.04]"
        kicker="For roofing & restoration contractors"
        headline={
          <>
            We handle the claim.{" "}
            <span className="text-accent-300">You handle the roof.</span>
          </>
        }
        body="CMG acts as your in-house public adjuster: refer the homeowner's claim to us and get back to building. Your clients get licensed representation and a better settlement; your crew gets the approved scope."
        actions={
          <>
            <Button href={claimHref}>Become a referral partner</Button>
            <Button href={telHref} variant="secondary">
              Call {site.phone}
            </Button>
          </>
        }
      />

      <Section space="none" containerClassName="pb-[clamp(56px,7vw,96px)]">
        <CardGrid track="md">
          {BENEFITS.map((benefit) => (
            <Card
              key={benefit.title}
              size="lg"
              titleAs="h2"
              eyebrow={benefit.eyebrow}
              title={benefit.title}
            >
              {benefit.body}
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section tone="section" space="lg" aria-label="How the referral works">
        <h2 className="mb-[clamp(40px,5vw,64px)] max-w-[18ch] text-[clamp(26px,3.2vw,40px)] font-medium leading-[1.12] tracking-[-0.03em]">
          How the referral works.
        </h2>
        <StepList steps={REFERRAL_STEPS} />
      </Section>

      <Section space="xl">
        <ClosingCta
          measure="md"
          heading="Add claims expertise to your crew."
          intro="Tell us about your company and territory, and we'll walk you through the partnership — transparency, payments and minimums included."
          actions={
            <>
              <Button href={claimHref}>Become a partner</Button>
              <Button href={telHref} variant="secondary">
                Call us
              </Button>
            </>
          }
        />
      </Section>
    </>
  );
}
