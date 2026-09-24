import type { PartnerOption } from "@/lib/claims/queries";

export type PartnerChoice = "none" | "existing" | "new";

/**
 * The accept form's pre-selection, from the intake's own referral facts.
 *
 * In order of strength:
 *
 *   1. A `/partner/refer` submission already carries `partner_company_id`. That
 *      is attribution, not a hint — the company's reps see the claim on their
 *      portal from the moment it is submitted — so "Existing" with that company
 *      is the default. Defaulting to "Create" here minted a duplicate company
 *      named from `referrer_name` ("Company — Rep") and moved the claim to it,
 *      and the referring firm lost the claim from its portal.
 *   2. A vendor-link intake names a known company through
 *      `intake_referral_partner_id`, so "Existing" with that company.
 *   3. A submission that only typed a referrer defaults to "Create".
 *
 * When the portal company is no longer active it cannot be chosen under
 * "Existing", and the default is "None" rather than "Create": replacing the
 * portal attribution needs an explicit confirmation either way, and "None"
 * does not also offer to mint a duplicate company.
 *
 * The operator still confirms. The default saves a click; it does not decide
 * the attribution.
 */
export function acceptPartnerDefaults({
  partners,
  referrerName,
  intakeReferralPartnerId,
  portalPartnerId,
  canLinkPartner,
}: {
  partners: PartnerOption[];
  referrerName: string | null;
  intakeReferralPartnerId: string | null;
  portalPartnerId: string | null;
  canLinkPartner: boolean;
}): { choice: PartnerChoice; partnerCompanyId: string | null } {
  const isActive = (id: string | null): id is string =>
    id !== null && partners.some((partner) => partner.id === id);

  if (!canLinkPartner) return { choice: "none", partnerCompanyId: null };
  if (isActive(portalPartnerId)) {
    return { choice: "existing", partnerCompanyId: portalPartnerId };
  }
  if (portalPartnerId !== null) return { choice: "none", partnerCompanyId: null };
  if (isActive(intakeReferralPartnerId)) {
    return { choice: "existing", partnerCompanyId: intakeReferralPartnerId };
  }
  return { choice: referrerName ? "new" : "none", partnerCompanyId: null };
}
