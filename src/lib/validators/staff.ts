import { z } from "zod";
import { optionalText, requiredEmail } from "./shared";

/**
 * `owner` is absent on purpose, and the database says the same thing:
 * `invites_role_allowed check (role in ('adjuster','assistant','customer','partner'))`.
 * An invitation is a bearer token in an inbox, and an owner invitation would be a
 * bearer token that mints the account able to change every other account's role.
 * A new owner is invited into one of these two roles and promoted afterwards,
 * under an authenticated owner session.
 */
export const staffInviteSchema = z.object({
  email: requiredEmail,
  firstName: optionalText(80),
  role: z.enum(["adjuster", "assistant"], {
    message: "Pick whether they join as an adjuster or an assistant.",
  }),
});
