// @vitest-environment node
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TestAdmin } from "@/lib/esign/test-support";

const injected = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));
vi.mock("@/lib/authz", () => ({
  requireRole: vi.fn(async () => ({
    userId: process.env.CMG_PASSWORD_FIXTURE_USER_ID,
    email: process.env.CMG_PASSWORD_FIXTURE_EMAIL,
    role: "customer",
    aal: "aal1",
  })),
}));
vi.mock("@/lib/auth/leaked-password", () => ({ isLeakedPassword: vi.fn(async () => false) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => injected.client }));

const targetUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const exactLocalTarget = (() => {
  if (process.env.CMG_TEST_STACK !== "CMGPA_private_upload_disposable" || !targetUrl) return false;
  try {
    const url = new URL(targetUrl);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "15521" &&
      url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
})();
const hasKeys = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY,
);
const describeLocal = exactLocalTarget && hasKeys ? describe : describe.skip;

describeLocal("portal password change revokes local refresh sessions", () => {
  let admin: TestAdmin;
  let caller: import("@supabase/supabase-js").SupabaseClient;
  let other: import("@supabase/supabase-js").SupabaseClient;
  let userId: string | null = null;
  let email = "";
  let oldPassword = "";
  let newPassword = "";
  let otherRefreshToken = "";

  beforeAll(async () => {
    const support = await import("@/lib/esign/test-support");
    // All required env values were checked above, so this cannot load .env.local.
    support.loadLocalEnv();
    admin = support.testAdminClient();
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

    email = `password-session-${randomUUID()}@example.test`;
    oldPassword = `Aa7!${randomBytes(18).toString("hex")}`;
    newPassword = `Bb8#${randomBytes(18).toString("hex")}`;

    const created = await admin.auth.admin.createUser({ email, password: oldPassword, email_confirm: true });
    expect(created.error).toBeNull();
    expect(created.data.user).not.toBeNull();
    if (!created.data.user) throw new Error("Local password fixture user was not created.");
    userId = created.data.user.id;
    process.env.CMG_PASSWORD_FIXTURE_USER_ID = userId;
    process.env.CMG_PASSWORD_FIXTURE_EMAIL = email;

    const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
    caller = createClient(url, publicKey, clientOptions);
    other = createClient(url, publicKey, clientOptions);
    const [callerLogin, otherLogin] = await Promise.all([
      caller.auth.signInWithPassword({ email, password: oldPassword }),
      other.auth.signInWithPassword({ email, password: oldPassword }),
    ]);
    expect(callerLogin.error).toBeNull();
    expect(otherLogin.error).toBeNull();
    expect(otherLogin.data.session?.refresh_token).toBeTruthy();
    if (!otherLogin.data.session?.refresh_token) throw new Error("Second local session was not created.");
    otherRefreshToken = otherLogin.data.session.refresh_token;
    injected.client = caller;
  }, 30_000);

  afterAll(async () => {
    injected.client = null;
    if (!userId) return;

    // Remove only rows keyed to this synthetic account in the explicitly guarded disposable stack.
    const audit = await admin.from("audit_log").delete().eq("actor_id", userId)
      .eq("action", "auth.password_changed").eq("entity", "auth").eq("entity_id", userId);
    const rateLimit = await admin.from("rate_limits").delete().eq("key", `portal-password:user:${userId}`);
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (audit.error || rateLimit.error || deleted.error) {
      throw new Error("Local password fixture cleanup failed; inspect only its synthetic user rows.");
    }
  });

  it("changes the password, ends other refresh sessions, and records the audit", async () => {
    const { changePassword } = await import("./portal");
    const form = new FormData();
    form.set("currentPassword", oldPassword);
    form.set("newPassword", newPassword);
    form.set("confirmPassword", newPassword);

    await expect(changePassword({ status: "idle", message: "" }, form))
      .rejects.toThrow("redirect:/login?notice=password-changed");

    const currentSession = await caller.auth.getSession();
    expect(currentSession.error).toBeNull();
    expect(currentSession.data.session).toBeNull();

    const refreshed = await other.auth.refreshSession({ refresh_token: otherRefreshToken });
    expect(refreshed.error).not.toBeNull();

    const oldLogin = await other.auth.signInWithPassword({ email, password: oldPassword });
    expect(oldLogin.error).not.toBeNull();
    const newLogin = await other.auth.signInWithPassword({ email, password: newPassword });
    expect(newLogin.error).toBeNull();
    expect(newLogin.data.user?.id).toBe(userId);

    const { data: auditRows, error: auditError } = await admin.from("audit_log")
      .select("id").eq("actor_id", userId!).eq("action", "auth.password_changed")
      .eq("entity", "auth").eq("entity_id", userId!);
    expect(auditError).toBeNull();
    expect(auditRows).toHaveLength(1);
  }, 30_000);
});
