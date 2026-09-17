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
  /**
   * The fee CMG charges on claims this vendor refers. Blank is the normal
   * answer and means "the standard rate", so it parses to null rather than to
   * zero — a stored 0 would say CMG works this company's claims for nothing.
   *
   * The range is `partner_companies_default_fee_percent_range` in the database
   * and `claim_financials_fee_percent_range` after acceptance copies it; this
   * produces the sentence. Two decimals because the column is numeric(5,2).
   */
  defaultFeePercent: z
    .string()
    .trim()
    .max(6, "Give the fee as a percentage, for example 15.")
    .transform((value) => (value === "" ? null : value))
    .refine(
      (value) => value === null || /^\d{1,3}(\.\d{1,2})?$/.test(value),
      "Give the fee as a percentage, for example 15 or 17.5.",
    )
    .transform((value) => (value === null ? null : Number(value)))
    .refine(
      (value) => value === null || (value >= 0 && value <= 100),
      "A fee must be between 0 and 100 percent.",
    ),
  notes: optionalText(2000),
});

export type PartnerCompanyInput = z.infer<typeof partnerCompanySchema>;

export const partnerRepInviteSchema = z.object({
  email: requiredEmail,
  firstName: optionalText(80),
});
