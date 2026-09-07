/* The Services, Contractors and About prototypes paint a warm radial wash on
   `body`, anchored to the top of the document rather than the viewport. An
   absolutely positioned element with no positioned ancestor resolves against
   the initial containing block, which puts it at the document origin — behind
   the translucent header, scrolling away with the page, exactly as the body
   background does. */
export function PageGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] [background:radial-gradient(1200px_720px_at_82%_-160px,color-mix(in_srgb,var(--color-accent-900)_70%,transparent),transparent_60%)]"
    />
  );
}
