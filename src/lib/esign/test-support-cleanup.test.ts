// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  captureWebhookRejectionAudit,
  cleanupClaim,
  cleanupFixtures,
  cleanupWebhookEvents,
} from "./test-support";

const CLAIM_ID = "11111111-2222-4333-8444-555555555555";
const SECOND_CLAIM_ID = "22222222-3333-4444-8555-666666666666";
const VENDOR_DETAIL = "private-recipient@example.test fake-cleanup-secret";

type Result = { data: unknown; error: { message: string } | null };
type Filter = { key: string; operator: string; value: unknown };
type Query = PromiseLike<Result> & {
  eq: (key: string, value: unknown) => Query;
  in: (key: string, value: unknown) => Query;
  filter: (key: string, operator: string, value: unknown) => Query;
};

function fakeAdmin(
  fail?: (step: string, value: unknown, filters: Filter[]) => Result | Error | undefined,
) {
  const execute = vi.fn<(step: string, value?: unknown) => void>();
  const settle = async (step: string, value?: unknown, filters: Filter[] = []): Promise<Result> => {
    execute(step, value);
    const failure = fail?.(step, value, filters);
    if (failure instanceof Error) throw failure;
    if (failure) return failure;
    return { data: step === "storage.list" ? [{ name: "fixture.pdf" }] : [], error: null };
  };
  const query = (step: string): Query => {
    const filters: Filter[] = [];
    const builder: Query = {
      eq: (key, value) => builder.filter(key, "eq", value),
      in: (key, value) => builder.filter(key, "in", value),
      filter: (key, operator, value) => {
        filters.push({ key, operator, value });
        return builder;
      },
      then: (resolve, reject) => settle(step, filters.at(-1)?.value, filters).then(resolve, reject),
    };
    return builder;
  };
  const admin = {
    from: (table: string) => ({
      select: () => query(`${table}.select`),
      delete: () => query(`${table}.delete`),
    }),
    storage: {
      from: () => ({
        list: (path: string) => settle("storage.list", path),
        remove: (paths: string[]) => settle("storage.remove", paths),
      }),
    },
  } as unknown as Parameters<typeof cleanupClaim>[0];
  return { admin, execute };
}

type AuditRow = { id: number; entity: string; action: string; ip: string };

function auditRow(id: number, ip: string): AuditRow {
  return { id, ip, entity: "pandadoc_webhook", action: "esign.webhook_signature_rejected" };
}

function fakeAuditRecords(initial: AuditRow[]) {
  const rows = [...initial];
  const fake = fakeAdmin((step, _value, filters) => {
    if (!step.startsWith("audit_log.")) return undefined;
    const matched = rows.filter((row) => filters.every(({ key, operator, value }) =>
      operator === "in"
        ? Array.isArray(value) && value.includes(row[key as keyof AuditRow])
        : row[key as keyof AuditRow] === value,
    ));
    if (step === "audit_log.select") {
      return { data: matched.map(({ id }) => ({ id })), error: null };
    }
    const ids = new Set(matched.map(({ id }) => id));
    for (let index = rows.length - 1; index >= 0; index--) {
      if (ids.has(rows[index].id)) rows.splice(index, 1);
    }
    return { data: null, error: null };
  });
  return { ...fake, rows };
}

function resolvedError(): Result {
  return { data: null, error: { message: VENDOR_DETAIL } };
}

async function cleanupFailure(pending: Promise<void>): Promise<AggregateError> {
  const failure = await pending.then(() => null, (error: unknown) => error);
  expect(failure).toBeInstanceOf(AggregateError);
  const error = failure as AggregateError;
  const messages = [error.message, ...error.errors.map((item: Error) => item.message)].join("\n");
  expect(messages).not.toContain("private-recipient@example.test");
  expect(messages).not.toContain("fake-cleanup-secret");
  return error;
}

describe("database fixture cleanup", () => {
  it("reports a returned claim-delete error and preserves evidence needed for retry", async () => {
    const { admin, execute } = fakeAdmin((step) =>
      step === "claims.delete" ? resolvedError() : undefined,
    );

    const error = await cleanupFailure(cleanupClaim(admin, CLAIM_ID, "CMG-2099-1001"));

    expect(error.errors).toEqual([expect.objectContaining({ message: expect.stringContaining("delete claim") })]);
    expect(execute).toHaveBeenCalledWith("claims.delete", CLAIM_ID);
    expect(execute).not.toHaveBeenCalledWith("audit_log.delete", expect.anything());
    expect(execute).not.toHaveBeenCalledWith("storage_cleanup_queue.delete", expect.anything());
  });

  it("reports returned storage errors while still attempting database teardown", async () => {
    const { admin, execute } = fakeAdmin((step) =>
      step === "storage.remove" ? resolvedError() : undefined,
    );

    await cleanupFailure(cleanupClaim(admin, CLAIM_ID));

    expect(execute).toHaveBeenCalledWith("claims.delete", CLAIM_ID);
    expect(execute).toHaveBeenCalledWith("storage_cleanup_queue.delete", CLAIM_ID);
  });

  it("continues after a thrown transport error and reports it without raw details", async () => {
    const { admin, execute } = fakeAdmin((step) =>
      step === "notifications_outbox.delete" ? new Error(VENDOR_DETAIL) : undefined,
    );

    await cleanupFailure(cleanupClaim(admin, CLAIM_ID, "CMG-2099-1001"));

    expect(execute).toHaveBeenCalledWith("claims.delete", CLAIM_ID);
    expect(execute).toHaveBeenCalledWith("storage_cleanup_queue.delete", CLAIM_ID);
  });

  it("keeps child rows when their audit identifiers could not be collected", async () => {
    const { admin, execute } = fakeAdmin((step) =>
      step === "documents.select" ? resolvedError() : undefined,
    );

    await cleanupFailure(cleanupClaim(admin, CLAIM_ID));

    expect(execute).not.toHaveBeenCalledWith("claims.delete", expect.anything());
    expect(execute).not.toHaveBeenCalledWith("storage_cleanup_queue.delete", expect.anything());
  });

  it("attempts other fixtures and webhook cleanup before rejecting the batch", async () => {
    const { admin, execute } = fakeAdmin((step, value) =>
      step === "claims.delete" && value === CLAIM_ID ? resolvedError() : undefined,
    );

    await cleanupFailure(cleanupFixtures(admin, [
      { id: CLAIM_ID, claimRef: "CMG-2099-1001" },
      { id: SECOND_CLAIM_ID, claimRef: "CMG-2099-1002" },
    ], ["33333333-4444-4555-8666-777777777777"]));

    expect(execute).toHaveBeenCalledWith("claims.delete", SECOND_CLAIM_ID);
    expect(execute).toHaveBeenCalledWith("pandadoc_webhook_events.delete", ["33333333-4444-4555-8666-777777777777"]);
  });

  it("reports a returned webhook cleanup error", async () => {
    const { admin } = fakeAdmin((step) =>
      step === "pandadoc_webhook_events.delete" ? resolvedError() : undefined,
    );

    await cleanupFailure(cleanupWebhookEvents(admin, ["33333333-4444-4555-8666-777777777777"]));
  });

  it("finishes a successful cleanup without manufacturing a failure", async () => {
    const { admin, execute } = fakeAdmin();

    await expect(cleanupClaim(admin, CLAIM_ID, "CMG-2099-1001")).resolves.toBeUndefined();

    expect(execute).toHaveBeenCalledWith("storage.remove", [`claims/${CLAIM_ID}/fixture.pdf`]);
    expect(execute).toHaveBeenCalledWith("claims.delete", CLAIM_ID);
    expect(execute).toHaveBeenCalledWith("storage_cleanup_queue.delete", CLAIM_ID);
  });
});

describe("webhook audit fixture ownership", () => {
  it("captures each fixture's exact audit ID and preserves unrelated rejection records", async () => {
    const unrelated = auditRow(1, "203.0.113.42");
    const { admin, execute, rows } = fakeAuditRecords([unrelated]);
    const auditIds: number[] = [];
    const fixtureIps: string[] = [];
    const outcome = { status: 403 };

    for (const id of [2, 3]) {
      const result = await captureWebhookRejectionAudit(admin, auditIds, async (ip) => {
        expect(ip).toMatch(/^2001:db8(?::[0-9a-f]{4}){6}$/);
        fixtureIps.push(ip);
        rows.push(auditRow(id, ip));
        return outcome;
      });
      expect(result).toBe(outcome);
    }

    expect(new Set(fixtureIps).size).toBe(2);
    expect(auditIds).toEqual([2, 3]);
    await cleanupFixtures(admin, [], ["33333333-4444-4555-8666-777777777777"], auditIds);

    expect(rows).toEqual([unrelated]);
    expect(execute).toHaveBeenCalledWith("audit_log.delete", [2, 3]);
    expect(execute).toHaveBeenCalledWith("pandadoc_webhook_events.delete", ["33333333-4444-4555-8666-777777777777"]);
  });

  it("does nothing for an empty event list without captured audit IDs", async () => {
    const unrelated = auditRow(1, "203.0.113.42");
    const { admin, execute, rows } = fakeAuditRecords([unrelated]);

    await cleanupWebhookEvents(admin, []);

    expect(rows).toEqual([unrelated]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("retains untracked audit records when only event IDs are known", async () => {
    const unrelated = auditRow(1, "203.0.113.42");
    const { admin, execute, rows } = fakeAuditRecords([unrelated]);

    await cleanupWebhookEvents(admin, ["33333333-4444-4555-8666-777777777777"]);

    expect(rows).toEqual([unrelated]);
    expect(execute).not.toHaveBeenCalledWith("audit_log.delete", expect.anything());
    expect(execute).toHaveBeenCalledWith("pandadoc_webhook_events.delete", ["33333333-4444-4555-8666-777777777777"]);
  });

  it("cleans captured rejection audits when no event ID was recorded", async () => {
    const unrelated = auditRow(1, "203.0.113.42");
    const { admin, execute, rows } = fakeAuditRecords([unrelated]);
    const auditIds: number[] = [];
    await captureWebhookRejectionAudit(admin, auditIds, async (ip) => {
      rows.push(auditRow(2, ip));
    });

    await cleanupFixtures(admin, [], undefined, auditIds);

    expect(rows).toEqual([unrelated]);
    expect(execute).not.toHaveBeenCalledWith("pandadoc_webhook_events.delete", expect.anything());
  });

  it.each([0, 2])("retains records when the capture finds %i possible audit rows", async (count) => {
    const unrelated = auditRow(1, "203.0.113.42");
    const { admin, rows } = fakeAuditRecords([unrelated]);
    const auditIds: number[] = [];

    await expect(captureWebhookRejectionAudit(admin, auditIds, async (ip) => {
      for (let index = 0; index < count; index++) rows.push(auditRow(index + 2, ip));
    })).rejects.toThrow("webhook fixture audit ID could not be captured; record retained");
    await cleanupWebhookEvents(admin, [], auditIds);

    expect(auditIds).toEqual([]);
    expect(rows).toHaveLength(count + 1);
    expect(rows).toContainEqual(unrelated);
  });

  it.each(["returned", "thrown"])("reports a %s audit lookup error without private details", async (mode) => {
    const { admin, execute } = fakeAdmin((step) => {
      if (step !== "audit_log.select") return undefined;
      return mode === "returned" ? resolvedError() : new Error(VENDOR_DETAIL);
    });
    const auditIds: number[] = [];

    const pending = captureWebhookRejectionAudit(admin, auditIds, async () => undefined);
    await expect(pending).rejects.toMatchObject({
      message: "[esign-test] webhook fixture audit ID could not be captured; record retained",
    });
    await expect(pending).rejects.not.toHaveProperty("cause");
    await cleanupWebhookEvents(admin, [], auditIds);

    expect(auditIds).toEqual([]);
    expect(execute).not.toHaveBeenCalledWith("audit_log.delete", expect.anything());
  });

  it("reports an exact audit-delete error and still attempts event cleanup", async () => {
    const { admin, execute } = fakeAdmin((step) =>
      step === "audit_log.delete" ? resolvedError() : undefined,
    );

    await cleanupFailure(cleanupWebhookEvents(admin, ["33333333-4444-4555-8666-777777777777"], [2]));

    expect(execute).toHaveBeenCalledWith("audit_log.delete", [2]);
    expect(execute).toHaveBeenCalledWith("pandadoc_webhook_events.delete", ["33333333-4444-4555-8666-777777777777"]);
  });
});
