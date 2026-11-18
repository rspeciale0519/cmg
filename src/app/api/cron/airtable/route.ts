import { authorizeCronRequest } from "@/lib/cron/auth";
import { airtableEnabled } from "@/lib/airtable/config";
import { runAirtableDelivery } from "@/lib/airtable/store";
export const maxDuration = 60;
export async function GET(request: Request) {
  const auth = authorizeCronRequest(request.headers);
  if (!auth.ok) return Response.json({ error: "Not authorized" }, { status: auth.status });
  if (!airtableEnabled()) return Response.json({ paused: true }, { headers: { "Cache-Control": "no-store" } });
  try { return Response.json({ sent: await runAirtableDelivery() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Delivery check failed" }, { status: 503 }); }
}
