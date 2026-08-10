import type { Metadata } from "next";
import { Hero } from "@/components/hero";
import { LocalBusinessJsonLd } from "@/components/local-business-jsonld";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { ProseLink } from "@/components/marketing/prose-link";
import { RuleList } from "@/components/marketing/rule-list";
import { Button } from "@/components/ui/button";
import { Card, CardGrid } from "@/components/ui/card-grid";
import { ImageSlot } from "@/components/ui/image-slot";
import { Section } from "@/components/ui/section";
import { SectionKicker } from "@/components/ui/section-kicker";
import { StatBand } from "@/components/ui/stat-band";
import { Testimonial } from "@/components/ui/testimonial";
import { claimHref } from "@/lib/nav";
import { site, telHref } from "@/lib/site";

const DESCRIPTION =
  "Licensed Florida public adjusters who document your loss, file your claim and negotiate with your carrier until the settlement reflects the damage. $86M+ recovered. No fee unless we recover.";

export const metadata: Metadata = {
  title: "Licensed Florida Public Adjusters",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: site.name,
    url: "/",
    title: `${site.name} — ${site.tagline}`,
    description: DESCRIPTION,
  },
};

const STATS = [
  { value: "$86M", suffix: "+", label: "Recovered for clients" },
  { value: "2,400", suffix: "+", label: "Claims settled" },
  { value: "45 yrs", label: "Combined experience" },
  { value: "$0", label: "Upfront fees" },
] as const;

const CLAIM_TYPES = [
  { label: "Hurricane & wind" },
  { label: "Fire & smoke" },
  { label: "Water & pipe burst" },
  { label: "Flood" },
  { label: "Hail" },
  { label: "Roof damage" },
  { label: "Mold" },
  { label: "Business interruption", muted: true },
] as const;

export default function HomePage() {
  return (
    <>
      <LocalBusinessJsonLd />

      <Hero
        video
        kicker={site.tagline}
        headline={
          <>
            Your insurer has an adjuster.{" "}
            <span className="text-accent-300">Now you have one too.</span>
          </>
        }
        body="We document your loss, file your claim and negotiate with your carrier until the settlement reflects the damage. No fee unless we recover."
        actions={
          <>
            <Button href={claimHref}>Start your free claim review</Button>
            <Button href={telHref} variant="secondary">
              Call 24/7 &middot; {site.phone}
            </Button>
          </>
        }
      />

      <StatBand stats={STATS} label="CMG by the numbers" />

      <Section
        space="none"
        containerClassName="pb-[clamp(48px,6vw,80px)] pt-[clamp(72px,9vw,128px)]"
      >
        <div className="mb-[clamp(40px,5vw,64px)] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-end gap-x-12 gap-y-5">
          <div>
            <SectionKicker label="Who we represent" className="mb-[22px]" />
            <h2 className="max-w-[16ch] text-display-4 font-medium leading-[1.1] tracking-[-0.03em]">
              Three ways we take the claim off your desk.
            </h2>
          </div>
          <p className="max-w-[46ch] text-base leading-[1.7] text-ink/72">
            Whether it&apos;s a house, a portfolio or a client you referred, the
            work is the same: document everything, price it correctly, and hold
            the carrier to the policy.
          </p>
        </div>

        <CardGrid track="lg">
          <Card
            size="xl"
            eyebrow="01"
            title="Homeowners"
            href="/services"
            action="What we do"
          >
            Storm, fire, water or mold. We take over the paperwork, the
            inspections, the meetings and the negotiation. You look after your
            family.
          </Card>
          <Card
            size="xl"
            eyebrow="02"
            title="Commercial owners"
            href="/services"
            action="What we do"
          >
            Larger losses, harder policies. Property and business-interruption
            claims documented so thoroughly the carrier can&apos;t dismiss them.
          </Card>
          <Card
            size="xl"
            eyebrow="03"
            title="Contractors"
            href="/contractors"
            action="Partner with us"
          >
            Refer the claim and keep building. Higher settlements, more selling
            time, and no risk of adjusting without a license.
          </Card>
        </CardGrid>
      </Section>

      <Section>
        <SectionKicker label="Claims we handle" className="mb-[34px]" />
        <RuleList items={CLAIM_TYPES} label="Claims we handle" />
        <p className="mt-[30px] text-[15px] leading-[1.7] text-ink/62">
          Denied or underpaid on a past claim? Many closed claims can be
          reopened &mdash; <ProseLink href="/contact">ask us</ProseLink>.
        </p>
      </Section>

      <Section containerClassName="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-x-[clamp(32px,5vw,88px)] gap-y-10">
        <div>
          <SectionKicker label="On your side" className="mb-[22px]" />
          <h2 className="max-w-[15ch] text-display-5 font-medium leading-[1.12] tracking-[-0.03em]">
            We work the file so you don&apos;t have to.
          </h2>
          <p className="mt-[22px] max-w-[46ch] text-base leading-[1.7] text-ink/72">
            Every claim gets a full inspection, a line-by-line damage estimate
            and a documented demand. Your carrier&apos;s adjuster works for the
            insurance company. We work for you.
          </p>
          <Button
            href="/services"
            variant="secondary"
            size="compact"
            className="mt-7"
          >
            See how a claim works
          </Button>
        </div>
        <ImageSlot label="Storm damage inspection" />
      </Section>

      <Testimonial
        quote="The carrier's first offer was $19,400. CMG reopened the file, documented the property room by room, and settled at $112,000."
        attribution="R. Delgado &middot; Homeowner, Orlando"
      />

      <Section space="xl">
        <ClosingCta
          heading="Start with a free claim review."
          intro={
            <>
              Send your policy and a few photos, or ask for an inspection.
              We&apos;ll tell you plainly whether your claim is worth pursuing
              &mdash; no cost, no obligation.
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
