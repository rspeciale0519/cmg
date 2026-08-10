"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/authz";
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
 * table an owner needs to be able to scan. `requireRole("owner")` still guards
 * it: the probe reports which integrations exist and how the environment is
 * configured, which is not a non-owner's business even though it writes nothing.
 */
export async function recheckIntegrations(): Promise<FormState> {
  await requireRole("owner");
  revalidatePath("/admin/settings");
  return { status: "success", message: "Rechecked." };
}
