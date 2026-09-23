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

/**
 * What every invite-issuing staff action shows in `staff` mode instead of
 * minting a token: an invitation is a `/invite/:token` link and nothing else,
 * and that surface is closed until `platform` mode opens the customer and
 * partner portals with it. `issueInvite` would still succeed — the write is
 * service-role and the database has no opinion about site mode — so the
 * refusal has to be stated here, as a normal `FormState`, rather than by
 * letting the action redirect a staff member out of the page they are
 * already on (`requireOpenPath` is right for the public `/invite` pages and
 * wrong for a control that lives on `/admin`).
 */
export const INVITE_SURFACE_PAUSED =
  "Invitations are paused until the customer portal opens.";

export const VERIFICATION_ERROR =
  "We could not verify that you're a person. Refresh the page and try again.";

/**
 * The only answer the password-recovery request form gives once a submission
 * passes its abuse gates — for an active account, an unknown address, a
 * deactivated account, a surface closed in this mode, and a delivery failure
 * alike. Any second sentence would make the form an account directory.
 */
export const PASSWORD_RESET_REQUESTED =
  "If an account exists for that email, we sent a link to reset the password.";

export const RATE_LIMIT_ERROR =
  "That's several submissions in a short time. Wait a few minutes and try again, or call us directly.";

/**
 * What the reader is told when the request never completed a round trip.
 *
 * It states the uncertainty rather than resolving it, because the client cannot
 * tell the two cases apart: a rejected `fetch` looks identical whether the POST
 * never left the machine or whether it arrived, ran, committed, and the response
 * was lost coming back. "Nothing was saved" would be a guess, and on a claims
 * desk the guess that is wrong half the time is the one that gets a status
 * advanced twice.
 */
export const CONNECTION_LOST =
  "The connection dropped before the desk heard back. What you typed is still here — reload the page before you try again, because this may already have been recorded.";

/**
 * Next signals `redirect()` and `notFound()` by throwing, and both must keep
 * travelling. `digest` is the documented carrier: `NEXT_REDIRECT;…` and
 * `NEXT_NOT_FOUND`.
 */
function isControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}

/**
 * Wraps a server action so a *transport* failure lands as a refusal instead of
 * as an exception.
 *
 * `useActionState` does not catch. A rejected action promise is re-thrown during
 * render and travels to the nearest error boundary — of which this app has two,
 * against twenty-eight call sites. Measured on a claim's Overview with `fetch`
 * stubbed to reject: the note an adjuster had written for the homeowner, the
 * status radios, and the claim's whole tab strip were replaced by
 * `admin/error.tsx`, which said "no work has been lost". The note was gone; the
 * textarea read `""` after Try again.
 *
 * Every refusal path in this codebase already threads `values` back so React's
 * post-action reset lands on what was typed. This puts the one failure mode that
 * is not a refusal onto the same path. The echo here is every string field in
 * the submission rather than a named list, because the wrapper does not know the
 * action's schema and a field it forgot is a field the operator retypes.
 *
 * Constrained structurally rather than to `FormState`, because `EnrollmentState`
 * carries its own status union (`"ready"`, not `"success"`) and so is not one —
 * and the MFA setup screen is precisely where a dropped connection must not
 * throw away the secret the operator is halfway through entering.
 *
 * `31` call sites, and the count is why this is a wrapper rather than 31 local
 * try/catches: the next form somebody adds gets it by copying the line above it.
 */
export function resilient<S extends { status: string; message?: string }>(
  action: (previous: S, data: FormData) => Promise<S>,
): (previous: S, data: FormData) => Promise<S> {
  return async (previous, data) => {
    try {
      return await action(previous, data);
    } catch (error) {
      if (isControlFlow(error)) throw error;

      const values: Record<string, string> = {};
      for (const [key, value] of data.entries()) {
        if (typeof value === "string") values[key] = value;
      }

      /* Spread the previous state so a shape this wrapper does not know about —
         `EnrollmentState`'s `factorId` and `qrCode`, say — survives the failure
         rather than being replaced by a bare error. */
      return { ...previous, status: "error", message: CONNECTION_LOST, values };
    }
  };
}

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
