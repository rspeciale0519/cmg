import { EmptyState, Panel } from "@/components/admin/admin-shell";
import { ClaimantInvite } from "@/components/admin/claimant-invite";
import { ListPager, listMeta } from "@/components/admin/list-pager";
import {
  clampPage,
  firstParam,
  offsetBounds,
  parsePageNumber,
} from "@/lib/admin/paging";
import { loadClaimContext } from "@/lib/claims/queries";
import { formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Twenty-five, and paged by offset rather than by cursor.
 *
 * Offset is the wrong tool for a feed, because a row arriving at the top shifts
 * every later row down by one and the row on the page boundary is skipped. This
 * list is the opposite shape: it opens with the primary claimant and then runs
 * *oldest first*, so a new claimant appends to the end and nothing already on
 * screen moves. The failure offset is avoided for cannot occur here, and the
 * alternative would be a three-part `(is_primary, created_at, id)` cursor to buy
 * a property the ordering already has.
 *
 * The count is still a real `count: "exact"` — the same one the tab-strip badge
 * reads — because that is what the header was getting wrong.
 */
const PAGE_SIZE = 25;

export default async function ClaimantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { claim, can } = await loadClaimContext(id);
  const raw = await searchParams;
  const supabase = await createClient();

  const { count: total } = await supabase
    .from("claimants")
    .select("id", { count: "exact", head: true })
    .eq("claim_id", id);

  const page = clampPage(parsePageNumber(firstParam(raw, "page")), total ?? 0, PAGE_SIZE);
  const { from, to } = offsetBounds(page, PAGE_SIZE);

  const [claimants, invites] = await Promise.all([
    supabase
      .from("claimants")
      .select("id, first_name, last_name, email, phone, initials, is_primary, user_id, created_at")
      .eq("claim_id", id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
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
  const count = total ?? rows.length;

  const base = `/admin/claims/${id}/claimants`;
  const pageHref = (target: number) =>
    target <= 1 ? base : `${base}?page=${target}`;

  return (
    <Panel
      title="Claimants"
      meta={`${listMeta(rows.length, count, "claimant", "claimants")} on ${claim.claimRef}`}
    >
      {rows.length === 0 ? (
        <EmptyState headline="No claimants on this claim.">
          A claim created from the public intake form always carries at least the
          homeowner who submitted it.
        </EmptyState>
      ) : (
        <>
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

        <ListPager
          label="Claimant pages"
          noun="claimant"
          pluralNoun="claimants"
          placement="footer"
          shown={rows.length}
          total={count}
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={from + rows.length < count ? pageHref(page + 1) : null}
          startHref={page > 1 ? base : null}
        />
        </>
      )}
    </Panel>
  );
}
