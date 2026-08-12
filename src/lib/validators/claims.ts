import { z } from "zod";
import { CARRIER_TENURE_VALUES } from "./intake-options";

/**
 * The policy side of a claim — the three columns a partner referral arrives
 * without, and the one schema that decides what CMG will accept for them.
 *
 * Two callers now read it. `acceptIntake` collects them at the moment §6
 * nominates, and `saveClaimPolicy` is where a correction is made afterwards or a
 * first entry is made on a claim that left the queue by the status picker rather
 * than through the accept form. Written once here, because two hand-rolled
 * copies of "required, 120 characters, one of three enum labels" are two places
 * for a bound to drift — and the desk must not accept a carrier the public form
 * would refuse.
 *
 * The bounds are `intakeSchema`'s for the same columns, and the messages are the
 * ones the accept form already showed.
 */
export const claimPolicySchema = z.object({
  carrier: z
    .string()
    .trim()
    .min(1, "Name the insurance company.")
    .max(120, "Carrier must be 120 characters or fewer."),
  policyNumber: z
    .string()
    .trim()
    .min(1, "Enter the policy number.")
    .max(80, "Policy number must be 80 characters or fewer."),
  /* No "unknown" label, and that is deliberate rather than an omission: each of
     the three is a length of time, so any of them would assert on the
     homeowner's behalf a fact nobody collected. A claim states the absence
     instead, until somebody asks. */
  carrierTenure: z.enum(CARRIER_TENURE_VALUES, {
    error: "Say how long they have been with this carrier.",
  }),
});

export type ClaimPolicyInput = z.infer<typeof claimPolicySchema>;

/**
 * The strings the policy panel re-seeds after a refusal. Named once here rather
 * than at each call site, because a field left off this list is a field the
 * operator retypes.
 */
export const CLAIM_POLICY_FIELDS = [
  "carrier",
  "policyNumber",
  "carrierTenure",
] as const;
