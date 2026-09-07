export default function PartnerLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto min-h-dvh max-w-[1360px] px-[clamp(20px,4vw,56px)] py-16">
      <span className="sr-only">Loading partner portal</span>
      <div aria-hidden="true" className="h-10 w-64 animate-pulse bg-ink/8" />
      <div aria-hidden="true" className="mt-5 h-4 w-full max-w-xl animate-pulse bg-ink/8" />
      <div aria-hidden="true" className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="h-56 animate-pulse border border-ink/10 bg-surface/38" />
        <div className="h-56 animate-pulse border border-ink/10 bg-surface/38" />
      </div>
    </div>
  );
}
