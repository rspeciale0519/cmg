import type { Metadata } from "next";
import { WithdrawConsent } from "@/components/portal/consent-controls";
import { PortalHeading } from "@/components/portal/frame";
import { PasswordForm, ProfileForm } from "@/components/portal/profile-forms";
import { EmptyState, Panel, PanelBody } from "@/components/portal/surfaces";
import { requireRole } from "@/lib/authz";
import { formatDateStamp } from "@/lib/format";
import { portalProfile } from "@/lib/portal/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account",
};

const CONSENT_LABEL = {
  sms: "Text messages",
  email: "Email",
} as const;

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
  const { data: consents } = await supabase
    .from("consents")
    .select("id, kind, consent_text, granted_at, withdrawn_at, claim_id")
    .order("granted_at", { ascending: false });

  const rows = consents ?? [];

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
              <PasswordForm />
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
              {rows.map((consent) => {
                const withdrawn = consent.withdrawn_at !== null;

                return (
                  <li key={consent.id} className="px-[clamp(18px,2.4vw,28px)] py-[18px]">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                      <h3 className="text-[15px] font-medium leading-[1.35]">
                        {CONSENT_LABEL[consent.kind as "sms" | "email"]}
                      </h3>
                      <p
                        className={
                          withdrawn
                            ? "text-[12px] leading-[1.45] text-ink/58"
                            : "text-[12px] uppercase leading-[1.45] tracking-[0.13em] text-accent"
                        }
                      >
                        {withdrawn
                          ? `Withdrawn ${formatDateStamp(consent.withdrawn_at)}`
                          : "In force"}
                      </p>
                    </div>

                    <p className="mt-[6px] text-[12.5px] leading-[1.5] text-ink/58">
                      Given {formatDateStamp(consent.granted_at)}
                    </p>

                    {/* The exact text, verbatim, not a summary of it. This row is
                        evidence of what a person agreed to on a particular day,
                        and a paraphrase on the screen where they read it back is
                        the one place a paraphrase is not allowed. */}
                    <blockquote className="mt-[12px] border-l-2 border-ink/12 py-[2px] pl-[14px] text-[13px] leading-[1.7] text-ink/58">
                      {consent.consent_text}
                    </blockquote>

                    {/* Branched on the kind, and worded to match the sentence
                        `withdrawConsent` returns the moment the button is
                        pressed. It used to read "We will not contact you this
                        way about the claim this was given for." for both — which
                        for email contradicted the action's own answer seconds
                        earlier ("messages about the claim itself still reach
                        you") and was the false one of the two, because CMG does
                        email a homeowner about their claim. The two statements
                        are about the same act, and this is the compliance screen
                        that says a few lines up that these records are the proof
                        of what was agreed. */}
                    {withdrawn ? (
                      <p className="mt-[14px] text-[13px] leading-[1.65] text-ink/55">
                        {consent.kind === "sms"
                          ? "Withdrawn. We will not text you about this claim."
                          : "Withdrawn. We will not send you marketing email about this claim — messages about the claim itself still reach you."}
                      </p>
                    ) : (
                      <div className="mt-[14px]">
                        <WithdrawConsent
                          consentId={consent.id}
                          kind={consent.kind as "sms" | "email"}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
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
