"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { submitIntake } from "@/lib/actions/intake";
import { idleState } from "@/lib/actions/types";
import { emailHref, site, telHref } from "@/lib/site";
import { FILE_ACCEPT_ATTRIBUTE, FILE_RULES_HINT } from "@/lib/validators/files";
import {
  ADJUSTER_OPTIONS,
  CARRIER_TENURE_OPTIONS,
  CAUSE_OPTIONS,
  INTAKE_CONSENT_TEXT,
  PRIOR_OUTCOME_OPTIONS,
} from "@/lib/validators/intake";
import { US_STATES } from "@/lib/validators/shared";
import {
  CheckboxField,
  FileField,
  RadioField,
  SelectField,
  TextAreaField,
  TextField,
} from "./controls";
import { FormAlert, SuccessBody, SuccessPanel } from "./form-feedback";
import { TurnstileWidget } from "./turnstile";

const YES_NO = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
] as const;

const STATE_OPTIONS = US_STATES.map((name) => ({ value: name, label: name }));

const GRID = "grid gap-5";

function IntakeSection({
  step,
  title,
  last,
  children,
}: {
  step: string;
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`border-t border-ink/13 py-[clamp(28px,3.5vw,44px)] ${last ? "border-b" : ""}`}
    >
      <h2 className="mb-[26px] text-xs font-normal uppercase leading-none tracking-[0.18em] text-accent">
        {step} — {title}
      </h2>
      {children}
    </section>
  );
}

export function IntakeForm() {
  const [state, formAction, pending] = useActionState(submitIntake, idleState);
  const [hasSecond, setHasSecond] = useState("no");
  const [priorClaim, setPriorClaim] = useState("no");

  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      successRef.current?.focus();
      return;
    }

    if (state.status !== "error") return;

    const firstInvalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    (firstInvalid ?? alertRef.current)?.focus();
    (firstInvalid ?? alertRef.current)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [state]);

  if (state.status === "success") {
    return (
      <SuccessPanel
        heading="Intake received."
        headingSize="lg"
        className="max-w-[640px]"
        ref={successRef}
      >
        <SuccessBody>
          We&apos;ll prepare the Letter of Representation and email it for signature to
          every party on the policy. Once all parties have signed, the claim moves to your
          adjuster — and the referring rep, if any, gets a copy. Questions in the meantime:{" "}
          <Link href={telHref} className="text-accent hover:text-accent-300">
            {site.phone}
          </Link>
          .
        </SuccessBody>
        {state.reference ? (
          <p className="mt-7 border-t border-accent/25 pt-5 text-[13px] uppercase leading-[1.6] tracking-[0.18em] text-ink/50">
            Your reference
            <span className="mt-1 block text-[19px] tracking-[0.04em] text-accent">
              {state.reference}
            </span>
          </p>
        ) : null}
      </SuccessPanel>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} noValidate>
      <FormAlert message={state.fieldErrors ? undefined : state.message} ref={alertRef} />

      <IntakeSection step="01" title="Homeowner">
        <div className={`${GRID} grid-cols-[repeat(auto-fit,minmax(180px,1fr))]`}>
          <TextField name="firstName" label="First name" required autoComplete="given-name" error={errors.firstName} />
          <TextField name="lastName" label="Last name" required autoComplete="family-name" error={errors.lastName} />
        </div>
        <div className={`${GRID} mt-5 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]`}>
          <TextField name="email" label="Email" required type="email" autoComplete="email" error={errors.email} />
          <TextField name="phone" label="Phone" required type="tel" autoComplete="tel" error={errors.phone} />
          <TextField name="initials" label="Initials (e.g. SAB)" required maxLength={6} error={errors.initials} />
        </div>

        <RadioField
          className="mt-6"
          name="hasSecondPolicyholder"
          label="Is there a second person on the insurance policy?"
          required
          options={YES_NO}
          value={hasSecond}
          onValueChange={setHasSecond}
          error={errors.hasSecondPolicyholder}
        />

        {hasSecond === "yes" ? (
          <div className="mt-5 border border-accent/32 bg-accent/5 p-6">
            <div className={`${GRID} grid-cols-[repeat(auto-fit,minmax(180px,1fr))]`}>
              <TextField name="secondFirstName" label="Second person's first name" required error={errors.secondFirstName} />
              <TextField name="secondLastName" label="Second person's last name" required error={errors.secondLastName} />
            </div>
            <div className={`${GRID} mt-5 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]`}>
              <TextField name="secondEmail" label="Second person's email" required type="email" error={errors.secondEmail} />
              <TextField name="secondInitials" label="Second person's initials" required maxLength={6} error={errors.secondInitials} />
            </div>
          </div>
        ) : null}
      </IntakeSection>

      <IntakeSection step="02" title="Policy">
        <div className={`${GRID} grid-cols-[repeat(auto-fit,minmax(200px,1fr))]`}>
          <TextField name="carrier" label="Insurance company" required error={errors.carrier} />
          <TextField name="policyNumber" label="Policy number" required error={errors.policyNumber} />
          <SelectField
            name="carrierTenure"
            label="How long with this carrier?"
            required
            options={CARRIER_TENURE_OPTIONS}
            error={errors.carrierTenure}
          />
        </div>

        <RadioField
          className="mt-6"
          name="priorRoofClaim"
          label="Have you ever filed a claim for the roof at this property?"
          required
          options={YES_NO}
          value={priorClaim}
          onValueChange={setPriorClaim}
          error={errors.priorRoofClaim}
        />

        {priorClaim === "yes" ? (
          <SelectField
            className="mt-5"
            name="priorOutcome"
            label="What was the outcome of that prior roof claim?"
            required
            options={PRIOR_OUTCOME_OPTIONS}
            error={errors.priorOutcome}
          />
        ) : null}

        <TextField
          className="mt-5"
          name="claimNumber"
          label="Claim number (leave blank if not yet filed)"
          error={errors.claimNumber}
        />
      </IntakeSection>

      <IntakeSection step="03" title="The loss">
        <div className={`${GRID} grid-cols-[repeat(auto-fit,minmax(180px,1fr))]`}>
          <TextField name="lossDate" label="Date of loss" required type="date" error={errors.lossDate} />
          <TextField name="lossTime" label="Approximate time" required type="time" defaultValue="12:00" error={errors.lossTime} />
          <SelectField name="cause" label="Cause of loss" required options={CAUSE_OPTIONS} error={errors.cause} />
        </div>
        <TextAreaField
          className="mt-5"
          name="description"
          label={'Description of the loss (e.g. "roof damage with leaks inside the home")'}
          required
          rows={4}
          error={errors.description}
        />
      </IntakeSection>

      <IntakeSection step="04" title="Property address">
        <TextField name="street" label="Street address" required autoComplete="address-line1" error={errors.street} />
        <TextField className="mt-5" name="street2" label="Address line 2" autoComplete="address-line2" error={errors.street2} />
        <div className={`${GRID} mt-5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]`}>
          <TextField name="city" label="City" required autoComplete="address-level2" error={errors.city} />
          <SelectField name="state" label="State" required defaultValue="Florida" options={STATE_OPTIONS} error={errors.state} />
          <TextField name="zip" label="ZIP code" required inputMode="numeric" autoComplete="postal-code" error={errors.zip} />
        </div>
      </IntakeSection>

      <IntakeSection step="05" title="Referral & documents">
        <SelectField
          name="requestedAdjuster"
          label="Which CMG adjuster are you working with?"
          required
          options={ADJUSTER_OPTIONS}
          error={errors.requestedAdjuster}
        />
        <div className={`${GRID} mt-5 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]`}>
          <TextField
            name="referrerName"
            label="Referring company & sales rep (if any)"
            placeholder="Company — rep name"
            error={errors.referrerName}
          />
          <TextField name="referrerEmail" label="Referring rep's email" type="email" error={errors.referrerEmail} />
        </div>
        <p className="mt-[10px] text-[13px] leading-[1.7] text-ink/50">
          The referring rep receives a copy of the signed Letter of Representation once all
          parties have signed.
        </p>

        <FileField
          className="mt-5"
          name="documents"
          label="Declarations page & any contractor contract (optional)"
          multiple
          accept={FILE_ACCEPT_ATTRIBUTE}
          hint={FILE_RULES_HINT}
          error={errors.documents}
        />
        <p className="mt-[10px] text-[13px] leading-[1.7] text-ink/50">
          You can also email copies to{" "}
          <Link href={emailHref} className="text-accent hover:text-accent-300">
            {site.email}
          </Link>
          .
        </p>
      </IntakeSection>

      <IntakeSection step="06" title="Consent" last>
        <CheckboxField name="consent" required error={errors.consent}>
          {INTAKE_CONSENT_TEXT}
        </CheckboxField>
      </IntakeSection>

      <div className="pt-8">
        <TurnstileWidget resetOn={state} />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={pending}
          aria-busy={pending}
          className="mt-6"
        >
          {pending ? "Submitting intake…" : "Submit intake"}
        </Button>
        <p className="mt-[18px] text-[14px] leading-[1.7] text-ink/55">
          We&apos;ll prepare the Letter of Representation and send it for e-signature.
          Questions? Call{" "}
          <Link href={telHref} className="text-accent hover:text-accent-300">
            {site.phone}
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
