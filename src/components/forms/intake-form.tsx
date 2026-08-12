"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { ProseLink } from "@/components/marketing/prose-link";
import { Button } from "@/components/ui/button";
import { submitIntake } from "@/lib/actions/intake";
import { idleState, resilient } from "@/lib/actions/types";
import { emailHref, site, telHref } from "@/lib/site";
import { FILE_ACCEPT_ATTRIBUTE } from "@/lib/validators/files";
/* Not `@/lib/validators/intake` — that module builds the zod schema, and a
   client component importing from it ships zod to the browser.
   `intake-options` holds the same tables with no zod in its import graph. */
import {
  ADJUSTER_OPTIONS,
  CARRIER_TENURE_OPTIONS,
  CAUSE_OPTIONS,
  INTAKE_CONSENT_TEXT,
  PRIOR_OUTCOME_OPTIONS,
  US_STATES,
  YES_NO_OPTIONS,
} from "@/lib/validators/intake-options";
import {
  CheckboxField,
  FileField,
  RadioField,
  SelectField,
  TextAreaField,
  TextField,
} from "./controls";
import {
  FormAlert,
  formAlertMessage,
  SuccessBody,
  SuccessPanel,
} from "./form-feedback";
import { TurnstileWidget } from "./turnstile";

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
      {/* The prototype's step label is a `<p>` that states no line-height, so
          it takes the body's 1.55 (18.6px at 12px). As an `<h2>` for the
          landmark it would inherit the 1.12 heading rule, and `leading-none`
          closed the box a further 6.6px — tightening every step against the
          fieldset under it. Stated, so the semantics don't cost the spacing. */}
      <h2 className="mb-[26px] text-xs font-normal uppercase leading-[1.55] tracking-[0.18em] text-accent">
        {step} — {title}
      </h2>
      {children}
    </section>
  );
}

export function IntakeForm() {
  const [state, formAction, pending] = useActionState(resilient(submitIntake), idleState);
  /* Both start unanswered. These two answers are drafted into the Letter of
     Representation, so a pre-selected "No" would have the form state, on the
     homeowner's behalf, that nobody else is on the policy and that the roof has
     never been claimed — neither of which they were asked to read. It also made
     `required` unreachable and kept the `priorOutcome` follow-up from ever
     surfacing. Same call already taken on `lossTime` and the `cause` /
     `carrierTenure` selects. */
  const [hasSecond, setHasSecond] = useState("");
  const [priorClaim, setPriorClaim] = useState("");

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
    /* The CSS guard only resets `html { scroll-behavior }`; an explicit
       `behavior: "smooth"` here outranks it, so the reduced-motion request
       has to be read and honoured in JS. */
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (firstInvalid ?? alertRef.current)?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
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
          <ProseLink href={telHref}>{site.phone}</ProseLink>.
        </SuccessBody>
        {state.reference ? (
          <p className="mt-7 border-t border-accent/25 pt-5 text-[13px] uppercase leading-[1.6] tracking-[0.18em] text-ink/55">
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
    /* Two anchors. An 880px form left-aligned in a 1248px field draws a 368px
       dead strip beside every one of its section rules; pairing it with the
       reassurance rail resolves both edges, and sticking the rail keeps that
       true for the whole 2400px scroll. Below 1100px the rail falls under the
       submit button, which is where this copy already lived. */
    <div className="grid gap-x-16 gap-y-[18px] min-[1100px]:grid-cols-[minmax(520px,880px)_minmax(240px,1fr)] min-[1100px]:items-start">
      <form ref={formRef} action={formAction} noValidate className="min-w-0">
        <FormAlert message={formAlertMessage(state)} ref={alertRef} />

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
            options={YES_NO_OPTIONS}
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
            options={YES_NO_OPTIONS}
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
            <TextField name="lossTime" label="Approximate time" required type="time" error={errors.lossTime} />
            <SelectField name="cause" label="Cause of loss" required options={CAUSE_OPTIONS} error={errors.cause} />
          </div>
          <TextAreaField
            className="mt-5"
            name="description"
            label={'Description of the loss (e.g. "roof damage with leaks inside the home")'}
            required
            size="sm"
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
          <p className="mt-[10px] text-[13px] leading-[1.7] text-ink/55">
            The referring rep receives a copy of the signed Letter of Representation once all
            parties have signed.
          </p>

          <FileField
            className="mt-5"
            name="documents"
            label="Declarations page & any contractor contract (optional)"
            multiple
            accept={FILE_ACCEPT_ATTRIBUTE}
            error={errors.documents}
          />
          <p className="mt-[10px] text-[13px] leading-[1.7] text-ink/55">
            You can also email copies to{" "}
            <ProseLink href={emailHref}>{site.email}</ProseLink>.
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
        </div>
      </form>

      {/* Same copy that used to sit under the submit button, where it was
          read last if at all. In the rail it is in view while the form is
          being filled, which is when "what happens next" is the question.

          The rail is a desktop composition only: it exists to give the 880px
          form a second anchor in a 1248px field. A single-column phone has no
          such strip to resolve, so below 1100px the border, the padding and
          the accent rule all drop and this is what the prototype has — a
          plain paragraph 18px under the submit button.

          The rail's box ends far above the form's, so at 1440 there is empty
          canvas beside the lower two thirds of the fieldsets. That is the
          architecture working, not a gap to fill: the rail's job is to resolve
          the strip's *top*, where the form's first sections are, and stickiness
          means it travels with the reader for the whole 2400px scroll rather
          than being a column of filler. Adding content to reach the footer
          would put copy nobody asked for beside the fields. Leave it. */}
      <aside className="min-w-0 min-[1100px]:sticky min-[1100px]:top-[108px]">
        <div className="min-[1100px]:border min-[1100px]:border-ink/13 min-[1100px]:p-6">
          <span
            aria-hidden="true"
            className="hidden h-px w-10 bg-accent min-[1100px]:block"
          />
          <p className="text-[14px] leading-[1.7] text-ink/62 min-[1100px]:mt-5">
            We&apos;ll prepare the Letter of Representation and send it for e-signature.
            Questions? Call <ProseLink href={telHref}>{site.phone}</ProseLink>.
          </p>
        </div>
      </aside>
    </div>
  );
}
