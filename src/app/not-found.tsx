import type { Metadata } from "next";
import { PageGlow } from "@/components/marketing/page-glow";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SectionKicker } from "@/components/ui/section-kicker";
import { claimHref } from "@/lib/nav";
import { site, telHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  description:
    "That page has moved or no longer exists. Reach a licensed Florida public adjuster at CMG Property Solutions.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <PageGlow />

        <Section space="none" className="pt-[clamp(96px,14vh,168px)] pb-[clamp(72px,9vw,120px)]">
          <SectionKicker label="Page not found" className="mb-[26px]" />
          <h1 className="m-0 max-w-[14ch] text-display-3 font-medium leading-[1.05] tracking-[-0.035em]">
            That page isn&apos;t here.
          </h1>
          <p className="mt-7 max-w-[52ch] text-lede leading-[1.7] text-ink/85">
            The link may be out of date, or the page may have moved. If you were
            in the middle of a claim, nothing you sent has been lost — call us
            and we&apos;ll pick it up from where you left off.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button href="/">Back to home</Button>
            <Button href={claimHref} variant="secondary">
              File a claim
            </Button>
            <Button href={telHref} variant="secondary">
              Call 24/7 · {site.phone}
            </Button>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
