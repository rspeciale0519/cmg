/**
 * The two ends of a date of loss, in a module that imports no zod.
 *
 * They live here rather than in `./shared` for the reason `./intake-options`
 * exists: the forms that render a date picker are client components, and
 * importing them from a module that pulls in zod ships the whole validator to
 * the browser. `shared.ts` imports these back, so there is still one definition
 * — the schema and the two `<input type="date">` bounds cannot drift apart.
 */

export const EARLIEST_LOSS_DATE = "1990-01-01";

/**
 * Today in Florida, not today in UTC.
 *
 * This bound was `new Date().toISOString().slice(0, 10)`, which between 8pm and
 * midnight Eastern is already tomorrow's date — so for four hours every evening
 * the public form accepted a date of loss one day in the future, and the storm a
 * homeowner is filing about had not happened yet. It was the one date comparison
 * in the codebase not routed through the business zone; everything that renders
 * or filters a timestamp goes through `America/New_York` already (`format.ts`,
 * `audit-range.ts`).
 *
 * `en-CA` because it formats as `YYYY-MM-DD`, which is both the shape the schema
 * compares against and the shape `<input type="date">` wants for `min`/`max`.
 *
 * Called rather than computed once at module load: a server that has been up
 * since yesterday would otherwise keep serving yesterday's ceiling, and refuse a
 * loss that happened this morning.
 */
export function businessToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
