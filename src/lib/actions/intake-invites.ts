import { issueInvite } from "@/lib/invites";
import { collectPostgrestPages } from "@/lib/supabase/collect-pages";
import { createClient } from "@/lib/supabase/server";

export async function inviteIntakeClaimants(
  claimId: string,
  claimRef: string,
  invitedBy: string,
  ip: string | null,
): Promise<{ issued: number; queued: number; unqueued: number; failed: number }> {
  const supabase = await createClient();
  const claimants = await collectPostgrestPages((from, to) =>
    supabase
      .from("claimants")
      .select("id, first_name, email, user_id")
      .eq("claim_id", claimId)
      .is("user_id", null)
      .order("id", { ascending: true })
      .range(from, to),
  );

  let issued = 0;
  let queued = 0;
  let unqueued = 0;
  let failed = 0;

  for (const claimant of claimants) {
    const result = await issueInvite({
      email: claimant.email,
      role: "customer",
      claimId,
      invitedBy,
      firstName: claimant.first_name,
      claimRef,
      ip,
    });

    if (!result.ok) {
      failed += 1;
    } else {
      issued += 1;
      if (result.queued) queued += 1;
      else unqueued += 1;
    }
  }

  return { issued, queued, unqueued, failed };
}
