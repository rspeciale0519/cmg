import type { Metadata } from "next";
import { PageHeader, Panel, PanelBody } from "@/components/admin/admin-shell";
import { Fact, FactList } from "@/components/admin/data-table";
import { IntegrationList } from "@/components/admin/integration-list";
import { RecheckButton } from "@/components/admin/recheck-button";
import { metadataForRole, requireRole } from "@/lib/authz";
import {
  FEE_PERCENT_DEFAULT,
  LOR_TEMPLATE_ROLES,
  LOR_TEMPLATE_TOKENS,
} from "@/lib/settings/config";
import { loadIntegrations } from "@/lib/settings/status";
import { site } from "@/lib/site";

/* Never cached. The integration panel's whole claim is that it reports the
   environment as it is on this request — a cached render of it would be a
   screenshot of a past environment presented as the present one, which is worse
   than not having the panel. */
export const dynamic = "force-dynamic";

/* `generateMetadata` and not `export const metadata`, because a static title is
   emitted whether or not the component below ever renders — so a non-owner got
   the workspace 404 in the body and this page's real name in the tab. See
   `metadataForRole`. */
export async function generateMetadata(): Promise<Metadata> {
  return metadataForRole(["owner"], "Settings");
}

/**
 * Owner only; a non-owner gets `notFound()` (spec §7.9).
 *
 * A configuration console rather than a settings form, and that is the honest
 * shape for what §9 lists. Organisation details are compiled into six
 * statically-rendered marketing pages, the LOR template is a server-only
 * credential, and the fee default is application policy — so every value here
 * is read-only, each one says where it lives, and none pretends to save.
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
            Used as the starting value on the Financials tab when a claim has no
            fee on record. It is not saved until an owner or the assigned
            adjuster saves that claim, and the letter of representation uses only
            the saved per-claim value. Change the default in{" "}
            <code className="text-ink/72">src/lib/settings/config.ts</code>;
            because it is business policy, changing it is reviewed and deployed
            with the application rather than silently rewriting it from a browser.
          </p>
        </PanelBody>
      </Panel>

      <Panel title="Letter of representation" className="mt-[clamp(16px,2vw,24px)]">
        <PanelBody>
          <FactList columns={2}>
            <Fact label="Signer roles">{LOR_TEMPLATE_ROLES.join(", ")}</Fact>
            <Fact label="Two-signer template">
              <code className="text-ink/72">PANDADOC_LOR_TEMPLATE_UUID</code>
            </Fact>
            <Fact label="One-signer template">
              <code className="text-ink/72">PANDADOC_LOR_TEMPLATE_UUID_SINGLE</code>
            </Fact>
            <Fact label="Template content">PandaDoc editor</Fact>
          </FactList>

          <div className="mt-[17px] border-t border-ink/10 pt-[15px]">
            <p className="text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/58">
              Required token names
            </p>
            <ul className="mt-[9px] flex flex-wrap gap-x-5 gap-y-2" aria-label="Required PandaDoc token names">
              {LOR_TEMPLATE_TOKENS.map((token) => (
                <li key={token}>
                  <code className="text-[12px] text-ink/72">{token}</code>
                </li>
              ))}
            </ul>
          </div>
        </PanelBody>

        <PanelBody className="border-t border-ink/10">
          <p className="max-w-[84ch] text-[12.5px] leading-[1.65] text-ink/55">
            Template wording, signature fields and role assignments live in
            PandaDoc; the application supplies the values listed above from{" "}
            <code className="text-ink/72">src/lib/esign/lor-dispatch.ts</code>.
            Template IDs are server-only environment configuration, so this page
            reports whether they are present without exposing their values. Edit
            the provider template and set the matching environment variables,
            then use Recheck above before sending a live letter.
          </p>
        </PanelBody>
      </Panel>
    </>
  );
}
