import { Section } from "@/components/ui/section";
import { SectionKicker } from "@/components/ui/section-kicker";
import type { PolicySection } from "@/lib/policies/content";
import { emailHref, site, telHref } from "@/lib/site";

export function PolicyPage({
  title,
  draft,
  sections,
}: {
  title: string;
  draft: boolean;
  sections: readonly PolicySection[];
}) {
  return (
    <Section measure="narrow" space="lg">
      <div className="max-w-[72ch]">
        <SectionKicker label={site.name} className="mb-6" />
        <h1 className="text-display-3 font-medium leading-tight tracking-tight">{title}</h1>
        {draft && (
          <p className="mt-6 border-s-2 border-accent ps-4 text-base leading-relaxed text-ink/85">
            Draft for owner review. This page is not published.
          </p>
        )}
        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.heading} aria-label={section.heading}>
              <h2 className="text-xl font-medium leading-snug">{section.heading}</h2>
              <div className="mt-4 space-y-4 text-base leading-[1.75] text-ink/80">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
          <section aria-label="Contact CMG">
            <h2 className="text-xl font-medium">Contact CMG</h2>
            <address className="mt-4 space-y-2 text-base not-italic leading-relaxed text-ink/80">
              <p>{site.name}</p>
              <p><a className="break-words underline underline-offset-4 hover:text-ink" href={emailHref}>{site.email}</a></p>
              <p><a className="underline underline-offset-4 hover:text-ink" href={telHref}>{site.phone}</a></p>
            </address>
          </section>
        </div>
      </div>
    </Section>
  );
}
