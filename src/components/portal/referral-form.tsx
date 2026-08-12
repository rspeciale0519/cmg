"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState, useEffect, useRef } from "react";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/forms/controls";
import { SuccessBody, SuccessPanel } from "@/components/forms/form-feedback";
import { TurnstileWidget } from "@/components/forms/turnstile";
import { referClaim } from "@/lib/actions/referral";
import { idleState, resilient } from "@/lib/actions/types";
/* Not `@/lib/validators/referral` — that module builds the zod schema, and a
   client component importing from it ships zod to the browser. `intake-options`
   holds the same tables with no zod in its import graph. */
import { CAUSE_OPTIONS, US_STATES } from "@/lib/validators/intake-options";
import { businessToday, EARLIEST_LOSS_DATE } from "@/lib/validators/loss-date-bounds";
import { FormFeedback, SubmitButton } from "./form-controls";

const STATE_OPTIONS = US_STATES.map((name) => ({ value: name, label: name }));

const GRID = "grid gap-5";

function Group({
  step,
  title,
  first,
  children,
}: {
  step: string;
  title: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={
        first
          ? "pb-[clamp(24px,3vw,34px)]"
          : "border-t border-ink/13 py-[clamp(24px,3vw,34px)]"
      }
    >
      <h2 className="mb-[22px] text-xs font-normal uppercase leading-[1.55] tracking-[0.18em] text-accent">
        {step} — {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The rep's referral, and the only write on the partner surface.
 *
 * Twelve fields and no policy section, which is the shape spec §6 asks for: the
 * rep sends the homeowner and the loss, and CMG completes the carrier side when
 * the intake is accepted. The controls are the marketing form's own — a rep
 * filling this in and a homeowner filling in /file-a-claim are the same person
 * at the same density — with the portal's submit button and feedback line under
 * them, as the other four portal forms have.
 *
 * `noValidate` for the reason every form in this codebase carries it: Chrome's
 * native bubble stops at the first invalid field and never reaches the inline
 * error system, so a form that kept it would refuse in a different visual
 * language from the rest of the product.
 *
 * Every field re-seeds from `state.values`, which is what makes a refusal keep
 * the typing: React 19 resets a form when its action *resolves*, not when it
 * succeeds. On success `values` is absent — but so is this form, because the
 * panel replaces it.
 */
export function ReferralForm() {
  const [state, formAction] = useActionState(resilient(referClaim), idleState);

  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      successRef.current?.focus();
      return;
    }

    if (state.status !== "error") return;

    const firstInvalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    if (!firstInvalid) return;

    firstInvalid.focus();
    /* The CSS guard only resets `html { scroll-behavior }`; an explicit
       `behavior: "smooth"` here outranks it, so the reduced-motion request has
       to be read and honoured in JS. */
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    firstInvalid.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
  }, [state]);

  if (state.status === "success") {
    return (
      <SuccessPanel
        heading="Referral sent."
        headingSize="lg"
        className="max-w-[640px]"
        ref={successRef}
      >
        <SuccessBody>
          It is on the CMG desk now, and it is already on your referred claims,
          reading new intake. We review it, call the homeowner, and take the
          policy details from them — you were not asked for those and do not need
          to chase them. The status moves as the claim does.
        </SuccessBody>
        {/* `ink/58`, not the `ink/55` the rest of the surface uses: this panel
            carries `bg-accent/7`, so the background composites lighter and the
            same class measured 4.46:1 here against 4.85:1 on the canvas. The
            tint is what fails it. */}
        {state.reference ? (
          <p className="mt-7 border-t border-accent/25 pt-5 text-[13px] uppercase leading-[1.6] tracking-[0.18em] text-ink/58">
            Reference
            <span className="mt-1 block text-[19px] tracking-[0.04em] text-accent">
              {state.reference}
            </span>
          </p>
        ) : null}
        <p className="mt-7">
          <Link
            href="/partner"
            className="inline-flex min-h-11 items-center text-[15px] leading-[1.75] text-accent no-underline transition-colors duration-200 hover:text-accent-300"
          >
            Back to your referred claims
          </Link>
        </p>
      </SuccessPanel>
    );
  }

  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="max-w-[820px] min-w-0"
    >
      <Group step="01" title="Homeowner" first>
        <div className={`${GRID} grid-cols-[repeat(auto-fit,minmax(180px,1fr))]`}>
          <TextField
            name="firstName"
            label="First name"
            required
            maxLength={80}
            defaultValue={values.firstName ?? ""}
            error={errors.firstName}
          />
          <TextField
            name="lastName"
            label="Last name"
            required
            maxLength={80}
            defaultValue={values.lastName ?? ""}
            error={errors.lastName}
          />
        </div>
        <div className={`${GRID} mt-5 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]`}>
          <TextField
            name="email"
            label="Email"
            required
            type="email"
            defaultValue={values.email ?? ""}
            error={errors.email}
          />
          <TextField
            name="phone"
            label="Phone"
            required
            type="tel"
            maxLength={40}
            defaultValue={values.phone ?? ""}
            error={errors.phone}
            hint="We call the homeowner ourselves — this is the number we use."
          />
        </div>
      </Group>

      <Group step="02" title="Property address">
        <TextField
          name="street"
          label="Street address"
          required
          maxLength={160}
          defaultValue={values.street ?? ""}
          error={errors.street}
        />
        <TextField
          className="mt-5"
          name="street2"
          label="Address line 2"
          maxLength={160}
          defaultValue={values.street2 ?? ""}
          error={errors.street2}
        />
        <div className={`${GRID} mt-5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]`}>
          <TextField
            name="city"
            label="City"
            required
            maxLength={80}
            defaultValue={values.city ?? ""}
            error={errors.city}
          />
          <SelectField
            name="state"
            label="State"
            required
            defaultValue={values.state ?? "Florida"}
            options={STATE_OPTIONS}
            error={errors.state}
          />
          <TextField
            name="zip"
            label="ZIP code"
            required
            inputMode="numeric"
            defaultValue={values.zip ?? ""}
            error={errors.zip}
          />
        </div>
      </Group>

      <Group step="03" title="The loss">
        <div className={`${GRID} grid-cols-[repeat(auto-fit,minmax(200px,1fr))]`}>
          {/* The same bounds the schema enforces, given to the picker as well.
              The server refuses a future date, but without `max` the rep only
              learns that by having a filled-in form refused — and the control
              they are typing into is the one that could have said so. Not a
              replacement for the server check: `noValidate` is on this form, so
              these attributes inform the picker's UI and its `rangeOverflow`
              flag rather than blocking the submit. */}
          <TextField
            name="lossDate"
            label="Date of loss"
            required
            type="date"
            min={EARLIEST_LOSS_DATE}
            max={businessToday()}
            defaultValue={values.lossDate ?? ""}
            error={errors.lossDate}
          />
          {/* No `defaultValue` when nothing was submitted, so the select starts
              on its own empty placeholder rather than on Wind — the same call
              the intake takes, because a cause nobody chose is a fact about the
              loss that nobody supplied. */}
          <SelectField
            name="cause"
            label="Cause of loss"
            required
            options={CAUSE_OPTIONS}
            error={errors.cause}
            {...(values.cause ? { defaultValue: values.cause } : {})}
          />
        </div>
        <TextAreaField
          className="mt-5"
          name="description"
          label="What happened at the property"
          required
          size="sm"
          rows={4}
          maxLength={5000}
          defaultValue={values.description ?? ""}
          error={errors.description}
          hint="A couple of sentences is enough — what you saw on site and roughly when."
        />
      </Group>

      <div className="border-t border-ink/13 pt-[clamp(24px,3vw,34px)]">
        <TurnstileWidget resetOn={state} />
        <div className="mt-6">
          <SubmitButton pendingLabel="Sending referral…">Send referral</SubmitButton>
        </div>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}
