import { EmptyState, Panel, PanelBody } from "@/components/admin/admin-shell";
import { DocumentDownload } from "@/components/admin/document-download";
import { DocumentUpload } from "@/components/admin/document-upload";
import { ListPager, listMeta } from "@/components/admin/list-pager";
import { pageCursors } from "@/lib/admin/audit-range";
import {
  firstParam,
  formatTimeCursor,
  pageSlice,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
} from "@/lib/admin/paging";
import {
  DOCUMENT_KIND_LABEL,
  formatBytes,
  isDocumentKind,
} from "@/lib/claims/documents";
import { loadClaimContext } from "@/lib/claims/queries";
import { formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Forty. The query had no limit at all, which is not "no limit" — PostgREST's
 * `max_rows` is 1000, so the list silently stopped at a thousand documents
 * under a header that counted the rows it had been handed.
 */
const PAGE_SIZE = 40;

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { can } = await loadClaimContext(id);
  const raw = await searchParams;
  const supabase = await createClient();

  const forward = parseTimeCursor(firstParam(raw, "next"));
  const backward = forward ? null : parseTimeCursor(firstParam(raw, "prev"));
  const cursor = forward ?? backward;
  const reversed = backward !== null;

  let query = supabase
    .from("documents")
    .select(
      "id, original_name, kind, mime, size_bytes, visibility, created_at, uploaded_by, uploader:profiles!documents_uploaded_by_fkey(first_name, last_name)",
    )
    .eq("claim_id", id)
    .order("created_at", { ascending: reversed })
    .order("id", { ascending: reversed })
    .limit(PAGE_SIZE + 1);

  if (cursor) query = query.or(timeKeysetClause(reversed ? "asc" : "desc", cursor));

  const [documents, count] = await Promise.all([
    query,
    // The same count the tab-strip badge reads.
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", id),
  ]);

  const page = pageSlice(documents.data ?? [], PAGE_SIZE, reversed);
  const rows = page.rows;
  const total = count.count ?? rows.length;

  const { olderThan: nextCursor, newerThan: prevCursor } = pageCursors({
    ids: rows.map((document) => formatTimeCursor(timeCursorFrom(document))),
    hasMore: page.hasMore,
    ascending: reversed,
    cameFromCursor: cursor !== null,
  });

  const base = `/admin/claims/${id}/documents`;
  const pageHref = (key: "next" | "prev", value: string) => `${base}?${key}=${value}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <Panel
        title="Documents"
        meta={listMeta(rows.length, total, "document", "documents")}
      >
        {rows.length === 0 ? (
          <EmptyState headline="Nothing on the file yet.">
            Declarations pages, photos, estimates and the signed letter of
            representation all live here. A signed LOR is what unlocks the
            representation stage.
          </EmptyState>
        ) : (
          <>
          <ul className="divide-y divide-ink/8">
            {rows.map((document) => {
              const uploader = document.uploader
                ? `${document.uploader.first_name ?? ""} ${document.uploader.last_name ?? ""}`.trim()
                : null;

              return (
                <li
                  key={document.id}
                  className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-[clamp(14px,1.6vw,20px)] py-[14px]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] leading-[1.4] text-ink/88">
                      {document.original_name}
                    </p>
                    <p className="mt-[5px] flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-[1.4] text-ink/42">
                      <span className="text-ink/62">
                        {isDocumentKind(document.kind)
                          ? DOCUMENT_KIND_LABEL[document.kind]
                          : document.kind}
                      </span>
                      <span className="tabular-nums">
                        {formatBytes(document.size_bytes)}
                      </span>
                      <span
                        className={
                          document.visibility === "customer"
                            ? "text-accent/72"
                            : "text-ink/32"
                        }
                      >
                        {document.visibility === "customer"
                          ? "Homeowner can see it"
                          : "CMG only"}
                      </span>
                    </p>
                    <p className="mt-[3px] text-[11.5px] leading-[1.4] text-ink/30">
                      {uploader ? `${uploader} · ` : ""}
                      {formatTimestamp(document.created_at)}
                    </p>
                  </div>

                  <DocumentDownload
                    documentId={document.id}
                    label={document.original_name}
                  />
                </li>
              );
            })}
          </ul>

          <ListPager
            label="Document pages"
            noun="document"
            pluralNoun="documents"
            placement="footer"
            shown={rows.length}
            total={total}
            prevHref={prevCursor ? pageHref("prev", prevCursor) : null}
            nextHref={nextCursor ? pageHref("next", nextCursor) : null}
            startHref={cursor ? base : null}
          />
          </>
        )}
      </Panel>

      <div className="grid gap-4">
        {can.canUploadDocuments ? (
          <Panel title="Add a document">
            <PanelBody>
              <DocumentUpload
                claimId={id}
                canUploadRepresentation={can.canUploadRepresentation}
              />
            </PanelBody>
          </Panel>
        ) : null}

        <Panel title="How downloads work">
          <PanelBody>
            <p className="text-[12.5px] leading-[1.7] text-ink/55">
              The bucket is private and has no public path. Pressing Download asks
              the server to check that this file is yours to read, then issues a
              link that lives for five minutes and arrives as an attachment rather
              than opening in the browser. Every link issued is written to the
              audit trail with who asked and for which document.
            </p>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
