export const POLICY_REVISION = "2026-11-15";

export type PolicyAvailability = "hidden" | "draft" | "published";

type PolicyEnvironment = {
  nodeEnv?: string;
  vercel?: string;
  vercelEnvironment?: string;
  approvedRevision?: string;
  previewDrafts?: string;
};

/** A preview flag cannot publish an unapproved policy on a hosted deployment. */
export function policyAvailability(environment: PolicyEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  vercel: process.env.VERCEL,
  vercelEnvironment: process.env.VERCEL_ENV,
  approvedRevision: process.env.CMG_PUBLIC_POLICIES_APPROVED,
  previewDrafts: process.env.CMG_POLICY_DRAFTS,
}): PolicyAvailability {
  if (environment.approvedRevision === POLICY_REVISION) return "published";
  if (
    environment.nodeEnv === "development" &&
    environment.previewDrafts === "true" &&
    !environment.vercel &&
    !environment.vercelEnvironment
  ) {
    return "draft";
  }
  return "hidden";
}
