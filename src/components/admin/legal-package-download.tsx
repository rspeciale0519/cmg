"use client";

import { useEffect, useRef, useState } from "react";
import { issueLegalPackageDownload } from "@/lib/actions/legal-package-files";
import { buildPackageVolume, partitionPackageDocuments } from "@/lib/legal/package";
import { readPackageFile } from "@/lib/legal/package-file-reader";
import { createPackageSummaryPdf } from "@/lib/legal/package-summary";
import type { LegalPackageSnapshot } from "@/lib/legal/types";
import { AdminButton } from "./form-controls";

export function LegalPackageDownload({ snapshot }: { snapshot: LegalPackageSnapshot }) {
  return <PackageDownloadControls key={snapshot.id} snapshot={snapshot} />;
}

function PackageDownloadControls({ snapshot }: { snapshot: LegalPackageSnapshot }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  const urls = useRef(new Set<string>());
  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
  }, []);

  let volumes: ReturnType<typeof partitionPackageDocuments> = [];
  let preparationError = "";
  try { volumes = partitionPackageDocuments(snapshot.documents); }
  catch { preparationError = "This package has an invalid document list. Review and prepare it again."; }

  async function download(index: number) {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(index); setFailed(false); setMessage("Preparing the selected package part…");
    try {
      const result = await buildPackageVolume(snapshot, index, {
        signal: controller.signal,
        createSummaryPdf: createPackageSummaryPdf,
        onProgress: (done, total) => {
          if (active.current === controller) setMessage(`Prepared ${done} of ${total} original files.`);
        },
        loadDocument: async (document, signal) => {
          const form = new FormData(); form.set("packageId", snapshot.id); form.set("documentId", document.id);
          const link = await issueLegalPackageDownload({ status: "idle" }, form);
          signal?.throwIfAborted();
          if (link.status !== "success" || !link.url || link.sizeBytes !== document.sizeBytes) {
            throw new Error("A selected document is unavailable or changed. Review the package again.");
          }
          const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
          const target = new URL(link.url);
          if (target.origin !== expectedOrigin || target.username || target.password) throw new Error("The file link is not valid.");
          const response = await fetch(target, { signal, credentials: "omit", cache: "no-store", redirect: "error" });
          return readPackageFile(response, document.sizeBytes, signal);
        },
      });
      controller.signal.throwIfAborted();
      const blob = new Blob([Uint8Array.from(result.bytes).buffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob); urls.current.add(url);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename;
      anchor.rel = "noreferrer"; anchor.click();
      window.setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 60000);
      setMessage(`Part ${index + 1} is ready. Check your downloads before sending it to the firm.`);
    } catch {
      if (!controller.signal.aborted && active.current === controller) {
        setFailed(true); setMessage("The package could not be prepared. Review the selected files and try this part again.");
      }
      controller.abort();
    } finally { if (active.current === controller) { active.current = null; setBusy(null); } }
  }

  return <section className="mt-4 space-y-3" aria-label="Download reviewed legal package">
    <p className="text-sm text-ink/70">Download each part. Sending is recorded separately after you send the files to the firm.</p>
    {preparationError ? <p role="alert">{preparationError}</p> : volumes.map((part, index) =>
      <div key={index} className="flex flex-wrap items-center gap-3">
        <AdminButton type="button" disabled={busy !== null} onClick={() => void download(index)}>
          {busy === index ? "Preparing…" : `Download part ${index + 1} of ${volumes.length}`}
        </AdminButton>
        <span className="text-xs text-ink/60">{part.length} files · {(part.reduce((sum, file) => sum + file.sizeBytes, 0) / 1048576).toFixed(1)} MiB</span>
      </div>)}
    {busy !== null ? <AdminButton type="button" onClick={() => {
      active.current?.abort(); active.current = null; setBusy(null);
      setMessage("Preparation cancelled. No sending was recorded.");
    }}>Cancel preparation</AdminButton> : null}
    {message ? <p role={failed ? "alert" : "status"} className="text-sm">{message}</p> : null}
  </section>;
}
