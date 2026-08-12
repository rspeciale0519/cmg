/**
 * Display formatting for the workspace. Pure, so it is unit-testable and safe
 * on both sides of the server/client boundary.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * What the workspace prints where a partner referral has no policy side yet.
 *
 * Not "—", which every other absent value in these tables uses. The dash means
 * "there is nothing to show"; this means "nobody has been asked yet", and the
 * operator's next move is different in the two cases — one is a claim to work,
 * the other is a phone call to make. One string, because the intake card and the
 * claim overview print it side by side in the same session.
 */
export const NOT_SUPPLIED = "Not supplied — taken on accept";

/**
 * A Postgres `date` is a calendar day with no time and no zone, and it must not
 * acquire one on the way to the page. `new Date("2026-03-14")` is parsed as
 * midnight *UTC*, so rendering it through any local-time formatter prints
 * 13 March for every reader west of Greenwich — which is everyone at CMG, in
 * Orlando, at UTC-4. A date of loss that moves by a day is not a cosmetic bug:
 * it is the field a carrier uses to test a claim against a policy period.
 *
 * So the string is split, never parsed.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "—";

  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return "—";

  return `${monthName} ${Number(day)}, ${year}`;
}

/** `14:30:00` → `2:30 PM`. Same rule: a `time` column carries no zone. */
export function formatTimeOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return "—";

  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;

  return `${display}:${minute} ${suffix}`;
}

/**
 * A `timestamptz` genuinely is an instant, so this one converts. Fixed to the
 * business's own zone rather than the reader's: two staff members discussing a
 * claim must be looking at the same clock, and one of them travelling should
 * not change what the file says happened when.
 */
const BUSINESS_TIME_ZONE = "America/New_York";

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDateStamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * "3 days ago" for a queue, where the useful fact is staleness rather than the
 * calendar date. Falls back to the date past a fortnight, because "47 days ago"
 * is arithmetic the reader has to undo.
 */
export function formatRelative(
  value: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days <= 14) return `${days}d ago`;

  return formatDateStamp(value);
}

/**
 * Round to the precision this function is going to display at, before deciding
 * whether there is anything after the point worth showing.
 *
 * The two questions were being asked of different numbers. "Has this got cents?"
 * was asked of the raw value, and "how do I write it?" was answered at two
 * decimal places — so a value that is not an integer but rounds to one came out
 * with `.00` attached. The financials panel derives its figures in floating
 * point (`amount − amount × fee ÷ 100`), which produces exactly that: a
 * settlement of 9,999,999,999.99 at 10% left the homeowner 8,999,999,999.991,
 * which is not an integer, so it printed `$9,000,000,000.00` beside the same
 * quantity written `$9,000,000,000` elsewhere on the screen. Two spellings of
 * one number is the kind of thing a person re-reads three times before deciding
 * which one to trust.
 */
function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Whole dollars. Settlements are five and six figures and the cents are noise
 * at a glance — but a figure that is not round keeps them, because rounding a
 * settlement in the UI is how two systems come to disagree about what was paid.
 */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw)) return "—";

  const amount = roundToCents(raw);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** The same rule as `formatMoney`, for the same reason. */
export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw)) return "—";

  const amount = roundToCents(raw);

  return `${Number.isInteger(amount) ? amount : amount.toFixed(2)}%`;
}

export type AddressParts = {
  street: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
};

/** One line, for a table cell. */
export function formatAddressLine(parts: AddressParts): string {
  const street = [parts.street, parts.street2].filter(Boolean).join(", ");
  return `${street}, ${parts.city}, ${parts.state} ${parts.zip}`;
}

const ENUM_OVERRIDES: Record<string, string> = {
  wind_hail: "Wind & hail",
  fire_smoke: "Fire & smoke",
  lt_1_year: "Under 1 year",
  one_to_two_years: "1–2 years",
  three_plus_years: "3+ years",
  paid_nothing: "Paid nothing",
  paid_no_repairs: "Paid, no repairs made",
  paid_repaired: "Paid and repaired",
  unsure: "Unsure",
};

/** `wind_hail` → `Wind & hail`; anything unlisted → sentence case. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return "—";
  const override = ENUM_OVERRIDES[value];
  if (override) return override;

  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Initials for an avatar-free identity chip. */
export function initialsFor(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
