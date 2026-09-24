import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The accept form's referring-company default. A `/partner/refer` submission
 * already carries `partner_company_id`, and the form used to ignore it and
 * default to "Create" a company named from `referrer_name` — which, accepted
 * as offered, made a duplicate company and moved the claim off the referring
 * firm's portal. See `intake-accept-attribution.test.ts` for the server side.
 */
vi.mock("@/lib/actions/intake-queue", () => ({
  acceptIntake: vi.fn(async () => ({ status: "success" as const })),
  rejectIntake: vi.fn(async () => ({ status: "success" as const })),
}));

import { IntakeActions } from "./intake-actions";
import { acceptPartnerDefaults } from "./intake-partner-defaults";

afterEach(cleanup);

const SUMMIT = "24000000-0000-4000-a000-0000000000c1";
const GULF = "24000000-0000-4000-a000-0000000000c2";
const partners = [
  { id: GULF, name: "Gulf Coast Roofing" },
  { id: SUMMIT, name: "Summit Exteriors LLC" },
];

type Props = ComponentProps<typeof IntakeActions>;

const base: Props = {
  claimId: "24000000-0000-4000-a000-000000000001",
  claimRef: "CMG-2026-0004",
  adjusters: [{ id: "00000000-0000-4000-a000-000000000002", name: "Avery Adjuster" }],
  partners,
  referrerName: "Summit Exteriors LLC — Riley Tester",
  intakeReferralPartnerId: null,
  portalPartnerId: null,
  needsPolicyDetails: true,
  canAccept: true,
  canLinkPartner: true,
};

function openAccept(props: Partial<Props>) {
  const { container } = render(<IntakeActions {...base} {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Accept" }));
  const hidden = container.querySelector<HTMLInputElement>('input[name="partnerChoice"]');
  const select = container.querySelector<HTMLSelectElement>('select[name="partnerCompanyId"]');
  const confirm = container.querySelector<HTMLInputElement>('input[name="replacePortalReferral"]');
  return { container, hidden, select, confirm };
}

describe("AcceptForm — a partner-portal referral", () => {
  it("defaults to Existing with the referring company selected", () => {
    const { hidden, select, confirm } = openAccept({ portalPartnerId: SUMMIT });

    expect(hidden?.value).toBe("existing");
    expect(screen.getByRole("radio", { name: "Existing" })).toHaveProperty("checked", true);
    expect(select?.value).toBe(SUMMIT);
    expect(confirm).toBeNull();
  });

  it("says the referral came through the partner portal", () => {
    openAccept({ portalPartnerId: SUMMIT });

    expect(
      screen.getByText(/Referred through the partner portal by Summit Exteriors LLC\./),
    ).toBeTruthy();
  });

  it("asks for explicit confirmation before Create or None replaces it", () => {
    const { container } = openAccept({ portalPartnerId: SUMMIT });

    fireEvent.click(screen.getByRole("radio", { name: "Create" }));
    expect(container.querySelector('input[name="replacePortalReferral"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "None" }));
    expect(container.querySelector('input[name="replacePortalReferral"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Existing" }));
    expect(container.querySelector('input[name="replacePortalReferral"]')).toBeNull();
  });

  it("asks for confirmation when a different existing company is picked", () => {
    const { container, select } = openAccept({ portalPartnerId: SUMMIT });

    fireEvent.change(select!, { target: { value: GULF } });
    const confirm = container.querySelector<HTMLInputElement>('input[name="replacePortalReferral"]');
    expect(confirm).not.toBeNull();
    expect(confirm?.checked).toBe(false);
  });
});

describe("AcceptForm — a public intake", () => {
  it("still defaults a typed referrer to Create, with no portal notice", () => {
    const { hidden, confirm } = openAccept({ portalPartnerId: null });

    expect(hidden?.value).toBe("new");
    expect(screen.queryByText(/partner portal/)).toBeNull();
    expect(confirm).toBeNull();
  });

  it("still defaults a vendor-link intake to Existing with that vendor", () => {
    const { hidden, select } = openAccept({ intakeReferralPartnerId: GULF });

    expect(hidden?.value).toBe("existing");
    expect(select?.value).toBe(GULF);
  });
});

describe("acceptPartnerDefaults", () => {
  const args: Parameters<typeof acceptPartnerDefaults>[0] = {
    partners,
    referrerName: "Summit Exteriors LLC — Riley Tester",
    intakeReferralPartnerId: null,
    portalPartnerId: null,
    canLinkPartner: true,
  };

  it("prefers the portal company over a vendor link", () => {
    expect(
      acceptPartnerDefaults({ ...args, portalPartnerId: SUMMIT, intakeReferralPartnerId: GULF }),
    ).toEqual({ choice: "existing", partnerCompanyId: SUMMIT });
  });

  it("defaults to None, not Create, when the portal company is no longer active", () => {
    expect(
      acceptPartnerDefaults({
        ...args,
        portalPartnerId: "24000000-0000-4000-a000-0000000000ff",
      }),
    ).toEqual({ choice: "none", partnerCompanyId: null });
  });

  it("offers no attribution to a caller who cannot set it", () => {
    expect(
      acceptPartnerDefaults({ ...args, portalPartnerId: SUMMIT, canLinkPartner: false }),
    ).toEqual({ choice: "none", partnerCompanyId: null });
  });

  it("keeps the old defaults for an intake without portal attribution", () => {
    expect(acceptPartnerDefaults(args)).toEqual({ choice: "new", partnerCompanyId: null });
    expect(acceptPartnerDefaults({ ...args, referrerName: null })).toEqual({
      choice: "none",
      partnerCompanyId: null,
    });
  });
});
