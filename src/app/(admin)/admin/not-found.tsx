import Link from "next/link";
import { PageHeader, Panel, PanelBody } from "@/components/admin/admin-shell";

/**
 * The workspace's own 404, rendered inside `AdminShell` because `not-found.tsx`
 * sits under its segment's layout.
 *
 * Before this existed, `notFound()` from anywhere under `/admin` — a claim id
 * that no longer resolves, a partner an owner deleted from another tab, an
 * owner-only route reached by an adjuster, a mistyped path — fell through to
 * the marketing 404. A staff member mid-shift was handed the public site's
 * header, a "File a claim" button, the 24/7 phone number and a footer, with no
 * link back to the desk they were standing at and copy addressed to a
 * homeowner. The workspace has to answer for its own routes.
 *
 * The copy names the two things that actually produce this — a record that is
 * gone or was never theirs, and a hand-edited URL — because a staff member can
 * act on both, and says nothing about which one it was: `requireRole` and
 * `requireClaimAccess` answer "not yours" and "not there" identically on
 * purpose (spec §7.9), and a message that distinguished them here would undo
 * that.
 */
export default function AdminNotFound() {
  return (
    <>
      <PageHeader
        eyebrow="Not found"
        title="That page isn’t in the workspace."
        lede="Either the record has been removed or reassigned since the link was made, or the address does not name anything here. Nothing has been lost — every claim is still reachable from the list."
      />

      <Panel title="Where to go next">
        <PanelBody>
          <ul className="grid gap-[10px] text-[13px] leading-[1.6]">
            <li>
              <Link
                href="/admin"
                className="text-accent no-underline transition-colors duration-150 hover:text-accent-300"
              >
                Dashboard
              </Link>
              <span className="ml-2 text-ink/50">
                — the queues that need a decision today.
              </span>
            </li>
            <li>
              <Link
                href="/admin/claims"
                className="text-accent no-underline transition-colors duration-150 hover:text-accent-300"
              >
                Claims
              </Link>
              <span className="ml-2 text-ink/50">
                — search by reference, homeowner, address or carrier.
              </span>
            </li>
            <li>
              <Link
                href="/admin/intake"
                className="text-accent no-underline transition-colors duration-150 hover:text-accent-300"
              >
                Intake
              </Link>
              <span className="ml-2 text-ink/50">
                — submissions waiting on triage.
              </span>
            </li>
          </ul>

          <p className="mt-[16px] max-w-[70ch] text-[12.5px] leading-[1.65] text-ink/45">
            If a colleague sent you this link and it should work, ask them to
            re-send it from the file itself — a claim reference typed by hand is
            the usual culprit.
          </p>
        </PanelBody>
      </Panel>
    </>
  );
}
