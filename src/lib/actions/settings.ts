"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/authz";
import type { FormState } from "./types";

/**
 * Re-runs the integration probes.
 *
 * The only action on this surface, because nothing on Settings is stored — see
 * `src/lib/settings/config.ts` for why every value there lives in code or in the
 * environment rather than in a table.
 *
 * It is deliberately not audited. `audit_log` is the record of what people
 * changed, and a reader that changes nothing would only add noise to the one
 * table an owner needs to be able to scan. `requireOwner()` still guards it: the
 * probe reports which integrations exist and how the environment is configured,
 * which is not a non-owner's business even though it writes nothing — and it is
 * `requireOwner` rather than `requireRole("owner")` so that every owner-only
 * action in this directory answers a one-factor session the same way.
 */
export async function recheckIntegrations(): Promise<FormState> {
  await requireOwner();
  revalidatePath("/admin/settings");
  return { status: "success", message: "Rechecked." };
}
