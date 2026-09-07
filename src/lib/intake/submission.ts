import "server-only";

import { outboxRows, staffInbox, type OutboxEntry } from "@/lib/email/outbox";
import { ADJUSTER_OPTIONS, CAUSE_OPTIONS, INTAKE_CONSENT_TEXT, intakeSchema, labelFor, type IntakeInput } from "@/lib/validators/intake";
import type { UploadedObject } from "@/lib/actions/intake-storage";

export function parseIntakeInput(formData: FormData) {
  const text = (name: string) => formData.get(name) ?? "";
  return intakeSchema.safeParse({
    firstName: text("firstName"),
    lastName: text("lastName"),
    email: text("email"),
    phone: text("phone"),
    initials: text("initials"),
    /* No `|| "no"` fallback. Both yes/no questions are required and start
       unanswered, so an absent value means the homeowner did not answer — and
       a Letter of Representation is drafted from these answers. Defaulting
       would have the server assert "no second policyholder" and "no prior roof
       claim" on their behalf, and would make the required rule unreachable. */
    hasSecondPolicyholder: text("hasSecondPolicyholder"),
    secondFirstName: text("secondFirstName"),
    secondLastName: text("secondLastName"),
    secondEmail: text("secondEmail"),
    secondInitials: text("secondInitials"),
    carrier: text("carrier"),
    policyNumber: text("policyNumber"),
    carrierTenure: text("carrierTenure"),
    priorRoofClaim: text("priorRoofClaim"),
    priorOutcome: text("priorOutcome"),
    claimNumber: text("claimNumber"),
    lorContractType: text("lorContractType"),
    lossDate: text("lossDate"),
    lossTime: text("lossTime"),
    cause: text("cause"),
    description: text("description"),
    street: text("street"),
    street2: text("street2"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    requestedAdjuster: text("requestedAdjuster"),
    referrerName: text("referrerName"),
    referrerEmail: text("referrerEmail"),
    consent: formData.get("consent") ?? undefined,
    turnstileToken: text("cf-turnstile-response"),
  });

}

export function buildIntakeSubmission(input: IntakeInput, objects: UploadedObject[], ipInet: string | null) {
  const claimants: Array<{
    first_name: string; last_name: string; email: string;
    phone: string | null; initials: string; is_primary: boolean;
  }> = [
    {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      initials: input.initials,
      is_primary: true,
    },
  ];

  if (input.hasSecondPolicyholder === "yes") {
    claimants.push({
      first_name: input.secondFirstName!,
      last_name: input.secondLastName!,
      email: input.secondEmail!,
      phone: null,
      initials: input.secondInitials!.toUpperCase(),
      is_primary: false,
    });
  }

  /* One row per channel the checkbox covers, so SMS can be switched on later
     without re-consent (decision #10). Recorded for the submitter only — the
     second policyholder checked no box, and consent is not transferable. */
  const consentBase = {
    email: input.email,
    phone: input.phone,
    consent_text: INTAKE_CONSENT_TEXT,
    ip: ipInet,
  };

  const propertyAddress = [
    input.street,
    input.street2,
    `${input.city}, ${input.state} ${input.zip}`,
  ]
    .filter(Boolean)
    .join(", ");

  const entries: OutboxEntry[] = [
    {
      recipientEmail: staffInbox(),
      message: {
        template: "intake_staff_alert",
        payload: {
          claimRef: "pending",
          homeownerName: `${input.firstName} ${input.lastName}`,
          email: input.email,
          phone: input.phone,
          propertyAddress,
          carrier: input.carrier,
          policyNumber: input.policyNumber,
          claimNumber: input.claimNumber,
          lossDate: input.lossDate,
          lossTime: input.lossTime,
          cause: labelFor(CAUSE_OPTIONS, input.cause),
          description: input.description,
          secondPolicyholder:
            input.hasSecondPolicyholder === "yes"
              ? `${input.secondFirstName} ${input.secondLastName} (${input.secondEmail})`
              : undefined,
          requestedAdjuster: labelFor(ADJUSTER_OPTIONS, input.requestedAdjuster),
          referrer: input.referrerName,
          referrerEmail: input.referrerEmail,
          documentCount: objects.length,
        },
      },
    },
    {
      recipientEmail: input.email,
      message: {
        template: "intake_confirmation",
        payload: {
          firstName: input.firstName,
          claimRef: "pending",
          propertyAddress,
        },
      },
    },
  ];

  return {
    claim: {
      property_street: input.street,
      property_street2: input.street2 ?? null,
      property_city: input.city,
      property_state: input.state,
      property_zip: input.zip,
      carrier: input.carrier,
      policy_number: input.policyNumber,
      carrier_tenure: input.carrierTenure,
      prior_roof_claim: input.priorRoofClaim === "yes",
      prior_outcome: input.priorRoofClaim === "yes" ? input.priorOutcome! : null,
      claim_number: input.claimNumber ?? null,
      lor_contract_type: input.lorContractType,
      loss_date: input.lossDate,
      loss_time: input.lossTime,
      cause: input.cause,
      description: input.description,
      requested_adjuster: labelFor(ADJUSTER_OPTIONS, input.requestedAdjuster),
      referrer_name: input.referrerName ?? null,
      referrer_email: input.referrerEmail ?? null,
    },
    claimants,
    consents: [
      { ...consentBase, kind: "sms" },
      { ...consentBase, kind: "email" },
    ],
    outbox: outboxRows(entries),
  };
}
