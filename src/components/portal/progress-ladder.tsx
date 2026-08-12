import type { ProgressView } from "@/lib/portal/progress";
import { cx } from "@/lib/cx";
import { formatDateStamp } from "@/lib/format";

/**
 * The one thing this portal is remembered by.
 *
 * A claim is a file that moves through dated stages, so it is drawn as a
 * ledger read downwards rather than as the horizontal five-dot stepper with a
 * filled progress bar that every dashboard reaches for. Two reasons, and both
 * are about honesty rather than taste:
 *
 *   * A percentage would be a lie. "With carrier" is one of five marks and can
 *     last four months while "Representation" lasts two days; a bar at 60%
 *     tells a homeowner they are most of the way there when they may not be.
 *     Position in a sequence is true. A fraction of the journey is not.
 *   * A horizontal stepper has nowhere to put the sentence the person actually
 *     came for. Reading down, exactly one stage opens — theirs — into what is
 *     happening now and what moves next. Everything above it is a quiet line
 *     with a date; everything below is a quiet line without one.
 *
 * The dates are real: the first time the claim reached each stage, from
 * `claim_status_history`. That is the part no generic stepper has and the part a
 * homeowner checks — "when did it actually go to the carrier".
 *
 * Gold is spent here and nowhere else on the overview: the current marker and
 * the rail behind it. Completed stages are ink, upcoming stages are ink at low
 * opacity, and the whole screen therefore has exactly one place the eye lands.
 */

const MARKER_LABEL = {
  done: "Done",
  current: "Where your claim is now",
  upcoming: "Still to come",
} as const;

export function ProgressLadder({ progress }: { progress: ProgressView }) {
  const total = progress.stages.length;

  return (
    <div>
      <p className="text-[11px] uppercase leading-[1.4] tracking-[0.16em] text-accent">
        Step {progress.currentIndex + 1} of {total}
      </p>

      <ol className="mt-[18px]">
        {progress.stages.map((stage, index) => {
          const current = stage.state === "current";
          const done = stage.state === "done";
          const last = index === total - 1;

          return (
            <li key={stage.phase} className="relative flex gap-[16px]">
              {/* The rail. A single 1px column behind the markers, painted gold
                  down to the current stage and ink below it, so the eye reads
                  how far the file has travelled before it reads a single word.
                  Absolutely positioned rather than a border on the marker
                  column, so it can stop at the last marker instead of running
                  past it into the padding. */}
              {!last ? (
                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute left-[6px] top-[18px] w-px",
                    "bottom-[-6px]",
                    done ? "bg-accent/45" : "bg-ink/12",
                  )}
                />
              ) : null}

              <span
                aria-hidden="true"
                className={cx(
                  "relative z-[1] mt-[6px] size-[13px] flex-none rounded-full border",
                  current
                    ? "border-accent bg-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_18%,transparent)]"
                    : done
                      ? "border-accent/55 bg-accent/55"
                      : "border-ink/20 bg-canvas",
                )}
              />

              <div className={cx("min-w-0 flex-1", last ? "pb-0" : "pb-[26px]")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-[2px]">
                  <h3
                    className={cx(
                      "text-[16px] leading-[1.35] tracking-[-0.01em]",
                      current
                        ? "font-medium text-ink"
                        : done
                          ? "font-normal text-ink/78"
                          : "font-normal text-ink/40",
                    )}
                  >
                    {stage.phase}
                    <span className="sr-only"> — {MARKER_LABEL[stage.state]}</span>
                  </h3>

                  {stage.reachedAt ? (
                    <time
                      dateTime={stage.reachedAt}
                      className={cx(
                        "shrink-0 text-[12.5px] leading-[1.45] tabular-nums",
                        current ? "text-accent" : "text-ink/40",
                      )}
                    >
                      {formatDateStamp(stage.reachedAt)}
                    </time>
                  ) : null}
                </div>

                {/* The stage's own one-line description sits under every rung,
                    including the current one — it says what the stage *is*,
                    which the "right now" sentence below deliberately does not
                    repeat. Upcoming rungs are dimmer but not hidden: a homeowner
                    reading ahead to see what is coming is the second thing this
                    component exists for. */}
                <p
                  className={cx(
                    "mt-[5px] max-w-[56ch] text-[13.5px] leading-[1.65]",
                    current ? "text-ink/70" : done ? "text-ink/48" : "text-ink/32",
                  )}
                >
                  {stage.summary}
                </p>

                {current ? (
                  <div
                    className={cx(
                      "mt-[16px] border-l-2 py-[2px] pl-[16px]",
                      progress.awaitingHomeowner ? "border-accent" : "border-accent/40",
                    )}
                  >
                    <p className="text-[11px] uppercase leading-[1.4] tracking-[0.14em] text-ink/40">
                      Right now
                    </p>
                    <p className="mt-[6px] max-w-[54ch] text-[15px] leading-[1.7] text-ink">
                      {progress.now}
                    </p>

                    <p className="mt-[16px] text-[11px] uppercase leading-[1.4] tracking-[0.14em] text-ink/40">
                      {progress.awaitingHomeowner ? "Over to you" : "What happens next"}
                    </p>
                    <p
                      className={cx(
                        "mt-[6px] max-w-[54ch] text-[15px] leading-[1.7]",
                        progress.awaitingHomeowner ? "text-accent" : "text-ink/72",
                      )}
                    >
                      {progress.next}
                    </p>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
