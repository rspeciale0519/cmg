import { z } from "zod";

/** Spec §7.2. Also set as `minimum_password_length` in supabase/config.toml. */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * bcrypt truncates at 72 *bytes*, silently. Without this cap two different
 * passwords that share a 72-byte prefix authenticate each other, and the user
 * is never told which of their typing counted.
 */
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Substrings that make a long password a short one. Not a dictionary — a
 * dictionary belongs in zxcvbn and zxcvbn is a 400 kB dependency for a form
 * three people a month will see. These are the tokens that actually turn up in
 * passwords chosen *for this system*, plus the keyboard runs that a length rule
 * alone invites ("Qwertyuiop123!" clears 12 characters and three classes).
 */
const WEAK_FRAGMENTS = [
  "password",
  "passw0rd",
  "letmein",
  "welcome",
  "qwerty",
  "asdfgh",
  "zxcvbn",
  "iloveyou",
  "admin",
  "adjuster",
  "claim",
  "insurance",
  "property",
  "cmg",
  "florida",
  "orlando",
  "hurricane",
  "12345",
  "abcde",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "trustno1",
];

function hasSequentialRun(value: string): boolean {
  const lower = value.toLowerCase();
  let ascending = 1;
  let descending = 1;

  for (let i = 1; i < lower.length; i += 1) {
    const delta = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
    ascending = delta === 1 ? ascending + 1 : 1;
    descending = delta === -1 ? descending + 1 : 1;
    if (ascending >= 5 || descending >= 5) return true;
  }

  return false;
}

function hasRepeatedRun(value: string): boolean {
  return /(.)\1{3,}/.test(value);
}

/** "Abc123!Abc123!" — long, four classes, and one unit of secret. */
function isShortUnitRepeated(value: string): boolean {
  for (let unit = 1; unit <= value.length / 2; unit += 1) {
    if (value.length % unit !== 0) continue;
    const head = value.slice(0, unit);
    if (head.repeat(value.length / unit) === value) return true;
  }
  return false;
}

export type PasswordProblem =
  | "too_short"
  | "too_long"
  | "missing_lowercase"
  | "missing_uppercase"
  | "missing_digit"
  | "low_variety"
  | "weak_fragment"
  | "sequential"
  | "repeated"
  | "contains_identifier";

const MESSAGES: Record<PasswordProblem, string> = {
  too_short: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  too_long: `Use no more than ${PASSWORD_MAX_LENGTH} characters.`,
  missing_lowercase: "Include at least one lowercase letter.",
  missing_uppercase: "Include at least one uppercase letter.",
  missing_digit: "Include at least one number.",
  low_variety: "Use a wider mix of characters — this repeats too few of them.",
  weak_fragment: "This contains a word attackers guess first. Choose something else.",
  sequential: "Avoid long runs like abcdef or 123456.",
  repeated: "Avoid repeating the same character four or more times.",
  contains_identifier: "Do not build your password out of your own email address.",
};

/**
 * Returns every problem, ordered, so the form can show the first and a strength
 * meter can count the rest. `identifier` is the invitee's email: a password
 * built from the address it was mailed to is not a secret from anyone holding
 * the mailbox.
 */
export function passwordProblems(
  password: string,
  identifier?: string | null,
): PasswordProblem[] {
  const problems: PasswordProblem[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) problems.push("too_short");
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) {
    problems.push("too_long");
  }
  if (!/[a-z]/.test(password)) problems.push("missing_lowercase");
  if (!/[A-Z]/.test(password)) problems.push("missing_uppercase");
  if (!/\d/.test(password)) problems.push("missing_digit");

  if (password.length > 0) {
    const distinct = new Set(password).size;
    if (distinct < 6 || isShortUnitRepeated(password)) problems.push("low_variety");
  }

  const lower = password.toLowerCase();
  if (WEAK_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
    problems.push("weak_fragment");
  }
  if (hasSequentialRun(password)) problems.push("sequential");
  if (hasRepeatedRun(password)) problems.push("repeated");

  const localPart = identifier?.split("@")[0]?.toLowerCase().trim();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
    problems.push("contains_identifier");
  }

  return problems;
}

export function passwordProblemMessage(problem: PasswordProblem): string {
  return MESSAGES[problem];
}

/**
 * 0–4, for the meter only. Never a gate: `passwordProblems()` decides, and a
 * score is a summary of that decision rather than a second opinion on it.
 */
export function passwordScore(password: string, identifier?: string | null): number {
  if (password.length === 0) return 0;
  if (passwordProblems(password, identifier).length > 0) return 1;

  let score = 2;
  if (password.length >= 16) score += 1;
  if (/[^A-Za-z0-9]/.test(password) && new Set(password).size >= 10) score += 1;
  return Math.min(score, 4);
}

export const PASSWORD_SCORE_LABELS = [
  "",
  "Too weak",
  "Acceptable",
  "Strong",
  "Very strong",
] as const;

export function passwordSchema(identifier?: string | null) {
  return z.string().superRefine((value, ctx) => {
    for (const problem of passwordProblems(value, identifier)) {
      ctx.addIssue({ code: "custom", message: passwordProblemMessage(problem) });
    }
  });
}

export function acceptInviteSchema(identifier?: string | null) {
  return z
    .object({
      password: passwordSchema(identifier),
      confirmPassword: z.string(),
      firstName: z.string().trim().min(1, "Tell us your first name.").max(80),
      lastName: z.string().trim().min(1, "Tell us your last name.").max(80),
    })
    .refine((value) => value.password === value.confirmPassword, {
      path: ["confirmPassword"],
      message: "Both passwords must match.",
    });
}
