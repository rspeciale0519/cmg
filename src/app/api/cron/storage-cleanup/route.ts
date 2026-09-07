import { authorizeCronRequest } from "@/lib/cron/auth";
import { sweepStorageCleanup } from "@/lib/storage-cleanup/queue";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_LIMIT = 25;

export async function GET(request: Request): Promise<Response> {
  const verdict = authorizeCronRequest(request.headers);
  if (!verdict.ok) {
    return Response.json(
      { ok: false, error: verdict.reason },
      { status: verdict.status },
    );
  }

  const report = await sweepStorageCleanup(createAdminClient(), BATCH_LIMIT);
  return Response.json({ ok: true, ...report });
}

export const POST = GET;
