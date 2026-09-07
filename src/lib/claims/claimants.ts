import "server-only";

import { collectPostgrestPages } from "@/lib/supabase/collect-pages";
import { createClient } from "@/lib/supabase/server";

export type ClaimantSummary = {
  claim_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  is_primary: boolean;
};

/** Full claimant sets for an already-bounded parent window. */
export async function loadClaimantSummaries(
  claimIds: readonly string[],
): Promise<ReadonlyMap<string, ClaimantSummary[]>> {
  const ids = [...new Set(claimIds)];
  if (ids.length === 0) return new Map();

  const supabase = await createClient();
  const rows = await collectPostgrestPages((from, to) =>
    supabase
      .from("claimants")
      .select("claim_id, first_name, last_name, email, phone, is_primary")
      .in("claim_id", ids)
      .order("claim_id", { ascending: true })
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  const grouped = new Map<string, ClaimantSummary[]>();
  for (const row of rows) {
    const group = grouped.get(row.claim_id) ?? [];
    group.push(row);
    grouped.set(row.claim_id, group);
  }
  return grouped;
}
