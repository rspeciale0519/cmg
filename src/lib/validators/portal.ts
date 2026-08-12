import { z } from "zod";
import { passwordSchema } from "./password";
import { requiredName } from "./shared";

/**
 * The portal's own schemas. Shared with nothing: a homeowner editing their own
 * name is a different act from staff editing a claimant record, and folding
 * them together is how the stricter of the two rules ends up applied to the
 * wrong person.
 */

/**
 * The longest a question can be, matching `postClaimEvent`'s limit on the staff
 * side so that the two ends of one conversation cannot disagree about what fits
 * in it. `claim_events_body_not_blank` is the database's half of the floor.
 */
export const QUESTION_MAX_LENGTH = 4000;

export const questionSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write your question before sending it.")
    .max(
      QUESTION_MAX_LENGTH,
      "That is longer than one message can hold. Send it in two, or call us.",
    ),
});

/**
 * Deliberately permissive, the same judgement `requiredPhone` makes on the
 * public forms: CMG takes calls from anywhere, and a homeowner updating a number
 * after a hurricane should not be argued with about punctuation. Empty is
 * allowed here where it is not on intake — `profiles.phone` is nullable, and a
 * person who would rather be reached by email only is entitled to clear it.
 */
const portalPhone = z
  .string()
  .trim()
  .max(40, "Phone number must be 40 characters or fewer.")
  .refine((value) => value.length === 0 || value.replace(/\D/g, "").length >= 7, {
    message: "Enter a phone number we can reach you on, or leave it empty.",
  })
  .transform((value) => (value.length === 0 ? null : value));

export const profileSchema = z.object({
  firstName: requiredName("First name"),
  lastName: requiredName("Last name"),
  phone: portalPhone,
});

/**
 * The current password is required, and it is not ceremony.
 *
 * `auth.updateUser({ password })` needs only a session, so without this a
 * borrowed laptop with the portal still open is a permanent account takeover:
 * the visitor sets a new password, the homeowner is locked out of the file about
 * their own house, and the audit row names the homeowner. Asking for the current
 * password makes the session alone insufficient.
 *
 * `identifier` is the account's email, handed to `passwordSchema` so a password
 * built out of the address it signs in with is refused — the same rule the
 * invite-acceptance form applies to the first password this account ever had.
 */
export function passwordChangeSchema(identifier?: string | null) {
  return z
    .object({
      currentPassword: z.string().min(1, "Enter your current password."),
      newPassword: passwordSchema(identifier),
      confirmPassword: z.string(),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      path: ["confirmPassword"],
      message: "Both passwords must match.",
    })
    .refine((value) => value.newPassword !== value.currentPassword, {
      path: ["newPassword"],
      message: "Choose a password you are not already using here.",
    });
}
