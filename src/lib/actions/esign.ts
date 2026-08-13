"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendLor } from "@/lib/esign";
import { ManualSignProvider } from "@/lib/esign/manual";
import type { FormState } from "./types";

const requestSchema = z.object({
  claimId: z.string().uuid(),
  requestId: z.string().uuid(),
  intent: z.enum(["electronic", "manual"]),
});

export async function submitLorRecovery(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = requestSchema.safeParse({
    claimId: formData.get("claimId"),
    requestId: formData.get("requestId"),
    intent: formData.get("intent"),
  });
  if (!parsed.success) {
    return { status: "error", message: "That signing request is not available." };
  }

  const result = await sendLor(
    { claimId: parsed.data.claimId, requestId: parsed.data.requestId },
    parsed.data.intent === "manual"
      ? { provider: new ManualSignProvider() }
      : undefined,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(`/admin/claims/${parsed.data.claimId}`, "layout");
  revalidatePath("/admin/claims");
  revalidatePath("/admin");

  return {
    status: "success",
    message: result.deliveredByProvider
      ? `Signing request sent to ${result.recipients.join(" and ")}.`
      : "Manual signing is ready. Deliver the letter outside the system, then upload the signed copy.",
  };
}
