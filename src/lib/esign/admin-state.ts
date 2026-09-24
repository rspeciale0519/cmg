export type AdminESignTone = "neutral" | "active" | "success" | "failure";

export type AdminESignState = {
  key:
    | "not_started"
    | "manual_pending"
    | "sent"
    | "viewed"
    | "recipient_completed"
    | "completed"
    | "declined"
    | "voided"
    | "expired"
    | "creation_failed"
    | "send_uncertain"
    | "failed_unknown";
  label: string;
  detail: string;
  tone: AdminESignTone;
  recoverable: boolean;
};

/**
 * Staff-facing vocabulary for the provider mirror on `claims`.
 *
 * This deliberately does not fall back to the claim lifecycle label. A claim
 * can remain at `lor_sent` after PandaDoc declines, expires or fails creation;
 * calling that state "LOR sent" hides the action the operator must take.
 */
export function adminESignState(
  status: string | null,
  claimStatus?: string,
): AdminESignState {
  if (status?.startsWith("recipient.completed")) {
    const [, completed, recipients] = status.split(":");
    const progress = completed && recipients
      ? `${completed} of ${recipients} recipients signed; `
      : "At least one recipient signed; ";
    return {
      key: "recipient_completed",
      label: "Signer completed",
      detail: `${progress}the request is waiting on any remaining signer.`,
      tone: "active",
      recoverable: false,
    };
  }

  const pastRepresentation =
    claimStatus !== undefined &&
    !["new_intake", "under_review", "lor_sent"].includes(claimStatus);

  /* `manual_pending` is never cleared when a manual letter is filed: the claim
     simply moves on. `lor_sent → lor_signed` is gated on a `lor_signed`
     document, so any later status proves the signed copy is in Documents.
     `rejected` is the one exit from `lor_sent` that skips that gate, so it
     keeps the pending state rather than claiming representation. */
  if (
    status === "manual_pending" &&
    pastRepresentation &&
    claimStatus !== "rejected"
  ) {
    return {
      key: "completed",
      label: "Representation completed",
      detail: "The signed letter was uploaded and is filed in Documents.",
      tone: "success",
      recoverable: false,
    };
  }

  if (status === null && pastRepresentation) {
    return {
      key: "completed",
      label: "Representation completed",
      detail:
        "This claim is past the representation stage. The signed letter is available in Documents when it was filed through CMG.",
      tone: "success",
      recoverable: false,
    };
  }

  switch (status) {
    case null:
      return {
        key: "not_started",
        label: "Not requested",
        detail: "No signing request is recorded for this claim.",
        tone: "neutral",
        recoverable: false,
      };
    case "manual_pending":
      return {
        key: "manual_pending",
        label: "Manual signature pending",
        detail:
          "Staff must deliver the letter outside the system and upload the signed copy.",
        tone: "active",
        recoverable: false,
      };
    case "document.sent":
      return {
        key: "sent",
        label: "Sent for signature",
        detail: "The provider delivered the request; no signer has completed it yet.",
        tone: "active",
        recoverable: false,
      };
    case "document.viewed":
      return {
        key: "viewed",
        label: "Viewed by a signer",
        detail: "At least one recipient opened the signing request.",
        tone: "active",
        recoverable: false,
      };
    case "recipient_completed":
      return {
        key: "recipient_completed",
        label: "Signer completed",
        detail: "At least one recipient signed; the request is waiting on any remaining signer.",
        tone: "active",
        recoverable: false,
      };
    case "document.completed":
      return {
        key: "completed",
        label: "Signing completed",
        detail:
          claimStatus === "lor_sent"
            ? "Every required signer completed the provider document. The sealed PDF is waiting to be filed."
            : "Every required signer completed the provider document and the signed letter is filed.",
        tone: "success",
        recoverable: false,
      };
    case "document.declined":
    case "document.rejected":
      return {
        key: "declined",
        label: "Signature declined",
        detail: "A recipient declined the request. It will not complete without staff action.",
        tone: "failure",
        recoverable: true,
      };
    case "document.voided":
    case "document.cancelled":
      return {
        key: "voided",
        label: "Signing request voided",
        detail: "The provider request is no longer active and cannot collect signatures.",
        tone: "failure",
        recoverable: true,
      };
    case "document.expired":
      return {
        key: "expired",
        label: "Signing request expired",
        detail: "The request expired before every required signature was collected.",
        tone: "failure",
        recoverable: true,
      };
    case "document.creation_failed":
      return {
        key: "creation_failed",
        label: "Signing request creation failed",
        detail: "The provider could not create the document. No active request is available.",
        tone: "failure",
        recoverable: true,
      };
    case "document.sending":
    case "document.send_uncertain":
      return {
        key: "send_uncertain",
        label: "Delivery confirmation pending",
        detail:
          "Do not resend or switch to manual signing. Verify the provider document in PandaDoc; its next matching webhook will reconcile this claim automatically.",
        tone: "active",
        recoverable: false,
      };
    default:
      return {
        key: "failed_unknown",
        label: "Provider status needs review",
        detail: `The provider reported “${status}”. Verify the request in PandaDoc and the claim activity before changing representation state.`,
        tone: "failure",
        recoverable: false,
      };
  }
}
