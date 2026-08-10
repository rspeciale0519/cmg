import { z } from "zod";
import {
  optionalEmail,
  optionalText,
  requiredEmail,
  requiredName,
  requiredPhone,
  turnstileToken,
  US_STATES,
} from "./shared";

/**
 * Verbatim text of the consent checkbox rendered on /file-a-claim. Snapshotted
 * into `consents.consent_text` alongside the IP and timestamp — this string is
 * the evidence, so it must not drift from what the page shows.
 */
export const INTAKE_CONSENT_TEXT =
  "I consent to receive SMS and email communications from CMG Property Solutions " +
  "at the phone number and email address I provided. Message frequency varies; " +
  "message & data rates may apply. Reply STOP to unsubscribe, HELP for help. " +
  "I can unsubscribe from email at any time.";

/* Option values are the Postgres enum labels verbatim (see
   supabase/migrations/20260809120000_initial_schema.sql); option text is the
   prototype's copy verbatim. Keeping both in one table stops the two drifting. */

/* The `*_VALUES` tuples are the Postgres enum labels; `satisfies` below makes
   the compiler refuse an option whose value is not one of them, so the labels
   cannot drift onto a value the database would reject. */

export const CARRIER_TENURE_VALUES = [
  "lt_1_year",
  "one_to_two_years",
  "three_plus_years",
] as const;

export const PRIOR_OUTCOME_VALUES = [
  "paid_nothing",
  "paid_no_repairs",
  "paid_repaired",
  "unsure",
] as const;

export const CAUSE_VALUES = [
  "wind",
  "hail",
  "wind_hail",
  "hurricane",
  "water",
  "fire_smoke",
  "flood",
  "mold",
  "other",
] as const;

export const ADJUSTER_VALUES = ["austin-graham", "unsure"] as const;

type Options<T extends readonly string[]> = ReadonlyArray<{
  value: T[number];
  label: string;
}>;

export const CARRIER_TENURE_OPTIONS = [
  { value: "lt_1_year", label: "Less than 1 year" },
  { value: "one_to_two_years", label: "1–2 years" },
  { value: "three_plus_years", label: "3+ years" },
] as const satisfies Options<typeof CARRIER_TENURE_VALUES>;

export const PRIOR_OUTCOME_OPTIONS = [
  { value: "paid_nothing", label: "Insurance did NOT pay anything; I paid for repairs" },
  { value: "paid_no_repairs", label: "Insurance DID pay; I did NOT do the repairs" },
  { value: "paid_repaired", label: "Insurance DID pay; I DID the repairs" },
  { value: "unsure", label: "I'm not sure" },
] as const satisfies Options<typeof PRIOR_OUTCOME_VALUES>;

export const CAUSE_OPTIONS = [
  { value: "wind", label: "Wind" },
  { value: "hail", label: "Hail" },
  { value: "wind_hail", label: "Wind / hail" },
  { value: "hurricane", label: "Hurricane" },
  { value: "water", label: "Water" },
  { value: "fire_smoke", label: "Fire & smoke" },
  { value: "flood", label: "Flood" },
  { value: "mold", label: "Mold" },
  { value: "other", label: "Other" },
] as const satisfies Options<typeof CAUSE_VALUES>;

export const ADJUSTER_OPTIONS = [
  { value: "austin-graham", label: "Austin Graham" },
  { value: "unsure", label: "Not sure yet" },
] as const satisfies Options<typeof ADJUSTER_VALUES>;

const carrierTenure = z.enum(CARRIER_TENURE_VALUES);
const priorOutcome = z.enum(PRIOR_OUTCOME_VALUES);
const cause = z.enum(CAUSE_VALUES);
const requestedAdjuster = z.enum(ADJUSTER_VALUES);

const yesNo = z.enum(["no", "yes"]);

const initials = z
  .string()
  .trim()
  .min(1, "Initials are required.")
  .max(6, "Initials must be 6 characters or fewer.")
  .regex(/^[A-Za-z]+$/, "Initials may only contain letters.")
  .transform((value) => value.toUpperCase());

const EARLIEST_LOSS_DATE = "1990-01-01";

const lossDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date of loss.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "Enter a real date.",
  })
  .refine((value) => value >= EARLIEST_LOSS_DATE, {
    message: "Enter a date of loss from 1990 onwards.",
  })
  .refine((value) => value <= new Date().toISOString().slice(0, 10), {
    message: "The date of loss cannot be in the future.",
  });

const lossTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Enter an approximate time.");

const zip = z
  .string()
  .trim()
  .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code.");

const consent = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "true" || value === "yes")
  .refine((value) => value === true, {
    message: "You must consent to be contacted before we can accept the intake.",
  });

export const intakeSchema = z
  .object({
    firstName: requiredName("First name"),
    lastName: requiredName("Last name"),
    email: requiredEmail,
    phone: requiredPhone,
    initials,

    hasSecondPolicyholder: yesNo,
    secondFirstName: optionalText(80),
    secondLastName: optionalText(80),
    secondEmail: optionalEmail,
    secondInitials: optionalText(6),

    carrier: z.string().trim().min(1, "Insurance company is required.").max(120),
    policyNumber: z.string().trim().min(1, "Policy number is required.").max(80),
    carrierTenure,
    priorRoofClaim: yesNo,
    priorOutcome: priorOutcome.optional().or(z.literal("").transform(() => undefined)),
    claimNumber: optionalText(80),

    lossDate,
    lossTime,
    cause,
    description: z
      .string()
      .trim()
      .min(5, "Describe the loss so we know what we're looking at.")
      .max(5000),

    street: z.string().trim().min(1, "Street address is required.").max(160),
    street2: optionalText(160),
    city: z.string().trim().min(1, "City is required.").max(80),
    state: z.enum(US_STATES),
    zip,

    requestedAdjuster,
    referrerName: optionalText(160),
    referrerEmail: optionalEmail,

    consent,
    turnstileToken,
  })
  .superRefine((data, ctx) => {
    if (data.hasSecondPolicyholder === "yes") {
      const required = [
        ["secondFirstName", data.secondFirstName, "Second person's first name is required."],
        ["secondLastName", data.secondLastName, "Second person's last name is required."],
        ["secondEmail", data.secondEmail, "Second person's email is required."],
        ["secondInitials", data.secondInitials, "Second person's initials are required."],
      ] as const;

      for (const [path, value, message] of required) {
        if (!value) {
          ctx.addIssue({ code: "custom", path: [path], message });
        }
      }

      if (
        data.secondInitials &&
        !/^[A-Za-z]{1,6}$/.test(data.secondInitials)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["secondInitials"],
          message: "Initials may only contain letters.",
        });
      }

      if (
        data.secondEmail &&
        data.secondEmail.toLowerCase() === data.email.toLowerCase()
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["secondEmail"],
          message: "Use a different email address for the second person on the policy.",
        });
      }
    }

    if (data.priorRoofClaim === "yes" && !data.priorOutcome) {
      ctx.addIssue({
        code: "custom",
        path: ["priorOutcome"],
        message: "Tell us the outcome of the prior roof claim.",
      });
    }
  });

export type IntakeInput = z.infer<typeof intakeSchema>;
