"use server";

import { headers } from "next/headers";
import { dispatchOutbox, outboxRows, staffInbox } from "@/lib/email/outbox";
import type { OutboxEntry } from "@/lib/email/outbox";
import {
  checkFormRateLimits,
  clientIpFromHeaders,
  inetOrNull,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { validateUploads } from "@/lib/validators/files";
import {
  ADJUSTER_OPTIONS,
  CAUSE_OPTIONS,
  INTAKE_CONSENT_TEXT,
  intakeSchema,
} from "@/lib/validators/intake";
import {
  removeObjects,
  uploadIntakeFiles,
  type UploadedObject,
} from "./intake-storage";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  invalid,
  RATE_LIMIT_ERROR,
  VERIFICATION_ERROR,
  type FormState,
} from "./types";

const labelFor = (
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) => options.find((option) => option.value === value)?.label ?? value;

export async function submitIntake(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);
  const ipInet = inetOrNull(ip);

  const turnstile = await verifyTurnstile(
    formData.get("cf-turnstile-response"),
    ipInet,
  );
  if (!turnstile.ok) {
    console.warn("[intake] turnstile rejected", { reason: turnstile.reason });
    return { status: "error", message: VERIFICATION_ERROR };
  }

  const rawEmail = String(formData.get("email") ?? "").trim();
  const withinLimits = await checkFormRateLimits({
    ipRule: RATE_LIMITS.intakeIp,
    emailRule: RATE_LIMITS.intakeEmail,
    ip,
    email: rawEmail.length > 0 ? rawEmail : null,
  });
  if (!withinLimits) {
    console.warn("[intake] rate limited");
    return { status: "error", message: RATE_LIMIT_ERROR };
  }

  const text = (name: string) => formData.get(name) ?? "";
  const parsed = intakeSchema.safeParse({
    firstName: text("firstName"),
    lastName: text("lastName"),
    email: text("email"),
    phone: text("phone"),
    initials: text("initials"),
    hasSecondPolicyholder: text("hasSecondPolicyholder") || "no",
    secondFirstName: text("secondFirstName"),
    secondLastName: text("secondLastName"),
    secondEmail: text("secondEmail"),
    secondInitials: text("secondInitials"),
    carrier: text("carrier"),
    policyNumber: text("policyNumber"),
    carrierTenure: text("carrierTenure"),
    priorRoofClaim: text("priorRoofClaim") || "no",
    priorOutcome: text("priorOutcome"),
    claimNumber: text("claimNumber"),
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

  if (!parsed.success) {
    return invalid(fieldErrorsFrom(parsed.error));
  }

  /* Server-side regardless of what the client checked. Mirrors the
     documents_mime_allowlist / documents_size_bytes_range CHECKs. */
  const uploads = validateUploads(formData.getAll("documents"));
  if (!uploads.ok) {
    return invalid({ documents: uploads.message });
  }

  const input = parsed.data;
  const admin = createAdminClient();
  const intakeId = crypto.randomUUID();

  /* Files first, while nothing in the database exists yet: a failed upload can
     therefore leave no half-created claim, only bytes, which are swept here. */
  const uploaded = await uploadIntakeFiles(admin, intakeId, uploads.files);
  if (!uploaded.ok) {
    await removeObjects(admin, uploaded.uploaded);
    return { status: "error", message: GENERIC_ERROR };
  }

  const objects: UploadedObject[] = uploaded.objects;
  const storagePaths = objects.map((object) => object.path);

  const { data: claim, error: claimError } = await admin
    .from("claims")
    .insert({
      /* Left blank on purpose: public.claims_before_insert() replaces an empty
         claim_ref with public.next_claim_ref(), and BEFORE ROW triggers run
         ahead of the claims_claim_ref_shape CHECK. */
      claim_ref: "",
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
      loss_date: input.lossDate,
      loss_time: input.lossTime,
      cause: input.cause,
      description: input.description,
      requested_adjuster: labelFor(ADJUSTER_OPTIONS, input.requestedAdjuster),
      referrer_name: input.referrerName ?? null,
      referrer_email: input.referrerEmail ?? null,
    })
    .select("id, claim_ref")
    .single();

  if (claimError || !claim) {
    console.error("[intake] claim insert failed", claimError?.message);
    await removeObjects(admin, storagePaths);
    return { status: "error", message: GENERIC_ERROR };
  }

  /**
   * Compensating rollback. Supabase has no client-side transaction and this
   * task may not add an RPC, so the unit is made atomic-in-effect instead:
   * consents are removed first (their FK is `on delete set null`, so a bare
   * claim delete would strand them), then the claim, whose cascade takes the
   * claimants and documents with it. Deleting these is not erasing evidence —
   * the submission is being abandoned, so no claim and no consent ever
   * validly existed.
   */
  const rollback = async (stage: string, detail?: string): Promise<FormState> => {
    console.error(`[intake] ${stage} failed; rolling back claim ${claim.claim_ref}`, detail);
    await admin.from("consents").delete().eq("claim_id", claim.id);
    await admin.from("claims").delete().eq("id", claim.id);
    await removeObjects(admin, storagePaths);
    return { status: "error", message: GENERIC_ERROR };
  };

  const claimants = [
    {
      claim_id: claim.id,
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
      claim_id: claim.id,
      first_name: input.secondFirstName!,
      last_name: input.secondLastName!,
      email: input.secondEmail!,
      phone: null as unknown as string,
      initials: input.secondInitials!.toUpperCase(),
      is_primary: false,
    });
  }

  const { error: claimantError } = await admin.from("claimants").insert(claimants);
  if (claimantError) {
    return rollback("claimant insert", claimantError.message);
  }

  /* One row per channel the checkbox covers, so SMS can be switched on later
     without re-consent (decision #10). Recorded for the submitter only — the
     second policyholder checked no box, and consent is not transferable. */
  const consentBase = {
    claim_id: claim.id,
    email: input.email,
    phone: input.phone,
    consent_text: INTAKE_CONSENT_TEXT,
    ip: ipInet,
  };

  const { error: consentError } = await admin
    .from("consents")
    .insert([
      { ...consentBase, kind: "sms" as const },
      { ...consentBase, kind: "email" as const },
    ]);
  if (consentError) {
    return rollback("consent insert", consentError.message);
  }

  if (objects.length > 0) {
    const { error: documentError } = await admin.from("documents").insert(
      objects.map((object) => ({
        claim_id: claim.id,
        storage_path: object.path,
        original_name: object.originalName,
        kind: "other" as const,
        mime: object.mime,
        size_bytes: object.size,
        visibility: "customer" as const,
      })),
    );

    if (documentError) {
      return rollback("document insert", documentError.message);
    }
  }

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
          claimRef: claim.claim_ref,
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
          claimRef: claim.claim_ref,
          propertyAddress,
        },
      },
    },
  ];

  const { data: queued, error: outboxError } = await admin
    .from("notifications_outbox")
    .insert(outboxRows(entries))
    .select("id");

  if (outboxError || !queued) {
    return rollback("outbox enqueue", outboxError?.message);
  }

  await dispatchOutbox(
    admin,
    queued.map((row) => row.id),
  );

  return {
    status: "success",
    message: "Intake received.",
    reference: claim.claim_ref,
  };
}
