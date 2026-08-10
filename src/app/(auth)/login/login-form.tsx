"use client";

import { useActionState, useEffect, useRef } from "react";
import { TextField } from "@/components/forms/controls";
import { FormAlert } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/types";

export function LoginForm({ next }: { next: string | null }) {
  const [state, formAction, pending] = useActionState(signIn, idleState);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") alertRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate>
      <FormAlert message={state.message} ref={alertRef} />

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <TextField
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="username"
        autoFocus
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        required
        autoComplete="current-password"
        className="mt-5"
      />

      <Button
        type="submit"
        size="md"
        disabled={pending}
        aria-busy={pending}
        className="mt-7 w-full"
      >
        {pending ? "Signing you in…" : "Sign in"}
      </Button>
    </form>
  );
}
