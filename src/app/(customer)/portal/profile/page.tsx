import type { Metadata } from "next";
import { ConsentRecord } from "@/components/portal/consent-record";
import { PortalHeading } from "@/components/portal/frame";
import { PasswordForm, ProfileForm } from "@/components/portal/profile-forms";
import { EmptyState, Panel, PanelBody } from "@/components/portal/surfaces";
import { requireRole } from "@/lib/authz";
import { portalProfile } from "@/lib/portal/queries";
import { createClient } from "@/lib/supabase/server";
import { collectPostgrestPages } from "@/lib/supabase/collect-pages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account",
};

export default async function PortalProfilePage() {
  const session = await requireRole("customer");
  const profile = await portalProfile();
  const supabase = await createClient();

  /* `consents_select` narrows a customer to rows on a claim they are on *and*
     carrying an address that is theirs — `private.is_consent_subject(email)`.
     A claim routinely has two claimants, and without that second condition a
     co-homeowner would read the other party's email, phone and submitting IP.
     So this unfiltered select returns exactly this person's own consent
     records, across every claim they are on. */
  const consents = await collectPostgrestPages(
    (from, to) =>
      supabase
        .from("consents")
        .select("id, kind, consent_text, granted_at, withdrawn_at, claim_id")
        .order("granted_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
  );

  const rows = consents;

  return (
    <>
      <PortalHeading
        kicker="Your account"
        title="Your details."
        intro="How we reach you, what you agreed to, and the password you sign in with."
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          <Panel title="How we reach you">
            <PanelBody>
              <ProfileForm
                profile={
                  profile ?? { first_name: null, last_name: null, phone: null }
                }
                email={session.email}
              />
            </PanelBody>
          </Panel>

          <Panel title="Password">
            <PanelBody>
              <PasswordForm email={session.email} />
            </PanelBody>
          </Panel>
        </div>

        <Panel title="What you agreed to" meta={`${rows.length} on record`}>
          {rows.length === 0 ? (
            <EmptyState headline="No consent records are on your account.">
              These are created when you file a claim with us and record exactly
              what you agreed to at the time.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-ink/8">
              {rows.map((consent) => (
                <li key={consent.id}>
                  <ConsentRecord
                    consent={{
                      ...consent,
                      kind: consent.kind as "sms" | "email",
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Said plainly rather than implied by a disabled field. The record is
              immutable by database guard — public.guard_consent_immutable()
              raises on any change to the text, the address, the phone, the kind
              or the date for every caller holding a session — so the honest
              thing is to state that the record cannot be rewritten and that
              withdrawal is an annotation on it, not an edit to it. Claiming
              otherwise would misrepresent what this page can do. */}
          <div className="border-t border-ink/9 px-[clamp(18px,2.4vw,28px)] py-[16px]">
            <p className="max-w-[54ch] text-[12.5px] leading-[1.7] text-ink/58">
              These records cannot be changed, by us or by you — they are the
              proof of what you agreed to and when. Withdrawing adds the date you
              withdrew; it never rewrites the original. To give permission again,
              call us.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
