import { EmptyState, Panel } from "@/components/admin/admin-shell";
import { ClaimantInvite } from "@/components/admin/claimant-invite";
import { loadClaimContext } from "@/lib/claims/queries";
import { formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClaimantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { claim, can } = await loadClaimContext(id);
  const supabase = await createClient();

  const [claimants, invites] = await Promise.all([
    supabase
      .from("claimants")
      .select("id, first_name, last_name, email, phone, initials, is_primary, user_id, created_at")
      .eq("claim_id", id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    // `invites_all_owner` scopes this table to owners, so an adjuster reads
    // nothing here and the "pending" hint simply does not appear for them. The
    // button still works — issuance is service-role behind an app-level authz
    // check — so the missing hint costs a nicety, not a capability.
    can.isOwner
      ? supabase
          .from("invites")
          .select("email, expires_at, accepted_at")
          .eq("claim_id", id)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [] as { email: string }[] }),
  ]);

  const pending = new Set((invites.data ?? []).map((row) => row.email.toLowerCase()));
  const rows = claimants.data ?? [];

  return (
    <Panel
      title="Claimants"
      meta={`${rows.length} on ${claim.claimRef}`}
    >
      {rows.length === 0 ? (
        <EmptyState headline="No claimants on this claim.">
          A claim created from the public intake form always carries at least the
          homeowner who submitted it.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-ink/8">
          {rows.map((person) => (
            <li
              key={person.id}
              className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-[clamp(14px,1.6vw,20px)] py-[15px]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-[14px] font-medium leading-[1.35] tracking-[-0.01em]">
                    {`${person.first_name} ${person.last_name}`.trim()}
                  </h3>
                  {person.is_primary ? (
                    <span className="rounded-full border border-accent/35 px-[8px] py-[2px] text-[10.5px] uppercase leading-[1.4] tracking-[0.11em] text-accent/85">
                      Primary
                    </span>
                  ) : null}
                </div>

                <p className="mt-[5px] flex flex-wrap gap-x-4 text-[12.5px] leading-[1.5]">
                  <a
                    href={`mailto:${person.email}`}
                    className="text-ink/72 no-underline transition-colors duration-150 hover:text-accent"
                  >
                    {person.email}
                  </a>
                  {person.phone ? (
                    <a
                      href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}
                      className="tabular-nums text-ink/72 no-underline transition-colors duration-150 hover:text-accent"
                    >
                      {person.phone}
                    </a>
                  ) : null}
                </p>

                <p className="mt-[5px] text-[12px] leading-[1.45] text-ink/38">
                  {person.user_id
                    ? "Signed in to the homeowner portal"
                    : pending.has(person.email.toLowerCase())
                      ? "Invitation sent, not yet accepted"
                      : "No invitation outstanding"}
                  <span className="text-ink/25">
                    {" "}
                    · added {formatTimestamp(person.created_at)}
                  </span>
                </p>
              </div>

              <ClaimantInvite
                claimantId={person.id}
                hasAccount={Boolean(person.user_id)}
                hasPendingInvite={pending.has(person.email.toLowerCase())}
                canInvite={can.canManage}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
