import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const provider = vi.hoisted(() => ({ send: vi.fn(async () => ({ error: null })) }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: provider.send };
  },
}));

const { staffInbox, resendSender, staffRecipientAllowed } = await import("./outbox");

afterEach(() => {
  vi.unstubAllEnvs();
  provider.send.mockClear();
});

describe("staff alert recipient", () => {
  it.each(["", "   ", "not-an-address", "two@example.test,other@example.test"])(
    "holds an alert when the configured address is invalid: %j",
    (value) => {
      vi.stubEnv("EMAIL_STAFF_INBOX", value);
      expect(staffInbox()).toBe("unresolved-staff@invalid");
    },
  );

  it("holds an alert when the address is absent", () => {
    vi.stubEnv("EMAIL_STAFF_INBOX", undefined);
    expect(staffInbox()).toBe("unresolved-staff@invalid");
  });

  it("uses a valid configured address after trimming whitespace", () => {
    vi.stubEnv("EMAIL_STAFF_INBOX", "  staff@example.test  ");
    expect(staffInbox()).toBe("staff@example.test");
  });

  it("reports a blocked configured staff address", async () => {
    vi.stubEnv("EMAIL_STAFF_INBOX", "staff@cmgpropertysolutions.net");
    const admin = { rpc: vi.fn(async () => ({ data: false, error: null })) } as unknown as Parameters<typeof staffRecipientAllowed>[0];
    expect(await staffRecipientAllowed(admin)).toBe(false);
  });

  it("reports unknown when the staff recipient policy cannot be checked", async () => {
    vi.stubEnv("EMAIL_STAFF_INBOX", "staff@example.test");
    const admin = { rpc: vi.fn(async () => ({ data: null, error: { message: "unavailable" } })) } as unknown as Parameters<typeof staffRecipientAllowed>[0];
    expect(await staffRecipientAllowed(admin)).toBeNull();
  });

  it("never sends the reserved unresolved recipient to the provider", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_local_test");
    const admin = { rpc: vi.fn(async () => ({ data: false, error: null })) } as unknown as Parameters<typeof resendSender>[0];
    const send = await resendSender(admin);
    expect(send).not.toBeNull();
    await expect(send!({
      idempotencyKey: "local-only",
      to: "unresolved-staff@invalid",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    })).rejects.toThrow();
    expect(provider.send).not.toHaveBeenCalled();
  });

  it.each(["person@CMGPropertySolutions.net", "person@child.cmgpropertysolutions.net"])(
    "does not send a prohibited address even through the direct sender: %s",
    async (address) => {
      vi.stubEnv("RESEND_API_KEY", "re_local_test");
      const admin = { rpc: vi.fn(async () => ({ data: false, error: null })) };
      const send = await resendSender(admin as unknown as Parameters<typeof resendSender>[0]);
      await expect(send!({
        idempotencyKey: "local-only", to: address, subject: "Test",
        html: "<p>Test</p>", text: "Test",
      })).rejects.toThrow();
      expect(admin.rpc).toHaveBeenCalledWith("email_recipient_allowed", { p_recipient: address });
      expect(provider.send).not.toHaveBeenCalled();
    },
  );

  it("does not call the provider when the recipient policy is unavailable", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_local_test");
    const admin = { rpc: vi.fn(async () => ({ data: null, error: { message: "unavailable" } })) };
    const send = await resendSender(admin as unknown as Parameters<typeof resendSender>[0]);
    await expect(send!({
      idempotencyKey: "local-only", to: "someone@example.test", subject: "Test",
      html: "<p>Test</p>", text: "Test",
    })).rejects.toThrow();
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("checks the exact token and address before a queued send", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_local_test");
    const rpc = vi.fn(async () => ({ data: false, error: null }));
    const send = await resendSender({ rpc } as unknown as Parameters<typeof resendSender>[0]);
    await expect(send!({ idempotencyKey: "row", leaseToken: "token", to: "someone@example.test", subject: "Test", html: "Test", text: "Test" })).rejects.toMatchObject({ code: "RECIPIENT_POLICY_HOLD" });
    expect(rpc).toHaveBeenCalledWith("outbox_claim_ready_v2", { p_id: "row", p_token: "token", p_recipient: "someone@example.test" });
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("sends an allowed direct message only after the policy check", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_local_test");
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const send = await resendSender({ rpc } as unknown as Parameters<typeof resendSender>[0]);
    await send!({ idempotencyKey: "direct", to: "someone@example.test", subject: "Test", html: "Test", text: "Test" });
    expect(rpc).toHaveBeenCalledWith("email_recipient_allowed", { p_recipient: "someone@example.test" });
    expect(provider.send).toHaveBeenCalledOnce();
  });

  it("marks a provider connection error as an uncertain outcome", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_local_test");
    provider.send.mockRejectedValueOnce(new Error("connection failed"));
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const send = await resendSender({ rpc } as unknown as Parameters<typeof resendSender>[0]);
    await expect(send!({ idempotencyKey: "row", leaseToken: "token", to: "someone@example.test", subject: "Test", html: "Test", text: "Test" })).rejects.toMatchObject({ code: "PROVIDER_OUTCOME_UNKNOWN" });
  });

  it.each([
    [409, "PROVIDER_OUTCOME_UNKNOWN"],
    [400, undefined],
  ])("classifies provider status %i", async (status, code) => {
    vi.stubEnv("RESEND_API_KEY", "re_local_test");
    provider.send.mockResolvedValueOnce({ error: { statusCode: status } } as never);
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const send = await resendSender({ rpc } as unknown as Parameters<typeof resendSender>[0]);
    await expect(send!({ idempotencyKey: "row", leaseToken: "token", to: "someone@example.test", subject: "Test", html: "Test", text: "Test" })).rejects.toMatchObject(code ? { code } : { message: "Provider refused the message." });
  });
  it("does not start a late provider call after the pre-send check times out", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_local_test");
    let finish!: (value: { data: boolean; error: null }) => void;
    const rpc = vi.fn(() => new Promise<{ data: boolean; error: null }>((resolve) => { finish = resolve; }));
    const send = await resendSender({ rpc } as unknown as Parameters<typeof resendSender>[0]);
    const controller = new AbortController();
    const pending = send!({ idempotencyKey: "row", leaseToken: "token", signal: controller.signal, to: "someone@example.test", subject: "Test", html: "Test", text: "Test" });
    controller.abort();
    finish({ data: true, error: null });
    await expect(pending).rejects.toThrow();
    expect(provider.send).not.toHaveBeenCalled();
  });
});
