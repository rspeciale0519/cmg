/**
 * Shared vocabulary for the e-signature layer.
 *
 * Nothing here imports `server-only`: these are types plus two tiny value
 * helpers, and keeping them free of the server barrier lets the pure signature
 * and payload-reading tests import them without stubbing the module.
 */

export type ESignMode = "pandadoc" | "manual" | "signudoc";

export type LorRole = "Homeowner1" | "Homeowner2";

export type LorSigner = {
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  role: LorRole;
};

export type LorToken = { name: string; value: string };

/** What a provider needs in order to put an LOR in front of the claimants. */
export type LorRequest = {
  claimId: string;
  /** One-shot dispatch ownership, echoed by PandaDoc in every webhook. */
  dispatchAttemptToken: string;
  claimRef: string;
  documentName: string;
  signers: LorSigner[];
  tokens: LorToken[];
  message?: string | null;
  /** Persist provider identity and irreversible-send intent before transport. */
  beforeSend?: (providerDocumentId: string) => Promise<void>;
  /** Server-held bytes whose contents and recipients staff reviewed. */
  reviewedPdf?: Uint8Array;
};

/** What a provider gives back once the letter is on its way. */
export type LorDispatch = {
  /** PandaDoc document id; null in manual mode, where there is no provider document. */
  providerDocumentId: string | null;
  /** Mirrored into `claims.esign_status`. */
  esignStatus: string;
  /** True when the provider itself emailed the signers. */
  deliveredByProvider: boolean;
};

/**
 * The seam between "how a letter gets signed" and "what the claim record does
 * about it". Implementations are transport only — persistence, the status
 * transition, the feed entry and the audit row are `sendLor()`'s job, because
 * they are identical whichever way the paper moves.
 */
export interface ESignProvider {
  readonly kind: ESignMode;
  /** False for manual mode: staff deliver the letter themselves. */
  readonly canSendElectronically: boolean;
  dispatchLor(request: LorRequest): Promise<LorDispatch>;
  downloadSignedPdf(providerDocumentId: string): Promise<Uint8Array>;
}

export type ESignErrorCode =
  | "not_configured"
  | "unsupported"
  | "creation_failed"
  | "draft_timeout"
  | "send_failed"
  | "download_failed"
  | "rate_limited";

export class ESignError extends Error {
  readonly code: ESignErrorCode;
  readonly httpStatus?: number;
  /** True when PandaDoc may have accepted a send whose response was lost. */
  readonly deliveryUncertain: boolean;

  constructor(
    code: ESignErrorCode,
    message: string,
    httpStatus?: number,
    deliveryUncertain = false,
  ) {
    super(message);
    this.name = "ESignError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.deliveryUncertain = deliveryUncertain;
  }
}

/** Statuses PandaDoc reports; mirrored verbatim into `claims.esign_status`. */
export const PANDADOC_TERMINAL_FAILURE_STATUSES = [
  "document.declined",
  "document.expired",
  "document.voided",
  "document.cancelled",
  "document.rejected",
] as const;

export const MANUAL_ESIGN_STATUS = "manual_pending";

export type PandaDocWebhookEvent = {
  event: string;
  data: Record<string, unknown>;
};

/** Outcome of applying one event. `ignored` is a success: nothing to do here. */
export type EventOutcome = "applied" | "ignored" | "failed";

export type WebhookOutcome = {
  status: number;
  body: {
    ok: boolean;
    reason?: string;
    duplicate?: boolean;
    applied?: number;
    ignored?: number;
    failed?: number;
  };
};
