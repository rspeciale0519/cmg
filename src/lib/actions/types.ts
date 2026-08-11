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

/**
 * Invite issuance carries one extra field. It lives here rather than beside the
 * action because a `"use server"` module may export only async functions — a
 * type or a constant declared there is a build error, not a style preference.
 */
export type InviteIssueState = FormState & {
  /** The raw invite link, returned only when email delivery is not configured. */
  manualLink?: string;
};

export const idleInviteIssueState: InviteIssueState = { status: "idle" };

/**
 * A freshly minted signed URL, returned to the caller rather than redirected
 * to: the browser has to open it in a new tab so the admin page the staff
 * member is working in stays where it is. Here for the same reason
 * `InviteIssueState` is.
 */
export type DownloadState = FormState & {
  /** 5-minute signed URL with attachment disposition. Never logged, never stored. */
  url?: string;
  filename?: string;
};

export const idleDownloadState: DownloadState = { status: "idle" };

/** TOTP enrolment state, here for the same reason `InviteIssueState` is. */
export type EnrollmentState = {
  status: "idle" | "ready" | "error";
  message?: string;
  factorId?: string;
  /** SVG data URI produced by GoTrue; rendered as the scannable code. */
  qrCode?: string;
  /** The same secret in text, for authenticator apps that cannot use a camera. */
  secret?: string;
};

export const idleEnrollment: EnrollmentState = { status: "idle" };

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
    /* `Object.hasOwn` rather than `in`, matching src/lib/claims/status.ts. Paths
       come from this repo's own zod schemas so nothing reaches it today, but `in`
       answers true for `toString` on an empty object — a field named after any
       Object.prototype member would silently lose its first error message, and
       the reader should not have to check the schema list to know it is safe. */
    if (typeof key === "string" && !Object.hasOwn(errors, key)) {
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
