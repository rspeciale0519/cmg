import type { z } from "zod";

export type FormState = {
  status: "idle" | "success" | "error";
  /** Shown to the submitter. Always generic about causes we do not want to teach. */
  message?: string;
  fieldErrors?: Record<string, string>;
  /**
   * The strings this submission was made with, echoed back on a REFUSAL only,
   * and the reason every uncontrolled field in this codebase reads
   * `defaultValue={state.values?.x ?? …}`.
   *
   * React 19 resets a `<form action={…}>` when the action *resolves*, not when
   * it succeeds. For a successful save that is exactly right — the form has
   * been submitted and should go back to reflecting the server. For a refusal
   * it was silent data loss: the whole "Add a company" form came back empty
   * under an ember-bordered Email field, its own error message, and a summary
   * saying "Check the highlighted fields and submit again" over a blank form
   * with nothing left highlighted. An instruction that cannot be followed.
   *
   * Echoing the submitted strings makes React's reset land on them instead of
   * on the values that were there at mount. On success `values` is absent, so
   * a create form still empties and an edit form still re-seeds from the
   * server — today's correct behaviour is untouched.
   */
  values?: Record<string, string>;
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

/**
 * Counted, because one marked field is the common case. The claim screens write
 * their own refusals and already say "Check the highlighted field and post
 * again"; every form that came through here said "fields" whether it had marked
 * one or five, so the product counted correctly on some screens and not others.
 */
export function invalid(
  fieldErrors: Record<string, string>,
  values?: Record<string, string>,
): FormState {
  const marked = Object.keys(fieldErrors).length;

  return {
    status: "error",
    message: `Check the highlighted ${marked === 1 ? "field" : "fields"} and submit again.`,
    fieldErrors,
    values,
  };
}

/**
 * The raw submitted strings for the named fields, for `FormState.values`.
 *
 * Raw rather than parsed: the point is to hand back what the person typed so
 * they can correct it, not what the schema made of it. A trimmed or coerced
 * echo would silently edit their input under the error message telling them to
 * fix it.
 *
 * `FormData.get` answers `File | string | null`, and only strings are taken.
 * That is the guarantee that no file ever reaches `values`: a `File` has no
 * `defaultValue` representation, and the one field in this workspace that
 * carries one — the document upload — must be re-chosen by the operator after
 * a refusal, because no page may set a file input's value.
 *
 * Name only the fields the form re-seeds. Anything a hidden input carries with
 * an explicit `value` (ids, the delete confirmation's target) survives the
 * reset already and does not belong here.
 */
export function submittedValues(
  formData: FormData,
  keys: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") values[key] = value;
  }

  return values;
}
