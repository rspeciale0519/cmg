import type { Metadata } from "next";
import { PageGlow } from "@/components/marketing/page-glow";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SectionKicker } from "@/components/ui/section-kicker";
import { claimHref } from "@/lib/nav";

/**
 * Reached in three different situations, and the copy has to be true in all of
 * them: simple mode, where nothing private exists; staff mode, where the CMG
 * desk is open but the homeowner and partner portals are not; and staff mode
 * again for a customer or partner who has just signed in successfully and has
 * no surface to land on. So it says nothing about "the platform" as a whole,
 * makes no promise about when, and always leaves a way to reach CMG.
 */
export const metadata: Metadata = {
  title: "Online account not available",
  description: "The CMG online claim account is not available on this website.",
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
        <SectionKicker label="Not available yet" className="mb-[26px]" />
        <h1 className="m-0 max-w-[18ch] text-display-3 font-medium leading-[1.05] tracking-[-0.035em]">
          Online claim accounts are not open yet.
        </h1>
        <p className="mt-7 max-w-[52ch] text-lede leading-[1.7] text-ink/85">
          You cannot sign in to a claim account on this website yet. Your claim is
          not affected, and CMG still has everything you have sent us.
        </p>
        <p className="mt-5 max-w-[52ch] text-lede leading-[1.7] text-ink/85">
          Use the claim form to send CMG new information. If you have a claim
          already, call or email your adjuster and they will help you directly.
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
