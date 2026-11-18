import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("POLICY_NOT_FOUND"); },
}));

import PrivacyPage from "@/app/(marketing)/privacy/page";
import TermsPage from "@/app/(marketing)/terms/page";
import { POLICY_REVISION } from "./availability";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("CMG_PUBLIC_POLICIES_APPROVED", undefined);
  vi.stubEnv("CMG_POLICY_DRAFTS", undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe.each([
  { name: "Privacy notice", Page: PrivacyPage },
  { name: "Website terms", Page: TermsPage },
])("$name route", ({ name, Page }) => {
  it("refuses public access before approval", async () => {
    await expect(Page()).rejects.toThrow("POLICY_NOT_FOUND");
  });

  it("marks a permitted local preview as a draft", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CMG_POLICY_DRAFTS", "true");
    render(await Page());
    expect(screen.getByRole("heading", { level: 1, name })).toBeTruthy();
    expect(screen.getByText("Draft for owner review. This page is not published.")).toBeTruthy();
  });

  it("does not expose the draft through a hosted preview", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CMG_POLICY_DRAFTS", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(Page()).rejects.toThrow("POLICY_NOT_FOUND");
  });

  it("renders the approved revision without a draft label", async () => {
    vi.stubEnv("CMG_PUBLIC_POLICIES_APPROVED", POLICY_REVISION);
    render(await Page());
    expect(screen.getByRole("heading", { level: 1, name })).toBeTruthy();
    expect(screen.queryByText("Draft for owner review. This page is not published.")).toBeNull();
  });
});
