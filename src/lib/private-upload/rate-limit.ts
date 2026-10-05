import "server-only";

import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export type PrivateUploadSurface = "portal" | "staff";

export function checkPrivateUploadPrepareLimit(surface: PrivateUploadSurface, userId: string): Promise<boolean> {
  const rule = surface === "portal" ? RATE_LIMITS.portalUploadUser : RATE_LIMITS.staffUploadPrepareUser;
  return checkRateLimit(rule, userId);
}

/** Keep finalize requests separate from new upload starts and bound one token. */
export async function checkPrivateUploadFinalizeLimit(
  surface: PrivateUploadSurface,
  userId: string,
  tokenHash: string,
): Promise<boolean> {
  const userRule = surface === "portal" ? RATE_LIMITS.portalUploadFinalizeUser : RATE_LIMITS.staffUploadFinalizeUser;
  const tokenRule = surface === "portal" ? RATE_LIMITS.portalUploadFinalizeToken : RATE_LIMITS.staffUploadFinalizeToken;
  if (!(await checkRateLimit(userRule, userId))) return false;
  return checkRateLimit(tokenRule, tokenHash);
}
