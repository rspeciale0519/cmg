import type { Metadata } from "next";
import {
  PortalCard,
  PortalEmpty,
  PortalShell,
} from "@/components/auth/portal-shell";
import { requireRole } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your claim",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  new_intake: "Received",
  under_review: "Received",
  lor_sent: "Representation",
  lor_signed: "Representation",
  documenting: "Documenting",
  filed: "With your carrier",
  negotiating: "With your carrier",
  settlement_offered: "With your carrier",
  denied: "With your carrier",
  reopened: "With your carrier",
  settled: "Resolved",
  closed: "Resolved",
  rejected: "Closed",
};

export default async function PortalPage() {
  const session = await requireRole("customer");
  const supabase = await createClient();

  // No `.eq()` on anything. `claims_select` restricts a customer to the claims
  // they are a claimant on, so an unfiltered select is *already* their own
  // claims and nobody else's — the filter is the policy, not the query. A WHERE
  // clause here would be a second, weaker copy of that rule that could drift
  // from it.
  const [{ data: claims }, { data: profile }] = await Promise.all([
    supabase
      .from("claims")
      .select(
        "id, claim_ref, status, property_street, property_city, property_state, property_zip, loss_date, carrier",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", session.userId)
      .maybeSingle(),
  ]);

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  return (
    <PortalShell
      surface="Client portal"
      heading={claims && claims.length === 1 ? "Your claim." : "Your claims."}
      intro="Everything CMG has on file for you. Documents, the activity feed and your adjuster's replies arrive here as the claim moves."
      identity={{ name: name || (session.email ?? "Client"), role: "Homeowner" }}
    >
      {!claims || claims.length === 0 ? (
        <PortalEmpty>
          Nothing is attached to your account yet. If you have just filed, we will
          link your claim when it is accepted.
        </PortalEmpty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {claims.map((claim) => (
            <PortalCard
              key={claim.id}
              title={claim.claim_ref}
              meta={STATUS_LABELS[claim.status] ?? claim.status}
            >
              <p className="text-ink">
                {claim.property_street}, {claim.property_city}, {claim.property_state}{" "}
                {claim.property_zip}
              </p>
              <p className="mt-2">
                {claim.carrier} · loss dated{" "}
                {new Date(`${claim.loss_date}T00:00:00`).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </PortalCard>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
