import type { Integration, IntegrationState } from "@/lib/settings/config";
import { cx } from "@/lib/cx";

/**
 * Each integration gets a 2px rule in its own state colour, running the height
 * of its block. The device is already the workspace's: the nav marks the active
 * destination with a 2px accent rule, and `ActionFeedback` marks a result with a
 * 2px border on the left. Using it a third time for "how is this thing doing"
 * means the reader has learned it once.
 *
 * No icons, no badges. The state is carried by the rule and stated in the
 * headline sentence, and a green tick beside "Answering — local Docker stack"
 * would be the same fact three times.
 *
 * The tones follow `status-pill.tsx`: bronze is the settled state, gold means
 * someone has to do something, muted means a capability that is simply switched
 * off. Manual e-sign and unconfigured mail are muted rather than gold on
 * purpose — neither is broken, and colouring them as work would train the owner
 * to ignore the colour that does mean work.
 */
const RULE: Record<IntegrationState, string> = {
  ready: "bg-bronze-400/45",
  attention: "bg-accent",
  absent: "bg-ink/14",
};

const HEADLINE: Record<IntegrationState, string> = {
  ready: "text-ink/85",
  attention: "text-accent-300",
  absent: "text-ink/62",
};

export function IntegrationList({ integrations }: { integrations: Integration[] }) {
  return (
    <ul className="divide-y divide-ink/8">
      {integrations.map((integration) => (
        <li
          key={integration.key}
          className="flex gap-[clamp(12px,1.4vw,16px)] px-[clamp(14px,1.6vw,20px)] py-[15px]"
        >
          <span
            aria-hidden="true"
            className={cx("w-[2px] flex-none rounded-full", RULE[integration.state])}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-[14px] font-medium leading-[1.3] tracking-[-0.01em]">
                {integration.name}
              </h3>
              <p
                className={cx(
                  "text-[13px] leading-[1.45]",
                  HEADLINE[integration.state],
                )}
              >
                {integration.headline}
              </p>
            </div>

            <p className="mt-[6px] max-w-[84ch] text-[12.5px] leading-[1.65] text-ink/55">
              {integration.detail}
            </p>

            {integration.facts.length > 0 ? (
              <dl className="mt-[10px] flex flex-wrap gap-x-7 gap-y-[6px]">
                {integration.facts.map((fact) => (
                  <div key={fact.label} className="flex items-baseline gap-x-2">
                    <dt className="text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/38">
                      {fact.label}
                    </dt>
                    <dd
                      className={cx(
                        "text-[12.5px] leading-[1.45] tabular-nums",
                        fact.quiet ? "text-ink/30 italic" : "text-ink/78",
                      )}
                    >
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
