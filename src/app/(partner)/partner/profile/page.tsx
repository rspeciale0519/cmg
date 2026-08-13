import type { Metadata } from "next";
import { PortalShell } from "@/components/auth/portal-shell";
import { PartnerNav } from "@/components/partner/partner-nav";
import { FactList, Panel, PanelBody } from "@/components/portal/surfaces";
import { loadPartnerCompanyProfile } from "@/lib/partner/queries";
import { partnerIdentity } from "@/lib/portal/partner-identity";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Company profile",
  robots: { index: false, follow: false },
};

export default async function PartnerProfilePage() {
  const [identity, company] = await Promise.all([
    partnerIdentity(),
    loadPartnerCompanyProfile(),
  ]);

  return (
    <PortalShell
      surface="Partner portal"
      heading="Your company."
      intro="The contact information CMG has on file for your referral relationship."
      identity={identity}
    >
      <PartnerNav />
      <Panel title={company.name} meta="Read only">
        <PanelBody>
          <FactList
            items={[
              { term: "Primary contact", value: company.contact_name ?? "Not on file" },
              {
                term: "Email",
                value: company.contact_email ? (
                  <a className="break-all text-accent no-underline" href={`mailto:${company.contact_email}`}>
                    {company.contact_email}
                  </a>
                ) : "Not on file",
              },
              {
                term: "Phone",
                value: company.contact_phone ? (
                  <a className="text-accent no-underline" href={`tel:${company.contact_phone.replace(/[^+\d]/g, "")}`}>
                    {company.contact_phone}
                  </a>
                ) : "Not on file",
              },
            ]}
          />
          <p className="mt-6 border-t border-ink/9 pt-5 text-[13px] leading-[1.7] text-ink/58">
            Company details are maintained by CMG. Contact the office if anything here needs changing.
          </p>
        </PanelBody>
      </Panel>
    </PortalShell>
  );
}
