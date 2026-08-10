import type { Metadata } from "next";
import { PortalCard, PortalShell } from "@/components/auth/portal-shell";
import { requireStaff } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { InvitePanel, type InvitableClaimant } from "./invite-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  adjuster: "Adjuster",
  assistant: "Assistant",
};

export default async function AdminPage() {
  // Role *and* aal2 in one call. Reaching this line means the proxy let the
  // request through and the page agreed independently — the two checks are
  // deliberately redundant, because the proxy decides on a path prefix and this
  // one decides on the session.
  const session = await requireStaff("/admin");
  const supabase = await createClient();

  const [claims, leads, claimants, profile] = await Promise.all([
    supabase.from("claims").select("id, status", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase
      .from("claimants")
      .select("id, first_name, last_name, email, user_id, claims!inner(claim_ref)")
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", session.userId)
      .maybeSingle(),
  ]);

  const name = [profile.data?.first_name, profile.data?.last_name]
    .filter(Boolean)
    .join(" ");

  // Only owners and assigned adjusters may issue an invitation; the action
  // enforces it, and hiding the control from an assistant keeps the UI from
  // offering a button that will always be refused.
  const canInvite = session.role === "owner" || session.role === "adjuster";

  const invitable: InvitableClaimant[] = (claimants.data ?? []).map((row) => ({
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    claimRef: row.claims?.claim_ref ?? "—",
  }));

  return (
    <PortalShell
      surface="Admin"
      heading="Claims desk."
      intro="The queue, claims, documents and financials arrive here in the next phase. What is live now is the access layer: who is signed in, what they may reach, and who has been invited to a portal."
      identity={{ name: name || (session.email ?? "Staff"), role: ROLE_LABELS[session.role] ?? session.role }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <PortalCard title={String(claims.count ?? 0)} meta="Claims visible to you" />
        <PortalCard title={String(leads.count ?? 0)} meta="Leads in the inbox" />
        <PortalCard title={String(invitable.length)} meta="Awaiting invitation" />
      </div>

      <div className="mt-4">
        {canInvite ? (
          <InvitePanel claimants={invitable} />
        ) : (
          <section className="border border-ink/13 bg-surface/55 p-[clamp(20px,2.4vw,28px)]">
            <h2 className="text-[20px] font-medium leading-[1.25] tracking-[-0.02em]">
              Portal invitations
            </h2>
            <p className="mt-[10px] max-w-[64ch] text-[15px] leading-[1.7] text-ink/72">
              Invitations are issued by the owner or by the adjuster a claim is
              assigned to.
            </p>
          </section>
        )}
      </div>
    </PortalShell>
  );
}
