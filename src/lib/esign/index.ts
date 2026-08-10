import "server-only";

/**
 * Public surface of the e-signature layer — the only module the admin UI needs
 * to import.
 *
 *   esignCapabilities()        which provider is live and whether it can send
 *   sendLor(request)           put the Letter of Representation out for signing
 *   createESignProvider()      the provider itself, for anything lower-level
 *
 * `sendLor` is the *authorized* entry point and the only one exported here.
 * The mechanism it wraps lives in `./lor-dispatch`, performs no authorization
 * of its own, and is deliberately not re-exported: a server action reaching
 * for "the LOR function" must land on the one that asks who is calling.
 *
 * Everything here is server-only. `PANDADOC_API_KEY` and
 * `PANDADOC_WEBHOOK_SHARED_KEY` are read exclusively through `./config`, which
 * carries the `server-only` barrier, and neither is ever exposed under a
 * `NEXT_PUBLIC_` name — so no import path from a client component can reach
 * them without turning into a build error.
 */

export { esignMode, readESignConfig, type ESignConfig } from "./config";
export {
  createESignProvider,
  esignCapabilities,
  type CreateESignProviderOptions,
  type ESignCapabilities,
} from "./provider";
export {
  sendLor,
  type SendLorFailure,
  type SendLorFailureCode,
  type SendLorRequest,
  type SendLorResult,
  type SendLorSuccess,
} from "./send-lor";
export {
  ESignError,
  MANUAL_ESIGN_STATUS,
  type ESignErrorCode,
  type ESignMode,
  type ESignProvider,
  type LorDispatch,
  type LorRequest,
  type LorRole,
  type LorSigner,
  type LorToken,
} from "./types";
export {
  processPandaDocWebhook,
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_SIGNATURE_PARAM,
  type ProcessWebhookDeps,
  type ProcessWebhookInput,
} from "./webhook";
