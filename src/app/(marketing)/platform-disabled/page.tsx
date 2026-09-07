import type { Metadata } from "next";
import { PageGlow } from "@/components/marketing/page-glow";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SectionKicker } from "@/components/ui/section-kicker";
import { claimHref } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Platform not enabled",
  description: "The CMG claims platform is not enabled on this website.",
  robots: { index: false, follow: false },
};

export default function PlatformDisabledPage() {
  return (
    <>
      <PageGlow />
      <Section
        space="none"
        className="pt-[clamp(96px,14vh,168px)] pb-[clamp(72px,9vw,120px)]"
      >
        <SectionKicker label="Platform not enabled" className="mb-[26px]" />
        <h1 className="m-0 max-w-[16ch] text-display-3 font-medium leading-[1.05] tracking-[-0.035em]">
          The claims platform is not enabled.
        </h1>
        <p className="mt-7 max-w-[52ch] text-lede leading-[1.7] text-ink/85">
          You can still use the claim form to send CMG your claim information.
          The private claims platform is not available on this website.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button href={claimHref}>File a claim</Button>
          <Button href="/" variant="secondary">
            Return home
          </Button>
        </div>
      </Section>
    </>
  );
}
