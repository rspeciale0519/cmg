// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { issueInvite } = await import("./invites");
const { testAdminClient, localSupabaseAvailable } = await import("./esign/test-support");

const available = await localSupabaseAvailable();
const describeDb = available ? describe : describe.skip;

describeDb("issueInvite enqueue failure", () => {
  const admin = testAdminClient();
  const ids: string[] = [];
  const emails: string[] = [];
  const actorIds: string[] = [];

  afterAll(async () => {
    if (ids.length > 0) await admin.from("invites").delete().in("id", ids);
    if (emails.length > 0) await admin.from("notifications_outbox").delete().in("recipient_email", emails);
    for (const actorId of actorIds) await admin.auth.admin.deleteUser(actorId);
  });

  it("commits invite, outbox and required audit together", async () => {
    const email = `invite-fault-${randomUUID()}@example.test`;
    emails.push(email);
    const { data: actor, error: actorError } = await admin.auth.admin.createUser({
      email: `invite-actor-${randomUUID()}@example.test`,
      password: `CmgTest!${randomUUID()}`,
      email_confirm: true,
      user_metadata: { first_name: "Invite", last_name: "Actor" },
    });
    expect(actorError).toBeNull();
    expect(actor.user).not.toBeNull();
    if (!actor.user) return;
    actorIds.push(actor.user.id);

    const result = await issueInvite({
        email,
        role: "adjuster",
        invitedBy: actor.user.id,
        firstName: "Fault",
      });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    ids.push(result.inviteId);
    expect(result.queued).toBe(true);
    expect(result.url).toContain(result.token);

    const { data: invite } = await admin
      .from("invites")
      .select("id, email, accepted_at")
      .eq("id", result.inviteId)
      .single();
    expect(invite).toMatchObject({ id: result.inviteId, email, accepted_at: null });

    const { data: queued } = await admin
      .from("notifications_outbox")
      .select("id")
      .eq("recipient_email", email);
    expect(queued).toHaveLength(1);
    const { data: audit } = await admin.from("audit_log").select("id")
      .eq("action", "invite.issued").eq("entity_id", result.inviteId);
    expect(audit).toHaveLength(1);
  });
});
