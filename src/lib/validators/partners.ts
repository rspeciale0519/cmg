import { z } from "zod";
import { optionalEmail, optionalText, requiredEmail } from "./shared";

/**
 * A partner company is a contractor CMG takes referrals from. Only the name is
 * required — the rest is whatever the owner happens to know when they add it,
 * and demanding a contact email before a company can exist would push staff into
 * typing a placeholder that then looks like a real address forever.
 *
 * `partner_companies_name_not_blank` in the database says the same thing about
 * the name; this produces the sentence.
 */
export const partnerCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the company a name.")
    .max(120, "Company name must be 120 characters or fewer."),
  contactName: optionalText(120),
  contactEmail: optionalEmail,
  contactPhone: optionalText(40),
  notes: optionalText(2000),
});

export type PartnerCompanyInput = z.infer<typeof partnerCompanySchema>;

export const partnerRepInviteSchema = z.object({
  email: requiredEmail,
  firstName: optionalText(80),
});
