import { createHmac } from "node:crypto";

import { constantTimeEquals } from "./constant-time";

/**
 * PandaDoc signs every delivery with HMAC-SHA256 over the **raw** HTTP body,
 * hex-encoded, delivered as the `?signature=` query parameter
 * (docs/reference/pandadoc/04-webhooks.md). Verification therefore has to run
 * against the bytes as received — parsing first and re-serialising produces a
 * different string and a signature that never matches.
 */

const HEX_SHA256 = /^[0-9a-fA-F]{64}$/;

/**
 * Timing-safe by construction, not by care:
 *
 * - the only comparison performed on the digest is `constantTimeEquals`, which
 *   is `crypto.timingSafeEqual` behind a length guard;
 * - nothing else can decide the verdict — the function returns that call, so a
 *   well-formed candidate's accept/reject is exactly the constant-time result;
 * - the shape checks that precede it look only at the *candidate*, never at
 *   the expected digest, so they leak nothing beyond "a SHA-256 hex digest is
 *   64 hex characters", which is public and fixed for every request.
 */
export function verifyWebhookSignature(
  sharedKey: string | undefined | null,
  rawBody: string,
  signature: string | undefined | null,
): boolean {
  if (!sharedKey || sharedKey.length === 0) return false;
  if (typeof signature !== "string" || !HEX_SHA256.test(signature)) return false;

  const expected = createHmac("sha256", sharedKey).update(rawBody, "utf8").digest();

  return constantTimeEquals(Buffer.from(signature, "hex"), expected);
}

/** Test/tooling helper: the signature PandaDoc would send for this body. */
export function signWebhookBody(sharedKey: string, rawBody: string): string {
  return createHmac("sha256", sharedKey).update(rawBody, "utf8").digest("hex");
}
