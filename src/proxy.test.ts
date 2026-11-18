// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// This selection checks response policy only. Session reads remain outside the test.
vi.mock("@/lib/supabase/proxy", () => ({ updateSession: async () => new Response(null) }));
import { proxy } from "./proxy";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:15621");
});
afterEach(() => vi.unstubAllEnvs());

describe("application origin security policy", () => {
  it.each(["localhost", "127.0.0.1", "cmg-law-firm-airtable.localhost", "owner.cmg-law-firm-airtable.localhost"])(
    "keeps local HTTP and isolated Storage available at %s", async (hostname) => {
      const response = await proxy(new NextRequest(`http://${hostname}:3170/admin`));
      const policy = response.headers.get("Content-Security-Policy")!;
      expect(policy).not.toContain("upgrade-insecure-requests");
      expect(policy).toContain("http://127.0.0.1:15621 ws://127.0.0.1:15621");
      expect(policy).not.toContain("'unsafe-eval'");
    },
  );

  it.each(["app.cmgpropertysolutions.net", "localhost.example", "x.localhost.example", "notlocalhost", "localhost-example.test"])(
    "keeps the hosted policy at %s", async (hostname) => {
      const response = await proxy(new NextRequest(`https://${hostname}/admin`));
      const policy = response.headers.get("Content-Security-Policy")!;
      expect(policy).toContain("upgrade-insecure-requests");
      expect(policy).not.toContain("127.0.0.1");
      expect(policy).not.toContain("'unsafe-eval'");
    },
  );
});
