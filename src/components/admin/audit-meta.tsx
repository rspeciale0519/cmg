import { cx } from "@/lib/cx";
import type { Json } from "@/types/database";

/**
 * `audit_log.meta` is jsonb with no schema, and it arrives in three shapes:
 *
 *   * from `public.audit_row_change()` on an UPDATE —
 *     `{ op, changed: { column: { old, new } }, claim_id? }`
 *   * from the same trigger on an INSERT or DELETE — `{ op, row: {…}, claim_id? }`
 *   * from an application write — a flat object of whatever that action knew.
 *
 * The first is the common case and the one worth designing for: an audit trail
 * whose UPDATE entries say only "a claim changed" is a list of timestamps. Read
 * as `field: old → new` it becomes the record of what actually happened, which
 * is the entire reason §7.7 exists.
 *
 * Nothing here is a `<pre>` of JSON. A raw dump is the honest-looking option
 * that is actually the lazy one — it puts punctuation the reader has to parse in
 * front of four facts they could have read directly.
 */

type JsonObject = { [key: string]: Json | undefined };

function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `partner_company_id` → `Partner company id`. */
function labelKey(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * jsonb does not preserve insertion order — Postgres stores object keys sorted
 * by length and then bytewise, so `{from, to, self}` comes back as `to, from,
 * self` and a staff role change reads "To assistant · From adjuster". The facts
 * are right and the sentence is backwards.
 *
 * These are the keys where order carries meaning, listed in reading order.
 * Anything unlisted keeps the order Postgres gave it, after these.
 */
const KEY_ORDER = [
  "name",
  "email",
  "role",
  "from",
  "to",
  "status",
  "claim_ref",
  "claim_id",
  "partner_company_id",
  "self",
];

function byReadingOrder(a: [string, unknown], b: [string, unknown]): number {
  const rankA = KEY_ORDER.indexOf(a[0]);
  const rankB = KEY_ORDER.indexOf(b[0]);
  if (rankA === -1 && rankB === -1) return 0;
  if (rankA === -1) return 1;
  if (rankB === -1) return -1;
  return rankA - rankB;
}

const MAX_VALUE_CHARS = 120;

function describe(value: Json | undefined): { text: string; muted: boolean } {
  if (value === null || value === undefined) return { text: "not set", muted: true };
  if (typeof value === "boolean") return { text: value ? "Yes" : "No", muted: false };
  if (typeof value === "number") return { text: String(value), muted: false };

  if (typeof value === "string") {
    if (value.length === 0) return { text: "empty", muted: true };
    return {
      text:
        value.length > MAX_VALUE_CHARS
          ? `${value.slice(0, MAX_VALUE_CHARS)}…`
          : value,
      muted: false,
    };
  }

  const serialised = JSON.stringify(value);
  return {
    text:
      serialised.length > MAX_VALUE_CHARS
        ? `${serialised.slice(0, MAX_VALUE_CHARS)}…`
        : serialised,
    muted: false,
  };
}

function Value({ value }: { value: Json | undefined }) {
  const { text, muted } = describe(value);
  return (
    <span className={muted ? "text-ink/30 italic" : "text-ink/80"}>{text}</span>
  );
}

/**
 * `old → new` on one line. The arrow is a real glyph rather than a `->` because
 * the pair is scanned, not read, and at 12px the two characters of an ASCII
 * arrow read as part of the value beside them.
 */
function ChangeRow({ field, change }: { field: string; change: Json | undefined }) {
  const pair = isJsonObject(change) ? change : null;

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-[2px]">
      <span className="text-ink/42">{labelKey(field)}</span>
      {pair ? (
        <>
          <Value value={pair.old} />
          <span aria-hidden="true" className="text-accent/60">
            →
          </span>
          <span className="sr-only">changed to</span>
          <Value value={pair.new} />
        </>
      ) : (
        <Value value={change} />
      )}
    </li>
  );
}

export function AuditMeta({ meta }: { meta: Json }) {
  if (!isJsonObject(meta)) {
    if (meta === null) return null;
    return (
      <p className="mt-[6px] text-[12.5px] leading-[1.55]">
        <Value value={meta} />
      </p>
    );
  }

  const { op, changed, row, ...rest } = meta;
  const changedFields = isJsonObject(changed) ? Object.entries(changed) : [];
  const rowFields = isJsonObject(row) ? Object.entries(row) : [];
  const others = Object.entries(rest)
    .filter(([, value]) => value !== undefined)
    .sort(byReadingOrder);

  if (changedFields.length === 0 && rowFields.length === 0 && others.length === 0) {
    return null;
  }

  return (
    <div className="mt-[7px] text-[12.5px] leading-[1.6]">
      {changedFields.length > 0 ? (
        <ul className="grid gap-[3px]">
          {changedFields.map(([field, change]) => (
            <ChangeRow key={field} field={field} change={change} />
          ))}
        </ul>
      ) : null}

      {others.length > 0 ? (
        <ul
          className={cx(
            "flex flex-wrap gap-x-5 gap-y-[3px]",
            changedFields.length > 0 && "mt-[5px]",
          )}
        >
          {others.map(([key, value]) => (
            <li key={key} className="flex items-baseline gap-x-2">
              <span className="text-ink/42">{labelKey(key)}</span>
              <Value value={value} />
            </li>
          ))}
        </ul>
      ) : null}

      {/* A whole row is twenty-odd fields and belongs behind a disclosure: on an
          INSERT it is the only thing in the entry, and left open it would push
          every other entry off the screen. */}
      {rowFields.length > 0 ? (
        <details className="group mt-[5px]">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-ink/42 transition-colors duration-150 hover:text-ink/70 [&::-webkit-details-marker]:hidden">
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-[11px] transition-[rotate] duration-200 group-open:rotate-90"
            >
              <path
                d="M6 3l5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="square"
              />
            </svg>
            {op === "DELETE" ? "Row as deleted" : "Row as written"}
            <span className="tabular-nums text-ink/28">{rowFields.length}</span>
          </summary>
          <ul className="mt-[5px] grid gap-[3px] border-l border-ink/10 pl-[11px]">
            {rowFields.map(([key, value]) => (
              <li key={key} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-ink/42">{labelKey(key)}</span>
                <Value value={value} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
