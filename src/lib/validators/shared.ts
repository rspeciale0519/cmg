import { z } from "zod";

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
 */
export const requiredPhone = z
  .string()
  .trim()
  .min(7, "Enter a phone number we can reach you on.")
  .max(40, "Phone number must be 40 characters or fewer.")
  .refine((value) => (value.replace(/\D/g, "").length >= 7), {
    message: "Enter a phone number we can reach you on.",
  });

export const turnstileToken = z
  .string()
  .min(1, "Complete the verification challenge before submitting.")
  .max(4096);

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
] as const;
