import Link from "next/link";
import { cx } from "@/lib/cx";

export type FilterOption = {
  /** Empty string is the unfiltered view and drops the parameter entirely. */
  readonly value: string;
  readonly label: string;
  readonly count?: number;
};

/**
 * A closed set of views, as links. The alternative — a `<select>` — hides the
 * other options behind an interaction and cannot show a count beside each, and
 * these lists have three or four states, not thirty.
 *
 * Links rather than buttons because the filtered view is the thing an owner
 * bookmarks, sends to a colleague, and returns to with Back. The state lives in
 * the URL and the server does the filtering, so there is no second copy of the
 * predicate on the client.
 */
export function FilterPills({
  label,
  basePath,
  param,
  active,
  options,
  extraParams,
}: {
  label: string;
  basePath: string;
  param: string;
  active: string;
  options: readonly FilterOption[];
  /** Filters on other axes that must survive switching this one. */
  extraParams?: Record<string, string | undefined>;
}) {
  function hrefFor(value: string): string {
    const params = new URLSearchParams();
    for (const [key, carried] of Object.entries(extraParams ?? {})) {
      if (carried) params.set(key, carried);
    }
    if (value) params.set(param, value);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <nav
      aria-label={label}
      className="flex flex-wrap gap-1 pb-[clamp(14px,1.6vw,20px)]"
    >
      {options.map((option) => {
        const isActive = active === option.value;

        return (
          <Link
            key={option.value || "all"}
            href={hrefFor(option.value)}
            aria-current={isActive ? "page" : undefined}
            className={cx(
              "flex items-center gap-2 rounded-md border px-[11px] py-[6px] text-[12.5px] leading-[1.4] no-underline transition-colors duration-150",
              isActive
                ? "border-accent/45 bg-accent/12 text-accent"
                : "border-transparent text-ink/55 hover:border-ink/14 hover:text-ink",
            )}
          >
            {option.label}
            {option.count === undefined ? null : (
              <span
                className={cx(
                  "tabular-nums",
                  isActive ? "text-accent" : "text-ink/58",
                )}
              >
                {option.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
