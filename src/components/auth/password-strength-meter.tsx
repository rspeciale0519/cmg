"use client";

import { cx } from "@/lib/cx";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_SCORE_LABELS,
  passwordProblemMessage,
  passwordProblems,
  passwordScore,
} from "@/lib/validators/password";

/**
 * Four segments rather than a bar: a continuous bar invites the reader to aim
 * for "full", and the rule these forms actually enforce is a threshold, not a
 * maximum. The live problem line under it is the same text the server would
 * return, computed from the same function, so the meter never promises
 * something the submit will refuse.
 *
 * Shared by invitation acceptance and password recovery, which enforce one
 * policy and so must describe it the same way.
 */
export function PasswordStrengthMeter({
  password,
  email,
}: {
  password: string;
  email: string;
}) {
  const score = passwordScore(password, email);
  const problems = passwordProblems(password, email);

  return (
    <div className="mt-[10px]">
      <div className="flex gap-[6px]" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cx(
              "h-[3px] flex-1 rounded-full transition-colors duration-200",
              password.length === 0
                ? "bg-ink/13"
                : score >= step
                  ? score <= 1
                    ? "bg-[#E08C6A]"
                    : "bg-accent"
                  : "bg-ink/13",
            )}
          />
        ))}
      </div>
      <p
        aria-live="polite"
        className="mt-[8px] text-[13px] leading-[1.6] text-ink/55"
      >
        {password.length === 0
          ? `At least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter and a number.`
          : problems.length > 0
            ? passwordProblemMessage(problems[0])
            : PASSWORD_SCORE_LABELS[score]}
      </p>
    </div>
  );
}
