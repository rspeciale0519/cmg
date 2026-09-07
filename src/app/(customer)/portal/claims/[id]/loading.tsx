/**
 * The claim's content area, held while it loads.
 *
 * This file sits at `claims/[id]/` and NOT at `portal/`, and the placement is
 * load-bearing rather than tidy. Next wraps a segment as
 * `<Layout><Suspense fallback={loading}>{children}</Suspense></Layout>`, so a
 * boundary here opens *after* `claims/[id]/layout.tsx` has awaited
 * `requirePortalClaim()` — which is the call that decides whether this claim is
 * the caller's at all.
 *
 * A `loading.tsx` at `portal/` instead put the boundary *above* that await, and
 * Next flushed the shell with a 200 status line before the claim had been
 * looked up. The `notFound()` that followed could then only be streamed into the
 * body: `/portal/claims/<another homeowner's uuid>` answered
 * `200 OK` with the not-found page inside it. Measured, and measured again after
 * moving this file: 200 before, 404 after, for both a forbidden claim and a
 * nonexistent one.
 *
 * That was not an information leak — a forbidden claim and a missing one
 * answered identically, which is the property §7.9 actually requires — but a
 * 200 on a page that says "we could not find that" is a lie told to every
 * crawler, cache and monitor that reads status lines rather than prose.
 *
 * The visible gain is real too: the claim reference, the address and the tab
 * strip come from the layout and now paint immediately, and only the panels
 * below them are skeletons.
 *
 * `animate-pulse` and nothing else; the reduced-motion block in globals.css
 * neutralises it, leaving the blocks static and still informative.
 */
export default function ClaimLoading() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div aria-hidden="true" className="grid gap-4">
        <div className="animate-pulse border border-ink/10 bg-surface/25 p-[clamp(18px,2.4vw,28px)]">
          <div className="h-[11px] w-[86px] rounded-sm bg-accent/25" />
          <div className="mt-[22px] grid gap-[26px]">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex gap-[16px]">
                <span className="mt-[5px] size-[13px] flex-none rounded-full bg-ink/12" />
                <div className="min-w-0 flex-1">
                  <div className="h-[15px] w-[130px] rounded-sm bg-ink/12" />
                  <div className="mt-[9px] h-[12px] w-[min(320px,80%)] rounded-sm bg-ink/[0.07]" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="h-[190px] animate-pulse border border-ink/10 bg-surface/25" />
      </div>
      <div aria-hidden="true" className="h-[230px] animate-pulse border border-ink/10 bg-surface/25" />
      <span className="sr-only" aria-live="polite">
        Loading your claim
      </span>
    </div>
  );
}
