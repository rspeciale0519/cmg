/**
 * Intake vocabulary — option tables, literal unions and the consent snapshot.
 *
 * **This module must never import zod.** `intake-form.tsx` is a client
 * component and it needs these tables to render; when they lived beside the
 * schema, the form's import dragged zod into the browser bundle. That chunk is
 * also prefetched from every `/file-a-claim` link on the home page, so a
 * visitor who never opens the form still paid for it: 69,866 B transferred,
 * 99.96 % of it unused, and a 221 ms parse task on the home page's main thread.
 *
 * The schema (`./intake.ts`) imports from here and keeps zod server-side.
 * Anything a client component needs belongs in this file; anything that needs
 * zod belongs in `./intake.ts`. Client components must import from *this*
 * module, never from `./intake.ts`.
 */

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

export const LOR_CONTRACT_TYPE_VALUES = [
  "emergency",
  "non_emergency",
  "supplemental",
] as const;

/* Both yes/no questions on the intake start unanswered, so `""` is a
   reachable submitted value exactly as it is for the selects — which means
   each needs its own sentence in the schema rather than a shared fallback.
   A Letter of Representation is drafted from these two answers: a pre-checked
   "No" would have the form assert, on the homeowner's behalf, that there is no
   second policyholder and no prior roof claim. */
export const YES_NO_VALUES = ["no", "yes"] as const;

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

export const LOR_CONTRACT_TYPE_OPTIONS = [
  { value: "emergency", label: "Emergency" },
  { value: "non_emergency", label: "Non-emergency" },
  { value: "supplemental", label: "Supplemental" },
] as const satisfies Options<typeof LOR_CONTRACT_TYPE_VALUES>;

export const YES_NO_OPTIONS = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
] as const satisfies Options<typeof YES_NO_VALUES>;

/**
 * The state `<select>`'s option list, and the enum the schema accepts. Lives
 * here rather than beside the shared zod primitives for the same reason as the
 * tables above: the intake form renders it.
 */
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

/**
 * The human label for a stored option value, falling back to the value itself.
 *
 * Lives beside the tables rather than in the action that first needed it: the
 * public intake and the partner referral both turn a `cause` into prose for the
 * same staff inbox, and a second copy of this is a second place for "Wind /
 * hail" to become "wind".
 */
export const labelFor = (
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) => options.find((option) => option.value === value)?.label ?? value;
