"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

/**
 * A URL the operator hands to someone else, so the primary action is copying
 * it rather than following it. The value sits in a read-only input so it can
 * be selected and copied by hand where the clipboard API is unavailable, and
 * the anchor opens in a new tab so a click never navigates the owner out of the
 * workspace into the public form.
 */
export function CopyLink({ href, label }: { href: string; label: string }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copied === "idle") return;
    const timer = setTimeout(() => setCopied("idle"), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        readOnly
        aria-label={label}
        value={href}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-ink/16 bg-canvas/60 px-[10px] py-[7px] font-mono text-[12.5px] leading-[1.5] text-ink/85"
      />
      <button
        type="button"
        onClick={copy}
        className={cx(
          "inline-flex min-h-[34px] items-center rounded-md border px-[13px] text-[13px] font-medium leading-[1.4] transition-colors duration-150",
          "border-accent text-accent hover:bg-accent/12",
        )}
      >
        Copy link
      </button>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[13px] underline text-ink/72 hover:text-ink"
      >
        Open in a new tab
      </a>
      <span role="status" aria-live="polite" className="text-[12.5px] text-ink/62">
        {copied === "copied"
          ? "Copied."
          : copied === "failed"
            ? "Copy failed. Select the link and copy it by hand."
            : null}
      </span>
    </div>
  );
}
