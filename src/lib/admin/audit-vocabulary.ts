/**
 * What can appear in `audit_log.action` and `audit_log.entity`, for the two
 * filter selects.
 *
 * Declared rather than discovered. `select distinct action from audit_log` is an
 * index-only scan of the whole table to build a dropdown, on the one table in
 * this schema designed to grow without bound and never be pruned — the cost
 * lands on every page load and grows forever. The values are written by code in
 * this repository and by `public.audit_row_change()`, so the list is knowable at
 * build time and a new action is one line in the same commit that adds it.
 *
 * Nothing in the *rendering* path consults this map: an action that is missing
 * here still displays correctly and is still returned by an unfiltered view. The
 * only consequence of it going stale is a filter option nobody can pick, which
 * is a visible, harmless failure rather than a silent wrong answer.
 */
export type AuditEntity = {
  readonly value: string;
  readonly label: string;
  readonly actions: readonly { readonly value: string; readonly label: string }[];
};

export const AUDIT_ENTITIES: readonly AuditEntity[] = [
  {
    value: "auth",
    label: "Sign-in & MFA",
    actions: [
      { value: "auth.sign_in", label: "Signed in" },
      { value: "auth.sign_in_failed", label: "Sign-in failed" },
      { value: "auth.sign_in_refused", label: "Sign-in refused" },
      { value: "auth.sign_out", label: "Signed out" },
      { value: "auth.mfa_enroll_started", label: "Authenticator setup started" },
      { value: "auth.mfa_verified", label: "Authenticator verified" },
      { value: "auth.mfa_verify_failed", label: "Authenticator code rejected" },
    ],
  },
  {
    value: "claims",
    label: "Claims",
    actions: [
      { value: "claims.insert", label: "Claim created" },
      { value: "claims.update", label: "Claim changed" },
      { value: "claims.delete", label: "Claim deleted" },
      { value: "claim.intake_accepted", label: "Intake accepted" },
      { value: "claim.intake_rejected", label: "Intake rejected" },
      { value: "claim.policy_updated", label: "Policy details recorded" },
      { value: "esign.lor_sent", label: "LOR sent for signature" },
      { value: "esign.lor_send_failed", label: "LOR send failed" },
      { value: "esign.lor_signed", label: "LOR signed" },
      { value: "esign.recipient_completed", label: "Signer completed" },
      { value: "esign.state_changed", label: "E-sign state changed" },
      { value: "esign.document_failed", label: "E-sign document failed" },
      { value: "esign.creation_failed", label: "E-sign creation failed" },
      { value: "esign.webhook_handler_failed", label: "E-sign webhook failed" },
    ],
  },
  {
    value: "claimants",
    label: "Claimants",
    actions: [
      { value: "claimants.insert", label: "Claimant added" },
      { value: "claimants.update", label: "Claimant changed" },
      { value: "claimants.delete", label: "Claimant removed" },
    ],
  },
  {
    value: "claim_financials",
    label: "Settlement figures",
    actions: [
      { value: "claim_financials.insert", label: "Figures recorded" },
      { value: "claim_financials.update", label: "Figures changed" },
      { value: "claim_financials.delete", label: "Figures removed" },
    ],
  },
  {
    value: "claim_status_history",
    label: "Status history",
    actions: [{ value: "claim_status_history.insert", label: "Status advanced" }],
  },
  {
    value: "consents",
    label: "Consents",
    actions: [
      { value: "consents.insert", label: "Consent captured" },
      { value: "consents.update", label: "Consent withdrawn or changed" },
    ],
  },
  {
    value: "documents",
    label: "Documents",
    actions: [
      { value: "documents.insert", label: "Document uploaded" },
      { value: "documents.update", label: "Document changed" },
      { value: "documents.delete", label: "Document deleted" },
      { value: "document.signed_url_issued", label: "Download link issued" },
    ],
  },
  {
    value: "invites",
    label: "Invitations",
    actions: [
      { value: "invite.issued", label: "Invitation issued" },
      { value: "invite.accepted", label: "Invitation accepted" },
    ],
  },
  {
    value: "leads",
    label: "Leads",
    actions: [{ value: "leads.status_changed", label: "Lead status changed" }],
  },
  {
    value: "partner_companies",
    label: "Partner companies",
    actions: [
      { value: "partner_company.created", label: "Company added" },
      { value: "partner_company.updated", label: "Company edited" },
      { value: "partner_company.status_changed", label: "Company activated or deactivated" },
      { value: "partner_company.deleted", label: "Company deleted" },
    ],
  },
  {
    value: "profiles",
    label: "Staff accounts",
    actions: [
      { value: "staff.role_changed", label: "Role changed" },
      { value: "staff.deactivated", label: "Account deactivated" },
      { value: "staff.reactivated", label: "Account restored" },
    ],
  },
  {
    value: "pandadoc_webhook",
    label: "E-sign webhooks",
    actions: [
      { value: "esign.webhook_signature_rejected", label: "Webhook signature rejected" },
    ],
  },
] as const;

const ACTION_LABELS = new Map(
  AUDIT_ENTITIES.flatMap((entity) =>
    entity.actions.map((action) => [action.value, action.label] as const),
  ),
);

export function isKnownEntity(value: string): boolean {
  return AUDIT_ENTITIES.some((entity) => entity.value === value);
}

export function isKnownAction(value: string): boolean {
  return ACTION_LABELS.has(value);
}

/**
 * Splits `claims.update` into the subject and the event, so the log can set them
 * differently — the subject repeats down the page and should recede, the event
 * is what the reader is scanning for. An action with no dot keeps its whole
 * self as the event.
 */
export function splitAction(action: string): { family: string; event: string } {
  const dot = action.indexOf(".");
  if (dot === -1) return { family: "", event: action };
  return { family: action.slice(0, dot), event: action.slice(dot + 1) };
}

/** The written label where one exists, otherwise the raw event, de-underscored. */
export function actionLabel(action: string): string {
  const known = ACTION_LABELS.get(action);
  if (known) return known;

  const { event } = splitAction(action);
  const spaced = event.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function entityLabel(entity: string): string {
  return (
    AUDIT_ENTITIES.find((candidate) => candidate.value === entity)?.label ??
    entity.replace(/_/g, " ")
  );
}
