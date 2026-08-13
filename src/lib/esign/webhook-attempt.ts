export type WebhookAttemptClaim = {
  esignStatus: string | null;
  currentDocumentId: string | null;
  activeAttemptToken: string | null;
  dispatchToken: string | null;
};

export type WebhookAttemptIdentity = {
  documentId: string | null;
  attemptToken: string | null;
};

/** Pure preflight; mutation RPCs repeat this decision under a claim-row lock. */
export function classifyWebhookAttempt(
  claim: WebhookAttemptClaim,
  event: WebhookAttemptIdentity,
): "current" | "dispatch_in_flight" | "stale" {
  if (
    event.attemptToken !== null &&
    claim.dispatchToken === event.attemptToken &&
    claim.activeAttemptToken !== event.attemptToken
  ) {
    return "dispatch_in_flight";
  }
  if (
    claim.esignStatus === "manual_pending" ||
    claim.currentDocumentId === null ||
    event.documentId === null ||
    claim.currentDocumentId !== event.documentId ||
    (claim.activeAttemptToken !== null &&
      claim.activeAttemptToken !== event.attemptToken)
  ) {
    return "stale";
  }
  return "current";
}
