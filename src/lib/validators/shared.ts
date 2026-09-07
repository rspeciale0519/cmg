import { z } from "zod";
import { businessToday, EARLIEST_LOSS_DATE } from "./loss-date-bounds";

/* Re-exported so server callers keep one import site for the validator
   vocabulary; client components must import from `./loss-date-bounds` directly
   or the zod split is undone. Same arrangement as `./intake-options`. */
export { businessToday, EARLIEST_LOSS_DATE };

/** FormData yields `""` for untouched optional inputs; treat that as absent. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional();

export const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional()
  .refine(
    (value) => value === undefined || z.email().max(254).safeParse(value).success,
    { message: "Enter a valid email address." },
  );

export const requiredName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(80, `${label} must be 80 characters or fewer.`);

export const requiredEmail = z
  .email("Enter a valid email address.")
  .trim()
  .max(254);

/**
 * Deliberately permissive: CMG takes calls from anywhere and a homeowner filing
 * after a hurricane should not be argued with about punctuation. Requires seven
 * digits, which is the shortest string that can be a real phone number.
 *
 * Takes its sentence, the way `requiredName` takes a label, because this field
 * is not always about the person filling the form in. On `/partner/refer` a
 * contractor types the *homeowner's* number under a hint that says so — "We call
 * the homeowner ourselves — this is the number we use" — and the error under it
 * read "Enter a phone number we can reach you on." Two sentences on one field,
 * disagreeing about whose number it is.
 */
export const requiredPhone = (
  message = "Enter a phone number we can reach you on.",
) =>
  z
    .string()
    .trim()
    .min(7, message)
    .max(40, "Phone number must be 40 characters or fewer.")
    .refine((value) => value.replace(/\D/g, "").length >= 7, { message });

export const turnstileToken = z
  .string()
  .min(1, "Complete the verification challenge before submitting.")
  .max(4096);

/**
 * Here rather than in `./intake`, because two forms now take a date of loss —
 * the homeowner's and the referring rep's — and a second copy of this bound is
 * a second place for the zone to be got wrong.
 */
export const lossDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date of loss.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "Enter a real date.",
  })
  .refine((value) => value >= EARLIEST_LOSS_DATE, {
    message: "Enter a date of loss from 1990 onwards.",
  })
  .refine((value) => value <= businessToday(), {
    message: "The date of loss cannot be in the future.",
  });

export const zip = z
  .string()
  .trim()
  .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code.");

/* `US_STATES` moved to `./intake-options`. It is an option list the intake
   form renders, and every module in this file pulls in zod — importing the
   states from here is what put zod in the browser bundle. */
