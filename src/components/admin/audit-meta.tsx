import { isClaimStatus, STATUS_LABEL } from "@/lib/claims/status";
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

/**
 * `min-w-0 [overflow-wrap:anywhere]` because audit values are not prose and a
 * few of them are single unbreakable tokens. Every issued invitation writes a
 * 64-character SHA-256 hash into `meta.token_hash`, which is one "word" 512.4px
 * wide — wider than a 390px phone on its own. As a flex item with the default
 * `min-width: auto` it refused to shrink below that, so at 390px
 * documentElement.scrollWidth read 543 and the tail of the hash sat 153px off
 * the right edge with no way to reach it. This is production data shape rather
 * than a pathological case: it happens on every invite.
 *
 * `anywhere` and not `break-word`: `break-word` still reserves the intrinsic
 * min-content width when the box is sized, so the row would keep its 512px
 * minimum even while wrapping. `anywhere` counts the break opportunities toward
 * min-content, which is what lets the row actually narrow to its container.
 */
function Value({ value }: { value: Json | undefined }) {
  const { text, muted } = describe(value);
  return (
    <span
      className={cx(
        "min-w-0 [overflow-wrap:anywhere]",
        muted ? "text-ink/30 italic" : "text-ink/80",
      )}
    >
      {text}
    </span>
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

/**
 * A status enum as the workspace writes it. `settlement_offered` is a database
 * word and `Settlement offered` is the one on every pill in the product; an
 * audit trail that spells the same fact a third way is a trail the reader has to
 * translate before they can compare it to the screen it came from.
 */
function StatusValue({ value }: { value: Json | undefined }) {
  if (typeof value === "string" && isClaimStatus(value)) {
    return <span className="min-w-0 text-ink/80">{STATUS_LABEL[value]}</span>;
  }
  return <Value value={value} />;
}

/**
 * The move a status-history entry records, on the collapsed row.
 *
 * These two fields arrive inside `meta.row` — `public.audit_row_change()` puts
 * the whole inserted row there — so they were behind the "Row as written"
 * disclosure with the other five columns, and the visible row said only that
 * *a* status had advanced on *a* claim. Nine consecutive transitions on one
 * claim therefore rendered as nine byte-identical strings: the longest run of
 * indistinguishable rows measured 9 and spanned 837px, on the page whose lede
 * promises "what it was before, and what it became".
 *
 * They are lifted out rather than duplicated. Leaving them in the disclosure too
 * would put the same pair on the screen twice and make the row count wrong about
 * what is hidden behind it.
 *
 * `from_status` is nullable — the opening entry of a claim has no previous
 * status — and renders through `Value`'s "not set", which is the same word the
 * `old` half of every `ChangeRow` uses for the same absence.
 */
function StatusTransition({ from, to }: { from: Json | undefined; to: Json | undefined }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-[2px]">
      <StatusValue value={from} />
      <span aria-hidden="true" className="text-accent/60">
        →
      </span>
      <span className="sr-only">changed to</span>
      <StatusValue value={to} />
    </p>
  );
}

/** The claim reference, set like every other one in the workspace. */
function ClaimRefValue({ value }: { value: string }) {
  return (
    <span className="min-w-0 whitespace-nowrap tabular-nums tracking-[0.01em] text-ink/80">
      {value}
    </span>
  );
}

export function AuditMeta({
  meta,
  claimRef,
}: {
  meta: Json;
  /** `meta.claim_id` resolved by `loadAuditPage`, when it named a live claim. */
  claimRef?: string | null;
}) {
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

  const statusRow = isJsonObject(row) && ("from_status" in row || "to_status" in row)
    ? row
    : null;

  /**
   * The claim this entry is about, when the entry *is* the claim.
   *
   * `claims.insert` writes no `meta.claim_id` — the row it inserted is the
   * claim, so the trigger has nothing to point at — and the reference sat
   * inside `meta.row` behind the "Row as written" disclosure with the other
   * twenty-odd columns. On the seed that made two of thirty-one claim-scoped
   * entries the only ones whose collapsed row did not name a claim, and they
   * were the two that open every claim's history: "Claim created", with no
   * indication of which one.
   *
   * Lifted rather than duplicated, exactly as `StatusTransition` is, so the
   * disclosure's own count stays right about what is hidden behind it.
   */
  const insertedClaimRef =
    isJsonObject(row) && typeof row.claim_ref === "string" && !("claim_id" in rest)
      ? row.claim_ref
      : null;

  const rowFields = isJsonObject(row)
    ? Object.entries(row).filter(
        ([key]) =>
          (!statusRow || (key !== "from_status" && key !== "to_status")) &&
          !(insertedClaimRef && key === "claim_ref"),
      )
    : [];

  const others = Object.entries(rest)
    .filter(([, value]) => value !== undefined)
    .sort(byReadingOrder);

  if (
    changedFields.length === 0 &&
    rowFields.length === 0 &&
    others.length === 0 &&
    !statusRow &&
    !insertedClaimRef
  ) {
    return null;
  }

  return (
    <div className="mt-[7px] text-[12.5px] leading-[1.6]">
      {statusRow ? (
        <StatusTransition from={statusRow.from_status} to={statusRow.to_status} />
      ) : null}

      {insertedClaimRef ? (
        <p className={cx("flex flex-wrap items-baseline gap-x-2", statusRow && "mt-[5px]")}>
          <span className="text-ink/42">Claim</span>
          <ClaimRefValue value={insertedClaimRef} />
        </p>
      ) : null}

      {changedFields.length > 0 ? (
        <ul className={cx("grid gap-[3px]", statusRow && "mt-[5px]")}>
          {changedFields.map(([field, change]) => (
            <ChangeRow key={field} field={field} change={change} />
          ))}
        </ul>
      ) : null}

      {others.length > 0 ? (
        <ul
          className={cx(
            "flex flex-wrap gap-x-5 gap-y-[3px]",
            (changedFields.length > 0 || statusRow) && "mt-[5px]",
          )}
        >
          {/* `flex-wrap` here as on its two sibling lists. This was the one that
              did not have it, and it is the list that holds `token_hash` — so
              the label and a 64-character hash were pinned to a single line
              that could not wrap and could not shrink. */}
          {others.map(([key, value]) => {
            /* A claim is `CMG-2026-0002` on every other screen in the workspace
               and was a 36-character uuid here, which is not the same fact in a
               different notation — it is a fact the reader cannot match to
               anything they have seen. The uuid stays when the resolver missed,
               because `audit_log` keeps no foreign key into `claims` and an
               entry about a deleted claim is still an entry about that claim. */
            const resolved = key === "claim_id" && claimRef;
            return (
              <li key={key} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="text-ink/42">{resolved ? "Claim" : labelKey(key)}</span>
                {resolved ? <ClaimRefValue value={claimRef} /> : <Value value={value} />}
              </li>
            );
          })}
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
