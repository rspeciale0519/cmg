import {
  processPandaDocWebhook,
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_SIGNATURE_PARAM,
} from "@/lib/esign/webhook";
import { clientIpFromHeaders, inetOrNull } from "@/lib/rate-limit";
import { isSurfaceOpen } from "@/lib/site-mode";

/**
 * PandaDoc webhook receiver. Node runtime because verification is
 * HMAC-SHA256 via `node:crypto`, and uncached because every delivery is a
 * distinct event that must reach the database.
 *
 * The handler itself does four things and delegates the rest: read the raw
 * body (never parse first — the signature covers those exact bytes), lift the
 * `?signature=` parameter and the `X-PandaDoc-Webhook-Event-Id` header, and
 * hand all of it to `processPandaDocWebhook`, which owns the
 * verify → dedupe → process order.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * The mode question this route asks is "is the staff claims desk open".
 *
 * WHY `/admin` AND NOT "is it platform mode"
 *
 * Nothing about this endpoint belongs to the homeowner or partner portals. It
 * is the second half of an e-signature that staff started from `/admin`: a
 * staff member sends a Letter of Representation, the homeowner signs it at
 * PandaDoc, and this callback is the only way that outcome ever reaches the
 * database. Closing it while `/admin` is open would let staff send documents
 * that can be signed and never recorded — `esign_documents` would sit at `sent`
 * for ever, the reconciliation sweep would keep re-asking, and the claim would
 * show an unsigned LOR that the homeowner has in fact signed. That is a worse
 * failure than the one a 404 here is protecting against.
 *
 * WHY THAT IS SAFE
 *
 * The caller holds no session, so none of the mode gating above is what
 * protects this route in the first place. `processPandaDocWebhook` verifies an
 * HMAC-SHA256 over the raw bytes before parsing them, refuses an unsigned or
 * mis-signed body, and ledgers every accepted delivery by
 * `X-PandaDoc-Webhook-Event-Id` so a replay is recorded once. An unauthenticated
 * caller gains nothing from the route being reachable that they do not already
 * gain in platform mode.
 *
 * The one side effect that does leave the system is notification mail, and that
 * is filtered independently: `deliverableTemplates("staff")` permits
 * `esign_staff_alert` to the CMG inbox and withholds `lor_signed`, which would
 * tell a homeowner to look in a portal that staff mode keeps closed.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSurfaceOpen("/admin")) {
    return Response.json(
      { ok: false, reason: "platform_disabled" },
      { status: 404 },
    );
  }

  const rawBody = await request.text();

  const outcome = await processPandaDocWebhook({
    rawBody,
    signature: new URL(request.url).searchParams.get(WEBHOOK_SIGNATURE_PARAM),
    eventId: request.headers.get(WEBHOOK_EVENT_ID_HEADER),
    ip: inetOrNull(clientIpFromHeaders(request.headers)),
  });

  return Response.json(outcome.body, { status: outcome.status });
}
