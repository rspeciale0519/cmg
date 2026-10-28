/**
 * Held while the account screen loads. Safe at this depth for the reason
 * `claims/[id]/loading.tsx` sets out at length: nothing above this boundary can
 * answer `notFound()`, so flushing the shell early cannot turn a 404 into a 200.
 * `requireRole("customer")` in the portal layout redirects rather than 404s, and
 * a redirect is decided before any of this renders.
 */
export default function ProfileLoading() {
  return (
    <>
      <div aria-hidden="true">
        <span className="mb-[18px] block h-px w-10 bg-accent/40" />
        <div className="h-[12px] w-[110px] animate-pulse rounded-sm bg-ink/10" />
        <div className="mt-[13px] h-[34px] w-[220px] animate-pulse rounded-sm bg-ink/10" />
        <div className="mt-[13px] h-[14px] w-[min(480px,86%)] animate-pulse rounded-sm bg-ink/[0.07]" />

        <div className="mt-[clamp(24px,3.5vh,36px)] grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="grid gap-4">
            <div className="h-[300px] animate-pulse border border-ink/10 bg-surface/25" />
            <div className="h-[260px] animate-pulse border border-ink/10 bg-surface/25" />
          </div>
          <div className="h-[420px] animate-pulse border border-ink/10 bg-surface/25" />
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        Loading your account
      </span>
    </>
  );
}
