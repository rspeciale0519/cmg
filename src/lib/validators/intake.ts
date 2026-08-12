import { z } from "zod";
import {
  ADJUSTER_VALUES,
  CARRIER_TENURE_VALUES,
  CAUSE_VALUES,
  PRIOR_OUTCOME_VALUES,
  US_STATES,
  YES_NO_VALUES,
} from "./intake-options";
import {
  lossDate,
  optionalEmail,
  optionalText,
  requiredEmail,
  requiredName,
  requiredPhone,
  turnstileToken,
  zip,
} from "./shared";

/* The option tables, the consent snapshot and the literal unions live in
   `./intake-options` — a zod-free module — because the intake form is a client
   component and importing them from here shipped zod to the browser. Re-exported
   for server callers (`@/lib/actions/intake`) so there is one import site for
   the intake vocabulary on the server; client components must import from
   `./intake-options` directly or the split is undone. */
export {
  ADJUSTER_OPTIONS,
  ADJUSTER_VALUES,
  CARRIER_TENURE_OPTIONS,
  CARRIER_TENURE_VALUES,
  CAUSE_OPTIONS,
  CAUSE_VALUES,
  INTAKE_CONSENT_TEXT,
  labelFor,
  PRIOR_OUTCOME_OPTIONS,
  PRIOR_OUTCOME_VALUES,
  US_STATES,
  YES_NO_OPTIONS,
  YES_NO_VALUES,
} from "./intake-options";

/* These selects start genuinely empty, so `""` is a reachable submitted value
   and its message is what the user actually sees — not a fallback. */
const carrierTenure = z.enum(CARRIER_TENURE_VALUES, {
  error: "Tell us how long you have been with this carrier.",
});
const priorOutcome = z.enum(PRIOR_OUTCOME_VALUES, {
  error: "Tell us the outcome of the prior roof claim.",
});
const cause = z.enum(CAUSE_VALUES, { error: "Choose the cause of loss." });
const requestedAdjuster = z.enum(ADJUSTER_VALUES, {
  error: "Choose which adjuster you are working with.",
});

const hasSecondPolicyholder = z.enum(YES_NO_VALUES, {
  error: "Tell us whether a second person is on the policy.",
});
const priorRoofClaim = z.enum(YES_NO_VALUES, {
  error: "Tell us whether a roof claim has been filed at this property.",
});

const initials = z
  .string()
  .trim()
  .min(1, "Initials are required.")
  .max(6, "Initials must be 6 characters or fewer.")
  .regex(/^[A-Za-z]+$/, "Initials may only contain letters.")
  .transform((value) => value.toUpperCase());

const lossTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Enter an approximate time.");

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
    phone: requiredPhone(),
    initials,

    hasSecondPolicyholder,
    secondFirstName: optionalText(80),
    secondLastName: optionalText(80),
    secondEmail: optionalEmail,
    secondInitials: optionalText(6),

    carrier: z.string().trim().min(1, "Insurance company is required.").max(120),
    policyNumber: z.string().trim().min(1, "Policy number is required.").max(80),
    carrierTenure,
    priorRoofClaim,
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
