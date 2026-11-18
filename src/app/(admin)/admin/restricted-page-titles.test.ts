import type { Metadata } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as legal from "./claims/[id]/legal/page";
import * as sharing from "./claims/[id]/sharing/page";
import * as airtable from "./partners/[id]/airtable/page";

const { getSession, from, select, eq, maybeSingle } = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz")>()),
  getSession,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from }),
}));

type Route =
  | { metadata: Metadata }
  | { generateMetadata: (props: { params: Promise<{ id: string }> }) => Promise<Metadata> };

async function titleFor(route: Route, id = recordId) {
  const metadata = "generateMetadata" in route
    ? await route.generateMetadata({ params: Promise.resolve({ id }) })
    : route.metadata;
  return metadata.title;
}

const recordId = "2afa9a50-cdf8-4d09-9208-780484f127de";
const actorId = "e50dd860-36a7-49a3-9a67-817ff9a4c2ba";
const genericTitle = { absolute: "Page not found · CMG claims desk" };

beforeEach(() => {
  vi.resetAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ maybeSingle });
  getSession.mockResolvedValue({ role: "owner", aal: "aal2", userId: actorId });
  maybeSingle.mockResolvedValue({
    data: { id: recordId, claim_ref: "CMG-TEST", assigned_adjuster_id: actorId },
    error: null,
  });
});

describe.each([
  { routeName: "Legal", route: legal, allowed: { absolute: "Legal handoff · CMG claims desk" } },
  { routeName: "Sharing", route: sharing, allowed: "Company sharing" },
])("$routeName title", ({ route, allowed }) => {
  it.each(["owner", "adjuster"])("preserves the title for an authorized %s", async (role) => {
    getSession.mockResolvedValue({ role, aal: "aal2", userId: actorId });
    await expect(titleFor(route)).resolves.toEqual(allowed);
  });

  it.each(["assistant", "customer"])("conceals the title from a %s", async (role) => {
    getSession.mockResolvedValue({ role, aal: "aal2", userId: actorId });
    await expect(titleFor(route)).resolves.toEqual(genericTitle);
  });

  it("conceals the title from an adjuster who cannot manage the claim", async () => {
    getSession.mockResolvedValue({ role: "adjuster", aal: "aal2", userId: actorId });
    maybeSingle.mockResolvedValue({ data: { claim_ref: "CMG-TEST", assigned_adjuster_id: null } });
    await expect(titleFor(route)).resolves.toEqual(genericTitle);
  });

  it("conceals the title for a missing or unreadable claim", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(titleFor(route)).resolves.toEqual(genericTitle);
  });
});

describe("Airtable settings title", () => {
  it("preserves the title for a verified Owner with an existing company", async () => {
    await expect(titleFor(airtable)).resolves.toBe("Airtable connection");
    expect(from).toHaveBeenCalledWith("partner_companies");
    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenCalledWith("id", recordId);
  });

  it.each(["assistant", "adjuster", "customer"])("does not look up a company for a %s", async (role) => {
    getSession.mockResolvedValue({ role, aal: "aal2", userId: actorId });
    await expect(titleFor(airtable)).resolves.toEqual(genericTitle);
    expect(from).not.toHaveBeenCalled();
  });

  it.each([null, { role: "owner", aal: "aal1", userId: actorId }])(
    "does not look up a company without a verified Owner session",
    async (session) => {
      getSession.mockResolvedValue(session);
      await expect(titleFor(airtable)).resolves.toEqual(genericTitle);
      expect(from).not.toHaveBeenCalled();
    },
  );

  it("refuses a malformed company ID before a lookup", async () => {
    await expect(titleFor(airtable, "a".repeat(36))).resolves.toEqual(genericTitle);
    expect(from).not.toHaveBeenCalled();
  });

  it.each([null, { code: "42501" }])("conceals missing or unreadable companies", async (error) => {
    maybeSingle.mockResolvedValue({ data: null, error });
    await expect(titleFor(airtable)).resolves.toEqual(genericTitle);
  });
});
