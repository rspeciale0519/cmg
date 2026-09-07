"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { STATUS_LABEL } from "@/lib/claims/status";
import type { AdjusterOption, PartnerOption } from "@/lib/claims/queries";
import {
  hasActiveFilters,
  parseClaimFilters,
  sanitiseSearch,
  STATUS_FILTER_OPTIONS,
} from "@/lib/claims/search";
import { cx } from "@/lib/cx";
import { AdminSelect } from "./form-controls";

/**
 * Filters live in the URL, not in component state. A filtered claims list is
 * something an adjuster sends to a colleague ("the three denied ones") and
 * comes back to after opening a file, and both of those need the view to be a
 * link. It also means the server component does the filtering, so there is no
 * second copy of the predicate on the client.
 *
 * The text box is debounced and the selects are not: a select is one deliberate
 * choice and should act immediately, while typing produces a keystroke of
 * intent every 80ms and navigating on each one would fight the caret.
 */
export function ClaimFilters({
  adjusters,
  partners,
  resultCount,
  showAdjusterFilter = true,
}: {
  adjusters: AdjusterOption[];
  partners: PartnerOption[];
  resultCount: number;
  /**
   * Off for an adjuster, whose every option here is inert. `claims_select`
   * scopes them to `assigned_adjuster_id = auth.uid()`, so "Dana Reyes" is
   * always the same set as "Anyone" and "Unassigned" can never match anything —
   * measured: `/admin/claims` reads 2 total, `?adjuster=unassigned` reads 0 and
   * "Nothing matches those filters". `nav.ts` states the rule: a control that is
   * never usable is not information.
   */
  showAdjusterFilter?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [term, setTerm] = useState(params.get("q") ?? "");

  function withParam(key: string, value: string): string {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // A page cursor is a position in one particular result set. Narrowing the
    // filters produces a different one, and carrying the cursor across would
    // open somewhere in the middle of a list the reader has not seen the start
    // of — or, more often, on nothing at all. The sort is kept: that is a
    // preference about how to read, not a place in the reading.
    next.delete("next");
    next.delete("prev");
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  // Debounced push for the text box. `replace` rather than `push` so a search
  // does not stack twenty history entries between the list and the file the
  // adjuster opens from it.
  useEffect(() => {
    // Idempotent rather than "skip the first run". A mount-counting ref is
    // wrong twice over: StrictMode mounts, unmounts and remounts in
    // development, so the second mount saw a spent ref and replaced the URL
    // with the unfiltered path — a deep link to page 2 silently returned
    // page 1. And any future remount would do the same in production. The
    // effect now asks whether the URL already says what the box says, which
    // is true on mount, true after its own replace, and false only when the
    // operator has actually typed something new.
    //
    // Compared and pushed through `sanitiseSearch`, so the URL only ever carries
    // a term that the page would actually search on. Pushing the raw text put
    // `?q=%%%` in the address bar for a query that filtered nothing, which is
    // what let the bar below offer to clear a filter that was not applied.
    const searched = sanitiseSearch(term);
    if (searched === (params.get("q") ?? "")) return;

    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(withParam("q", searched), { scroll: false });
      });
    }, 260);

    return () => clearTimeout(timer);
    // `withParam` closes over `params`, which changes on every navigation; the
    // effect must run on the term and on nothing else, or each push schedules
    // the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  // Read through the same validator the page reads through, not off the raw
  // query string. `parseClaimFilters` rejects a status that is not in the enum
  // and a partner that is not a uuid, and `sanitiseSearch` strips the characters
  // Postgres would read as syntax — so `?status=bogus` and a search box holding
  // `%%%` both leave the list unfiltered, while this bar offered to clear them.
  // Every other element on the screen said nothing was filtered; only the bar
  // disagreed, and clicking its Clear changed nothing. `audit-filters.tsx`
  // states the same rule for the same reason.
  const active = hasActiveFilters(
    parseClaimFilters({
      status: params.get("status") ?? undefined,
      adjuster: params.get("adjuster") ?? undefined,
      partner: params.get("partner") ?? undefined,
      q: term,
    }),
  );

  // Clearing the filters clears the filters. The chosen ordering is a way of
  // reading the list rather than a restriction on it, so it survives.
  const cleared = new URLSearchParams();
  if (params.get("sort")) cleared.set("sort", params.get("sort") as string);
  if (params.get("dir")) cleared.set("dir", params.get("dir") as string);
  const clearHref = cleared.toString() ? `${pathname}?${cleared}` : pathname;

  return (
    <div className="flex flex-wrap items-end gap-3 pb-[clamp(14px,1.6vw,20px)]">
      <div className="min-w-[200px] flex-1 sm:max-w-[320px]">
        <label
          htmlFor="claim-search"
          className="mb-[5px] block text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/55"
        >
          Search
        </label>
        <input
          id="claim-search"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Reference, homeowner, address, carrier"
          className={cx(
            "min-h-[34px] w-full rounded-md border border-ink/15 bg-canvas/70 px-[9px] py-[6px] text-[13px] leading-[1.5] text-ink caret-accent",
            "transition-colors duration-150 placeholder:text-ink/32 hover:border-ink/40 focus-visible:border-accent focus-visible:outline-offset-0",
          )}
        />
      </div>

      <div className="min-w-[150px]">
        <label
          htmlFor="admin-status"
          className="mb-[5px] block text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/55"
        >
          Status
        </label>
        <AdminSelect
          name="status"
          value={params.get("status") ?? ""}
          onChange={(event) =>
            startTransition(() =>
              router.replace(withParam("status", event.target.value), { scroll: false }),
            )
          }
        >
          <option value="">Any status</option>
          {STATUS_FILTER_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </AdminSelect>
      </div>

      {showAdjusterFilter ? (
        <div className="min-w-[150px]">
          <label
            htmlFor="admin-adjuster"
            className="mb-[5px] block text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/55"
          >
            Adjuster
          </label>
          <AdminSelect
            name="adjuster"
            value={params.get("adjuster") ?? ""}
            onChange={(event) =>
              startTransition(() =>
                router.replace(withParam("adjuster", event.target.value), {
                  scroll: false,
                }),
              )
            }
          >
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {adjusters.map((adjuster) => (
              <option key={adjuster.id} value={adjuster.id}>
                {adjuster.name}
              </option>
            ))}
          </AdminSelect>
        </div>
      ) : null}

      <div className="min-w-[150px]">
        <label
          htmlFor="admin-partner"
          className="mb-[5px] block text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/55"
        >
          Referred by
        </label>
        <AdminSelect
          name="partner"
          value={params.get("partner") ?? ""}
          onChange={(event) =>
            startTransition(() =>
              router.replace(withParam("partner", event.target.value), { scroll: false }),
            )
          }
        >
          <option value="">Any source</option>
          <option value="none">Direct</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </AdminSelect>
      </div>

      <p
        aria-live="polite"
        className={cx(
          "ml-auto pb-[8px] text-[12px] leading-[1.4] transition-opacity duration-150",
          isPending ? "text-ink/30" : "text-ink/55",
        )}
      >
        <span className="tabular-nums">{resultCount}</span>{" "}
        {resultCount === 1 ? "claim" : "claims"}
        {active ? (
          <>
            {" · "}
            <Link
              href={clearHref}
              className="tap-block text-accent no-underline transition-colors duration-150 hover:text-accent-300"
            >
              Clear
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
