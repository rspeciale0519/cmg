import { z } from "zod";
import {
  optionalEmail,
  optionalText,
  requiredName,
  requiredPhone,
  turnstileToken,
} from "./shared";

/**
 * Snapshot written to `consents.consent_text`. Quotes the disclosure the form
 * actually renders above the submit button, so the stored record matches what
 * the submitter saw. Only written when an email address is supplied —
 * `consents.email` is NOT NULL, and this form collects no SMS consent.
 */
export const CONTACT_CONSENT_TEXT =
  'Submitted the "Request a free review" form on the CMG Property Solutions website, ' +
  "asking CMG to contact me about my property damage at the phone number and email " +
  'address I provided. Disclosure shown at submission: "No fee unless we recover. ' +
  'We reply within one business day."';

export const contactSchema = z.object({
  name: requiredName("Full name"),
  phone: requiredPhone,
  email: optionalEmail,
  message: optionalText(4000),
  turnstileToken,
});

export type ContactInput = z.infer<typeof contactSchema>;

export const contactFieldNames = [
  "name",
  "phone",
  "email",
  "message",
] as const;

export type ContactFieldName = (typeof contactFieldNames)[number];
