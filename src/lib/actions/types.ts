import type { z } from "zod";

export type FormState = {
  status: "idle" | "success" | "error";
  /** Shown to the submitter. Always generic about causes we do not want to teach. */
  message?: string;
  fieldErrors?: Record<string, string>;
  /** `claim_ref` on a successful intake; surfaced in the success panel. */
  reference?: string;
};

export const idleState: FormState = { status: "idle" };

export const GENERIC_ERROR =
  "We could not submit that just now. Please try again, or call us and we'll take the details over the phone.";

export const VERIFICATION_ERROR =
  "We could not verify that you're a person. Refresh the page and try again.";

export const RATE_LIMIT_ERROR =
  "That's several submissions in a short time. Wait a few minutes and try again, or call us directly.";

/** First issue per field wins — the form shows one message under each input. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key] = issue.message;
    }
  }

  return errors;
}

export function invalid(fieldErrors: Record<string, string>): FormState {
  return {
    status: "error",
    message: "Check the highlighted fields and submit again.",
    fieldErrors,
  };
}
