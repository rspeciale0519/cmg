import { randomUUID } from "node:crypto";
import { signWebhookBody } from "./signature";
import type { LorRequest } from "./types";

/**
 * Test fixtures shared by the e-signature suites. Not imported by application
 * code — it lives beside the modules it describes so the shapes cannot drift
 * from the types they are built against.
 */

export function sendLorRequestFixture(overrides: Partial<LorRequest> = {}): LorRequest {
  const claimId = overrides.claimId ?? randomUUID();
  const claimRef = overrides.claimRef ?? "CMG-2026-0042";

  return {
    claimId,
    dispatchAttemptToken: overrides.dispatchAttemptToken ?? randomUUID(),
    claimRef,
    documentName: `LOR — ${claimRef}`,
    signers: [
      {
        email: "dana@example.com",
        firstName: "Dana",
        lastName: "Roe",
        role: "Homeowner1",
      },
      {
        email: "robin@example.com",
        firstName: "Robin",
        lastName: "Roe",
        role: "Homeowner2",
      },
    ],
    tokens: [
      { name: "Claim.Ref", value: claimRef },
      { name: "Claim.Carrier", value: "Citizens" },
      { name: "Property.Address", value: "1 Test Way, Orlando, Florida 32801" },
    ],
    message: null,
    ...overrides,
  };
}

type EventData = Record<string, unknown>;

const withClaim = (
  claimId: string,
  documentId: string,
  extra: EventData,
  dispatchAttemptToken?: string,
): EventData => ({
  id: documentId,
  metadata: {
    claim_id: claimId,
    ...(dispatchAttemptToken
      ? { dispatch_attempt_token: dispatchAttemptToken }
      : {}),
  },
  ...extra,
});

export function stateChangedEvent(
  claimId: string,
  documentId: string,
  status: string,
  dispatchAttemptToken?: string,
) {
  return {
    event: "document_state_changed",
    data: withClaim(claimId, documentId, { status }, dispatchAttemptToken),
  };
}

export function recipientCompletedEvent(
  claimId: string,
  documentId: string,
  signer: { firstName: string; lastName: string },
  dispatchAttemptToken?: string,
) {
  return {
    event: "recipient_completed",
    data: withClaim(claimId, documentId, {
      status: "document.sent",
      action_by: { first_name: signer.firstName, last_name: signer.lastName },
    }, dispatchAttemptToken),
  };
}

export function pdfReadyEvent(
  claimId: string,
  documentId: string,
  dispatchAttemptToken?: string,
) {
  return {
    event: "document_completed_pdf_ready",
    data: withClaim(
      claimId,
      documentId,
      { status: "document.completed" },
      dispatchAttemptToken,
    ),
  };
}

export function creationFailedEvent(
  claimId: string,
  documentId: string,
  detail: string,
  dispatchAttemptToken?: string,
) {
  return {
    event: "document_creation_failed",
    data: withClaim(
      claimId,
      documentId,
      { error: { detail } },
      dispatchAttemptToken,
    ),
  };
}

export type WebhookDelivery = {
  rawBody: string;
  signature: string;
  eventId: string;
};

/** A correctly signed delivery, exactly as PandaDoc would post it. */
export function signedDelivery(
  sharedKey: string,
  events: unknown[],
  eventId: string = randomUUID(),
): WebhookDelivery {
  const rawBody = JSON.stringify(events);
  return { rawBody, signature: signWebhookBody(sharedKey, rawBody), eventId };
}

/** A minimal, valid PDF — enough bytes for the storage and size assertions. */
export function fakeSignedPdf(): Uint8Array {
  return new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  );
}
