import { claimPolicySchema, type ClaimPolicyInput } from "@/lib/validators/claims";
import { fieldErrorsFrom } from "./types";

export function readIntakePolicyDetails(
  formData: FormData,
): ClaimPolicyInput | { fieldErrors: Record<string, string> } {
  const parsed = claimPolicySchema.safeParse({
    carrier: formData.get("carrier") ?? "",
    policyNumber: formData.get("policyNumber") ?? "",
    carrierTenure: formData.get("carrierTenure") ?? "",
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  return parsed.data;
}
