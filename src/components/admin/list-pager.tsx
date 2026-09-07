import Link from "next/link";
import { cx } from "@/lib/cx";

/**
 * Says how much of the list is on screen before it offers to move.
 *
 * The screen this replaced on two surfaces showed a fixed number of rows under
 * a header that counted every record in the business, with nothing in between
 * to say the two numbers were different — so past the cap the page quietly
 * stopped being a list of the thing it named and never mentioned it. The
 * sentence is therefore the point and the buttons are the accessory: a reader
 * who never pages still learns that there is more.
 *
 * Shared by every paged list in the workspace rather than written once each.
 * Two copies of "showing N of M" is how one of them ends up saying something
 * the other does not — which is the class of defect this component exists to
 * fix.
 *
 * `placement` is the one thing that varies. A page-level list (`/admin/claims`,
 * `/admin/leads`) puts its pager below the panel, where the gap above it is the
 * separation; a panel that *contains* its list (a claim tab, a partner's reps)
 * puts it inside, where the panel's own rule and padding are.
 */
export function ListPager({
  shown,
  total,
  noun,
  pluralNoun,
  qualifier,
  label,
  prevHref,
  nextHref,
  startHref,
  placement = "below",
}: {
  shown: number;
  total: number;
  /** What one row is, for the complete-list sentence. */
  noun: string;
  pluralNoun: string;
  /** How the list is ordered, when the reader chose it. Appended as ", by …". */
  qualifier?: string;
  /** `aria-label` on the nav, e.g. "Claims pages". */
  label: string;
  prevHref: string | null;
  nextHref: string | null;
  startHref: string | null;
  /** "below" sits under a panel; "footer" is the last band inside one. */
  placement?: "below" | "footer";
}) {
  const complete = shown >= total && !prevHref && !nextHref;
  const by = qualifier ? `, by ${qualifier}` : "";

  return (
    <nav
      aria-label={label}
      className={cx(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3",
        placement === "footer"
          ? "border-t border-ink/10 px-[clamp(14px,1.6vw,20px)] py-[11px]"
          : "pt-[clamp(14px,1.6vw,20px)]",
      )}
    >
      <p className="text-[12px] leading-[1.5] text-ink/55">
        {complete ? (
          <>
            All <span className="tabular-nums">{total}</span>{" "}
            {total === 1 ? noun : pluralNoun}
            {by}
          </>
        ) : (
          <>
            Showing <span className="tabular-nums">{shown}</span> of{" "}
            <span className="tabular-nums">{total}</span>
            {by}
            {startHref ? (
              <>
                {" · "}
                <Link
                  href={startHref}
                  className="text-accent no-underline transition-colors duration-150 hover:text-accent-300"
                >
                  Back to the start
                </Link>
              </>
            ) : null}
          </>
        )}
      </p>

      {prevHref || nextHref ? (
        <span className="flex items-center gap-2">
          <PagerLink href={prevHref}>← Previous</PagerLink>
          <PagerLink href={nextHref}>Next →</PagerLink>
        </span>
      ) : null}
    </nav>
  );
}

/**
 * What a panel header says about its list, and the counterpart to the sentence
 * above: a complete list states its size, a windowed one states both numbers so
 * the reader can see that the second is larger. It never prints the row count
 * alone, which is exactly what twelve panels used to do over a capped query —
 * a number that was both wrong and frozen past the cap.
 */
export function listMeta(shown: number, total: number, noun: string, pluralNoun: string): string {
  const word = total === 1 ? noun : pluralNoun;
  return shown >= total ? `${total} ${word}` : `${shown} of ${total} ${word}`;
}

function PagerLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return (
      <span aria-hidden="true" className="px-3 text-[12.5px] leading-[1.4] text-ink/20">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cx(
        "min-h-[34px] rounded-md border border-ink/16 px-3 py-[7px] text-[12.5px] leading-[1.4] text-ink/78 no-underline",
        "transition-colors duration-150 hover:border-ink/32 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
