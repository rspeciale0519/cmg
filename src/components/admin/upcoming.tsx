import type { ReactNode } from "react";
import { EmptyState, PageHeader, Panel } from "./admin-shell";

/**
 * A destination that exists in the navigation but not yet in the product.
 *
 * Rendered rather than hidden, and this is the deliberate choice: the four
 * owner surfaces in spec §9 are being built alongside this one, and an owner
 * who has been told the workspace has a Partners screen should find a page
 * that says when — not a 404 that reads as a broken link, and not a nav item
 * that silently disappears between deploys.
 *
 * It says what the screen will do, so the absence is informative rather than
 * merely empty.
 */
export function UpcomingSurface({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} />
      <Panel>
        <EmptyState headline="Not built yet.">{children}</EmptyState>
      </Panel>
    </>
  );
}
