import {
  processPandaDocWebhook,
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_SIGNATURE_PARAM,
} from "@/lib/esign/webhook";
import { clientIpFromHeaders, inetOrNull } from "@/lib/rate-limit";

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

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const outcome = await processPandaDocWebhook({
    rawBody,
    signature: new URL(request.url).searchParams.get(WEBHOOK_SIGNATURE_PARAM),
    eventId: request.headers.get(WEBHOOK_EVENT_ID_HEADER),
    ip: inetOrNull(clientIpFromHeaders(request.headers)),
  });

  return Response.json(outcome.body, { status: outcome.status });
}
