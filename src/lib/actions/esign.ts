"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prefillLorForClaim, sendLor, type PrefilledLorResult } from "@/lib/esign";
import {
  PROVIDER_FAILURE_MESSAGE,
  SIGNING_NOT_CONFIGURED_MESSAGE,
} from "@/lib/esign/lor-dispatch-failure";
import { ManualSignProvider } from "@/lib/esign/manual";
import type { FormState } from "./types";

const requestSchema = z.object({
  claimId: z.string().uuid(),
  requestId: z.string().uuid(),
  intent: z.enum(["electronic", "manual"]),
  reviewToken:z.string().max(4000).optional(),
  reviewConfirmed:z.boolean().optional(),
});

export async function submitLorRecovery(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = requestSchema.safeParse({
    claimId: formData.get("claimId"),
    requestId: formData.get("requestId"),
    intent: formData.get("intent"),
    reviewToken:typeof formData.get("reviewToken")==="string"?formData.get("reviewToken"):undefined,
    reviewConfirmed:formData.get("reviewConfirmed")==="yes",
  });
  if (!parsed.success) {
    return { status: "error", message: "That signing request is not available." };
  }

  const result = await sendLor(
    { claimId: parsed.data.claimId, requestId: parsed.data.requestId,...(parsed.data.reviewToken?{reviewToken:parsed.data.reviewToken,reviewConfirmed:parsed.data.reviewConfirmed}:{} ) },
    parsed.data.intent === "manual"
      ? { provider: new ManualSignProvider() }
      : undefined,
  );

  if (!result.ok) {
    const message = result.code === "provider_error"
      ? PROVIDER_FAILURE_MESSAGE
      : result.code === "not_configured"
        ? SIGNING_NOT_CONFIGURED_MESSAGE
        : result.message;
    return { status: "error", message };
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

/**
 * Hand a staff member the fully prefilled Letter of Representation.
 *
 * Not a send and not a status change: `prefillLorForClaim()` authorizes the
 * caller, re-runs the content gates a dispatch is refused by, writes the audit
 * row, and returns the bytes. Nothing touches the dispatch lease, so this can
 * be downloaded as many times as the desk needs.
 *
 * The bytes come back as base64 rather than as a response: a server action
 * returns a value to the caller, not an HTTP body, so the attachment
 * disposition is applied in the browser — the panel turns the payload into a
 * Blob and clicks an anchor carrying `download={filename}`, which is what
 * keeps a signable legal document out of an inline viewer.
 */
export async function downloadPrefilledLor(
  claimId: string,
): Promise<PrefilledLorResult> {
  return prefillLorForClaim(claimId);
}
