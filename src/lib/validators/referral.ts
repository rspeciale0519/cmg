import { z } from "zod";
import { CAUSE_VALUES, US_STATES } from "./intake-options";
import {
  lossDate,
  optionalText,
  requiredEmail,
  requiredName,
  requiredPhone,
  turnstileToken,
  zip,
} from "./shared";

/**
 * What a referring contractor sends CMG about somebody else's roof.
 *
 * Deliberately the intake's shape minus everything the rep is not in a position
 * to know. There is no carrier, no policy number, no carrier tenure, no prior
 * roof claim and no initials: spec §6 has staff complete the policy side when
 * they accept, and a rep guessing at a policy number produces a claim file that
 * has to be corrected before it can be used.
 *
 * There is no consent field either, and its absence is the point rather than an
 * omission — see the note in `@/lib/actions/referral`.
 *
 * `cause` reuses the intake's enum, and `lossDate`, `zip`, the name, email and
 * phone primitives are the intake's own: the two forms describe the same loss to
 * the same desk, so a date the public form refuses must not be one this form
 * accepts.
 */

const cause = z.enum(CAUSE_VALUES, { error: "Choose the cause of loss." });

export const referralSchema = z.object({
  firstName: requiredName("Homeowner's first name"),
  lastName: requiredName("Homeowner's last name"),
  email: requiredEmail,
  phone: requiredPhone,

  street: z.string().trim().min(1, "Street address is required.").max(160),
  street2: optionalText(160),
  city: z.string().trim().min(1, "City is required.").max(80),
  state: z.enum(US_STATES),
  zip,

  lossDate,
  cause,
  description: z
    .string()
    .trim()
    .min(5, "Tell us briefly what happened at the property.")
    .max(5000),

  turnstileToken,
});

export type ReferralInput = z.infer<typeof referralSchema>;

/**
 * The strings the form re-seeds after a refusal, in the order they appear on the
 * page. Named once here rather than at the two call sites, because a field left
 * off this list is a field the rep retypes.
 */
export const REFERRAL_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "street",
  "street2",
  "city",
  "state",
  "zip",
  "lossDate",
  "cause",
  "description",
] as const;
