import type { Metadata } from "next";
import { DocumentDownload, DocumentUpload } from "@/components/portal/document-controls";
import { PortalPager } from "@/components/portal/pager";
import { EmptyState, Panel, PanelBody } from "@/components/portal/surfaces";
import { pageCursors } from "@/lib/admin/audit-range";
import { formatBytes, type DocumentKind } from "@/lib/claims/documents";
import { formatDateStamp } from "@/lib/format";
import {
  firstParam,
  formatTimeCursor,
  pageSlice,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
} from "@/lib/paging";
import { PORTAL_KIND_LABEL } from "@/lib/portal/documents";
import { portalSectionTitle, requirePortalClaim } from "@/lib/portal/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return portalSectionTitle(id, "Documents");
}

const PAGE_SIZE = 20;

export default async function PortalDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await requirePortalClaim(id);

  const raw = await searchParams;
  const supabase = await createClient();

  const forward = parseTimeCursor(firstParam(raw, "next"));
  const backward = forward ? null : parseTimeCursor(firstParam(raw, "prev"));
  const cursor = forward ?? backward;
  const reversed = backward !== null;

  /* No `.eq("visibility", "customer")`, for the reason the activity feed gives
     in full: `documents_select` admits a customer only to rows on their own
     claim marked `visibility = 'customer'`, so this select cannot return an
     internal document — it is not filtered out, it is not returned. The count
     below runs through the same client and therefore counts the same rows,
     which is why the badge on the tab strip and the number under this panel
     agree. */
  let query = supabase
    .from("documents")
    .select("id, original_name, kind, size_bytes, created_at, uploaded_by")
    .eq("claim_id", id)
    .order("created_at", { ascending: reversed })
    .order("id", { ascending: reversed })
    .limit(PAGE_SIZE + 1);

  if (cursor) query = query.or(timeKeysetClause(reversed ? "asc" : "desc", cursor));

  const [documents, count] = await Promise.all([
    query,
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", id),
  ]);

  const page = pageSlice(documents.data ?? [], PAGE_SIZE, reversed);
  const rows = page.rows;
  const total = count.count ?? rows.length;

  const { olderThan: nextCursor, newerThan: prevCursor } = pageCursors({
    ids: rows.map((row) => formatTimeCursor(timeCursorFrom(row))),
    hasMore: page.hasMore,
    ascending: reversed,
    cameFromCursor: cursor !== null,
  });

  const base = `/portal/claims/${id}/documents`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <Panel title="Files on your claim">
        {rows.length === 0 ? (
          <EmptyState headline="No files are on your claim yet.">
            Anything we share with you appears here, alongside anything you send
            us. Photographs of the damage are the most useful thing you can add.
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-ink/8">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-[clamp(18px,2.4vw,28px)] py-[16px]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[14.5px] leading-[1.5] text-ink/88">
                      {row.original_name}
                    </p>
                    <p className="mt-[6px] flex flex-wrap items-baseline gap-x-[10px] gap-y-1 text-[12.5px] leading-[1.45] text-ink/42">
                      <span className="text-ink/55">
                        {PORTAL_KIND_LABEL[row.kind as DocumentKind] ?? "Document"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(row.size_bytes)}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={row.created_at}>
                        {formatDateStamp(row.created_at)}
                      </time>
                    </p>
                  </div>

                  <DocumentDownload documentId={row.id} label={row.original_name} />
                </li>
              ))}
            </ul>

            <PortalPager
              label="Document pages"
              noun="file"
              pluralNoun="files"
              shown={rows.length}
              total={total}
              prevHref={prevCursor ? `${base}?prev=${prevCursor}` : null}
              nextHref={nextCursor ? `${base}?next=${nextCursor}` : null}
              startHref={cursor ? base : null}
            />
          </>
        )}
      </Panel>

      <div className="grid gap-4">
        <Panel title="Send us a file">
          <PanelBody>
            <DocumentUpload claimId={id} />
          </PanelBody>
        </Panel>

        <Panel title="What helps most">
          <PanelBody>
            <ul className="grid gap-[11px] text-[13.5px] leading-[1.65] text-ink/62">
              <li>
                Photographs of every damaged area, wide first and then close up.
              </li>
              <li>
                Anything the carrier sends you — letters, emails, their estimate.
              </li>
              <li>Receipts for repairs you have already paid for.</li>
            </ul>
            <p className="mt-[16px] text-[12.5px] leading-[1.6] text-ink/40">
              Everything you send here goes straight to your adjuster and stays on
              the claim file.
            </p>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
