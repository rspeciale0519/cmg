import Link from "next/link";
import { ClaimRef, StatusPill } from "@/components/admin/status-pill";
import { isClaimStatus } from "@/lib/claims/status";
import { formatRelative } from "@/lib/format";
import type { Database } from "@/types/database-app";

type ClaimRow =
  Database["public"]["Functions"]["staff_claims_projection"]["Returns"][number];

type ClaimantName = {
  first_name: string;
  last_name: string;
  is_primary: boolean;
};

export function AdminClaimCards({
  claims,
  claimants,
  sortLabel,
}: {
  claims: readonly ClaimRow[];
  claimants: ReadonlyMap<string, readonly ClaimantName[]>;
  sortLabel: string;
}) {
  return (
    <ul
      aria-label={`Claims, sorted by ${sortLabel}`}
      className="divide-y divide-ink/10 xl:hidden"
    >
      {claims.map((claim) => {
        const people = claimants.get(claim.id);
        const primary = people?.find((person) => person.is_primary) ?? people?.[0];
        const homeowner = primary
          ? `${primary.first_name} ${primary.last_name}`.trim()
          : "—";
        const address = `${claim.property_street}, ${claim.property_city}, ${claim.property_state} ${claim.property_zip}`;

        return (
          <li
            key={claim.id}
            className="grid min-w-0 px-[clamp(14px,4vw,18px)] py-[14px] transition-colors duration-150 focus-within:bg-ink/[0.085] md:grid-cols-[minmax(0,1fr)_minmax(240px,0.55fr)] md:gap-x-8"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <Link
                  href={`/admin/claims/${claim.id}`}
                  className="tap-block text-ink no-underline transition-colors duration-150 hover:text-accent"
                >
                  <ClaimRef value={claim.claim_ref} />
                </Link>
                {isClaimStatus(claim.status) ? (
                  <StatusPill status={claim.status} />
                ) : null}
              </div>

              <div className="mt-[9px] min-w-0">
                <p className="break-words text-[14px] font-medium leading-[1.45] text-ink/85">
                  {homeowner}
                </p>
                <p className="mt-[2px] break-words text-[12px] leading-[1.5] text-ink/62">
                  {address}
                </p>
              </div>
            </div>

            <dl className="mt-[11px] grid grid-cols-2 gap-x-4 border-t border-ink/8 pt-[9px] md:mt-0 md:self-end">
              <div className="min-w-0">
                <dt className="text-[10px] uppercase leading-[1.4] tracking-[0.13em] text-ink/58">
                  Adjuster
                </dt>
                <dd className="mt-[3px] truncate text-[12px] leading-[1.45] text-ink/68">
                  {claim.adjuster_name || (
                    <span className="text-accent/70">Unassigned</span>
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase leading-[1.4] tracking-[0.13em] text-ink/58">
                  Updated
                </dt>
                <dd className="mt-[3px] whitespace-nowrap text-[12px] leading-[1.45] text-ink/62 tabular-nums">
                  <time dateTime={claim.updated_at}>
                    {formatRelative(claim.updated_at)}
                  </time>
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
