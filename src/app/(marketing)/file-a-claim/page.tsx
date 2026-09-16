import type { Metadata } from "next";
import { IntakeForm } from "@/components/forms/intake-form";
import { PageGlow } from "@/components/marketing/page-glow";
import { Section } from "@/components/ui/section";
import { SectionKicker } from "@/components/ui/section-kicker";
import { site } from "@/lib/site";

// Each action verifies at most one 25 MiB file with a shorter bounded read budget.
export const maxDuration = 300;

const DESCRIPTION =
  "Start your claim with CMG Property Solutions. Complete the intake and we'll prepare the Letter of Representation for signature by every party on the policy.";

export const metadata: Metadata = {
  title: "File a claim",
  description: DESCRIPTION,
  alternates: { canonical: "/file-a-claim" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: site.name,
    url: "/file-a-claim",
    title: `File a claim — ${site.name}`,
    description: DESCRIPTION,
  },
};

export default async function FileAClaimPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Repeated or oversized codes must fail closed at submission, not lose attribution.
  const code = params.ref;
  const referralCode = code === undefined ? "" : typeof code === "string" && code.length <= 36 ? code : "invalid";
  return (
    <>
      <PageGlow />

      <Section space="none" className="pt-[clamp(56px,7vw,96px)]">
        <SectionKicker label="File a claim" className="mb-[26px]" />
        <h1 className="m-0 max-w-[16ch] text-display-3 font-medium leading-[1.05] tracking-[-0.035em]">
          Letter of Representation.
        </h1>
        <p className="mt-7 max-w-[58ch] text-lede leading-[1.7] text-ink/85">
          Complete this intake and we&apos;ll prepare the Letter of Representation for
          signature by every party on the policy. Most answers are on your policy&apos;s
          declarations page — or one call to your carrier away. Referring reps can fill this
          out with the homeowner.
        </p>
      </Section>

      <Section
        space="none"
        className="pt-[clamp(40px,5vw,64px)] pb-[clamp(72px,9vw,120px)]"
      >
        <IntakeForm referralCode={referralCode} />
      </Section>
    </>
  );
}
