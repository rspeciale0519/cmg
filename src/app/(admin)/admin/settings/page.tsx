import type { Metadata } from "next";
import { PageHeader, Panel, PanelBody } from "@/components/admin/admin-shell";
import { Fact, FactList } from "@/components/admin/data-table";
import { IntegrationList } from "@/components/admin/integration-list";
import { RecheckButton } from "@/components/admin/recheck-button";
import { requireRole } from "@/lib/authz";
import { FEE_PERCENT_DEFAULT } from "@/lib/settings/config";
import { loadIntegrations } from "@/lib/settings/status";
import { site } from "@/lib/site";

/* Never cached. The integration panel's whole claim is that it reports the
   environment as it is on this request — a cached render of it would be a
   screenshot of a past environment presented as the present one, which is worse
   than not having the panel. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

/**
 * Owner only; a non-owner gets `notFound()` (spec §7.9).
 *
 * A configuration console rather than a settings form, and that is the honest
 * shape for what §9 lists. Organisation details are compiled into six
 * statically-rendered marketing pages, the LOR template is a server-only
 * credential, and the fee default has no consumer yet — so every value here is
 * read-only, each one says where it lives, and none of them pretends to save.
 * `src/lib/settings/config.ts` records the reasoning in full.
 *
 * The integrations panel is the part that earns the screen. It is measured, not
 * declared: the Supabase row is a real query timed on this request, and the
 * other three are read from the process environment every time the page renders.
 * It is how an owner finds out that Turnstile is still on Cloudflare's test keys
 * and the public forms have no bot protection at all.
 */
export default async function SettingsPage() {
  await requireRole("owner");
  const integrations = await loadIntegrations();

  const needsAttention = integrations.filter(
    (integration) => integration.state === "attention",
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Owner"
        title="Settings."
        lede="What this environment is wired to, and where each of these values is set. Nothing on this screen is stored in the database — see the note under each panel for what changing it takes."
      />

      <Panel
        title="Integrations"
        meta={
          needsAttention === 0
            ? "checked on this request"
            : `${needsAttention} needing attention`
        }
        actions={<RecheckButton />}
      >
        <IntegrationList integrations={integrations} />
      </Panel>

      <Panel title="Organisation" className="mt-[clamp(16px,2vw,24px)]">
        <PanelBody>
          <FactList columns={3}>
            <Fact label="Trading name">{site.name}</Fact>
            <Fact label="Licensee">{site.licensee}</Fact>
            <Fact label="Florida licence">
              <span className="tabular-nums">{site.license}</span>
            </Fact>
            <Fact label="Phone">
              <span className="tabular-nums">{site.phone}</span>
            </Fact>
            <Fact label="Email">{site.email}</Fact>
            <Fact label="Based in">{site.city}</Fact>
            <Fact label="Service area">{site.serviceArea}</Fact>
            <Fact label="Public site">{site.url}</Fact>
          </FactList>
        </PanelBody>

        <PanelBody className="border-t border-ink/10">
          <p className="max-w-[84ch] text-[12.5px] leading-[1.65] text-ink/55">
            Set in{" "}
            <code className="text-ink/72">src/lib/site.ts</code> and read from
            there by everything that shows them — the site header and footer, the
            contact page, the licence line on every claim letter, and the
            LocalBusiness structured data search engines index. Those six
            marketing pages are prerendered at build time, so these values are
            baked into the HTML that gets served; changing one is a deploy, not a
            save. That is deliberate: a licence number that could be edited from
            a browser session is a licence number that can be edited from a
            stolen browser session.
          </p>
        </PanelBody>
      </Panel>

      <Panel title="Claim defaults" className="mt-[clamp(16px,2vw,24px)]">
        <PanelBody>
          <FactList columns={3}>
            <Fact label="Standard fee">
              <span className="tabular-nums">{FEE_PERCENT_DEFAULT}%</span>
            </Fact>
          </FactList>

          <p className="mt-[15px] max-w-[84ch] text-[12.5px] leading-[1.65] text-ink/55">
            The figure a new representation agreement is written against. It is a
            reference, not a rule: the fee that binds any given claim is the one
            recorded on that claim&rsquo;s Financials tab, which the owner and
            the assigned adjuster set per claim and which is the only value the
            letter of representation ever carries.
          </p>
        </PanelBody>
      </Panel>
    </>
  );
}
