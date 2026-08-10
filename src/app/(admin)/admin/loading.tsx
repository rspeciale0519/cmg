import { Panel } from "@/components/admin/admin-shell";

/**
 * What the workspace shows while a route is being built on the server.
 *
 * Every page under `/admin` is `force-dynamic` and most of them run three or
 * four queries, so a client-side navigation used to leave the *previous* page
 * on screen, untouched and fully interactive, for as long as that took — warm,
 * in development, between 0.9s and 7.8s depending on the route. There was no
 * spinner, no dimming and no pending state on the item the reader had just
 * clicked, so the only available reading was that the click had not landed.
 * Production is faster, but no duration is short enough to justify saying
 * nothing at all.
 *
 * It is a skeleton of this workspace rather than a spinner because every one of
 * these routes is the same two shapes — a page header, then panels of rows — so
 * the placeholder can say *which* screen is arriving, and the real content
 * lands in the boxes the eye is already resting on.
 *
 * `aria-busy` with a single polite label, not one per bar: a screen reader
 * announcing forty pulsing rectangles is worse than announcing nothing. The
 * pulse is a Tailwind animation and the reduced-motion block in `globals.css`
 * already neutralises it, leaving the layout intact and still.
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading</span>

      <div className="pb-[clamp(18px,2vw,26px)]">
        <Bar className="h-[11px] w-[104px]" />
        <Bar className="mt-[13px] h-[26px] w-[232px]" />
        <Bar className="mt-[13px] h-[14px] w-full max-w-[46ch]" />
      </div>

      <Panel>
        <div className="border-b border-ink/10 px-[clamp(14px,1.6vw,20px)] py-[13px]">
          <Bar className="h-[11px] w-[140px]" />
        </div>
        <div className="divide-y divide-ink/8">
          {ROW_WIDTHS.map((width, index) => (
            <div
              key={index}
              className="flex items-center gap-[clamp(10px,1.1vw,14px)] px-[clamp(14px,1.6vw,20px)] py-[15px]"
            >
              <Bar className="h-[13px] w-[92px] shrink-0" />
              <Bar className="h-[13px]" style={{ width }} />
              <Bar className="ml-auto h-[13px] w-[64px] shrink-0" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/**
 * Uneven on purpose. A column of identical bars reads as a graphic; rows of
 * different lengths read as text that has not arrived yet, which is the true
 * statement.
 */
const ROW_WIDTHS = ["42%", "31%", "48%", "36%", "44%", "29%", "39%", "34%"] as const;

function Bar({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`block rounded-[3px] bg-ink/8 ${className ?? ""}`}
    />
  );
}
