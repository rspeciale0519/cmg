"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState, useEffect, useRef } from "react";
import { TextField } from "@/components/forms/controls";
import { FormAlert } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { beginTotpEnrollment, verifyTotp } from "@/lib/actions/mfa";
import { idleEnrollment, idleState } from "@/lib/actions/types";

function CodeForm({
  factorId,
  next,
  submitLabel,
}: {
  factorId: string;
  next: string | null;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(verifyTotp, idleState);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") alertRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate>
      <FormAlert message={state.message} ref={alertRef} />
      <input type="hidden" name="factorId" value={factorId} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <TextField
        name="code"
        label="6-digit code"
        required
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="000000"
      />

      <Button
        type="submit"
        size="md"
        disabled={pending}
        aria-busy={pending}
        className="mt-6 w-full"
      >
        {pending ? "Checking…" : submitLabel}
      </Button>
    </form>
  );
}

/**
 * The QR image and the typed secret are the same secret in two forms — a phone
 * with a camera takes the first, a password manager on the same machine takes
 * the second. Offering only the QR strands anyone setting this up on the device
 * the code is displayed on.
 */
function Enrollment({ next }: { next: string | null }) {
  const [state, formAction, pending] = useActionState(
    beginTotpEnrollment,
    idleEnrollment,
  );

  if (state.status === "ready" && state.factorId) {
    return (
      <>
        <div className="flex flex-col items-center gap-5 border-b border-ink/13 pb-6">
          <div className="rounded-md bg-ink p-3">
            <img
              src={state.qrCode}
              alt="QR code for enrolling this account in your authenticator app"
              width={168}
              height={168}
              className="block size-[168px]"
            />
          </div>
          <div className="w-full">
            <p className="text-xs leading-[1.55] text-ink/72">
              Or enter this key by hand
            </p>
            <p className="mt-[6px] break-all font-mono text-[15px] leading-[1.6] tracking-[0.06em] text-accent">
              {state.secret}
            </p>
          </div>
        </div>

        <p className="mt-6 mb-5 text-[15px] leading-[1.7] text-ink/72">
          Scan the code with Google Authenticator, 1Password, Authy or any TOTP app,
          then enter the 6-digit code it shows.
        </p>

        <CodeForm
          factorId={state.factorId}
          next={next}
          submitLabel="Verify and finish setup"
        />
      </>
    );
  }

  return (
    <form action={formAction}>
      <FormAlert message={state.message} />
      <p className="text-[15px] leading-[1.7] text-ink/78">
        Staff accounts require an authenticator app. You will scan a code once; after
        that, signing in asks for a 6-digit code from the app.
      </p>
      <Button
        type="submit"
        size="md"
        disabled={pending}
        aria-busy={pending}
        className="mt-7 w-full"
      >
        {pending ? "Preparing…" : "Set up authenticator"}
      </Button>
    </form>
  );
}

export function MfaPanel({
  verifiedFactorId,
  next,
}: {
  verifiedFactorId: string | null;
  next: string | null;
}) {
  if (verifiedFactorId) {
    return (
      <>
        <p className="mb-5 text-[15px] leading-[1.7] text-ink/78">
          Open your authenticator app and enter the current code for CMG Property
          Solutions.
        </p>
        <CodeForm factorId={verifiedFactorId} next={next} submitLabel="Verify" />
      </>
    );
  }

  return <Enrollment next={next} />;
}
