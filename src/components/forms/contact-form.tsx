"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { submitContact } from "@/lib/actions/contact";
import { idleState } from "@/lib/actions/types";
import { site, telHref } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "./controls";
import { FormAlert, SuccessBody, SuccessPanel } from "./form-feedback";
import { TurnstileWidget } from "./turnstile";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, idleState);

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
  }, [state]);

  if (state.status === "success") {
    return (
      <SuccessPanel heading="Request received." ref={successRef}>
        <SuccessBody>
          An adjuster will call you within one business day. If the damage is urgent —
          water still coming in, structure unsafe — call{" "}
          <Link href={telHref} className="text-accent hover:text-accent-300">
            {site.phone}
          </Link>{" "}
          now.
        </SuccessBody>
      </SuccessPanel>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="border border-ink/13 bg-surface/55 p-[clamp(24px,3vw,40px)]"
    >
      <h2 className="mb-[26px] text-[21px] font-medium leading-[1.2] tracking-[-0.02em]">
        Request a free review
      </h2>

      <FormAlert message={state.fieldErrors ? undefined : state.message} ref={alertRef} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-5">
        <TextField
          name="name"
          label="Full name"
          required
          type="text"
          autoComplete="name"
          error={errors.name}
        />
        <TextField
          name="phone"
          label="Phone"
          required
          type="tel"
          autoComplete="tel"
          error={errors.phone}
        />
      </div>

      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        className="mt-5"
        error={errors.email}
      />

      <TextAreaField
        name="message"
        label="What happened?"
        className="mt-5"
        rows={5}
        placeholder="When the damage occurred, what was affected, and whether you've already filed or heard from your carrier."
        error={errors.message}
      />

      <div className="mt-6">
        <TurnstileWidget resetOn={state} />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={pending}
        aria-busy={pending}
        className="mt-[26px] w-full"
      >
        {pending ? "Sending your request…" : "Request my free review"}
      </Button>

      <p className="mt-4 text-[13px] leading-[1.7] text-ink/55">
        No fee unless we recover. We reply within one business day.
      </p>
    </form>
  );
}
