// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database-app";
import type { IntakeUploadSession } from "@/lib/intake/upload-types";
import { MAX_FILE_BYTES, MAX_FILES } from "@/lib/validators/files";

vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
vi.stubEnv("RESEND_API_KEY", "");
vi.stubEnv("EMAIL_STAFF_INBOX", "staff-upload@example.invalid");
const support = await import("@/lib/esign/test-support");
const { intakeFixtureInput, removeLocalIntakeFixtureRecords } = await import("@/lib/intake/test-fixtures");
const { prepareIntakeSession, finalizeIntakeSession } = await import("@/lib/intake/upload-session");
const available = await support.localSupabaseAvailable();
if (!available) console.warn("[intake-upload] local Supabase unavailable; upload integration suite skipped");
const describeDb = available ? describe : describe.skip;

describeDb("private direct intake uploads against local Postgres and Storage", () => {
  let admin: ReturnType<typeof support.testAdminClient>;
  const sessions: IntakeUploadSession[] = [];

  beforeAll(() => { admin = support.testAdminClient(); });
  afterAll(async () => {
    const failures: unknown[] = [];
    for (const session of sessions) {
      try {
        const files = await admin.from("intake_upload_files")
          .select("upload_path,storage_path").eq("session_id", session.id);
        const state = await admin.from("intake_upload_sessions").select("result").eq("id", session.id).single();
        if (files.error || state.error) throw new Error("Fixture path lookup failed.");
        const paths = files.data.flatMap((file) => [file.upload_path, file.storage_path]);
        if (paths.length) {
          const removed = await admin.storage.from("claim-docs").remove(paths);
          if (removed.error) throw new Error("Fixture object cleanup failed.");
        }
        const result = state.data.result as { id?: string; claim_ref?: string } | null;
        if (result?.id) await support.cleanupClaim(admin, result.id, result.claim_ref);
        if (paths.length) {
          const queued = await admin.from("storage_cleanup_queue").delete().eq("bucket_id", "claim-docs").in("object_path", paths);
          if (queued.error) throw new Error("Fixture cleanup history removal failed.");
        }
        removeLocalIntakeFixtureRecords([session.id]);
      } catch (error) { failures.push(error); }
    }
    vi.unstubAllEnvs();
    if (failures.length) throw new AggregateError(failures, "Intake fixture cleanup failed.");
  });

  async function prepare(sizes: number[]): Promise<IntakeUploadSession> {
    const prepared = await prepareIntakeSession(admin, intakeFixtureInput(), sizes.map((size, index) => ({
      name: `fixture-${index}.pdf`, size, mime: "application/pdf",
    })), "203.0.113.19");
    if (!prepared.uploadSession) throw new Error("Fixture upload session could not be prepared.");
    sessions.push(prepared.uploadSession);
    return prepared.uploadSession;
  }

  async function upload(session: IntakeUploadSession, index: number, size: number, valid = true) {
    const entry = session.uploads[index];
    const body = new Uint8Array(size);
    body.set(new TextEncoder().encode(valid ? "%PDF-1.7\n" : "invalid!\n"));
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    // An explicit port permits an isolated disposable stack without touching
    // the default CMG development database. The target must stay on loopback.
    const storagePort = process.env.CMG_TEST_STORAGE_PORT || "15421";
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== storagePort) {
      throw new Error("Signed upload tests require local CMG Storage.");
    }
    url.pathname = `/storage/v1/object/upload/sign/claim-docs/${entry.path}`;
    url.searchParams.set("token", entry.token);
    // No API key or service header accompanies the signed browser upload.
    const response = await fetch(url, { method: "PUT", body, headers: { "content-type": entry.mime } });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Local signed upload returned HTTP ${response.status}.`);
  }

  async function finalize(session: IntakeUploadSession) {
    let pending = session.uploads.length;
    for (let attempt = 0; attempt <= MAX_FILES; attempt += 1) {
      const state = await finalizeIntakeSession(admin, session.id, session.token);
      if (state.status !== "idle") return state;
      if (typeof state.pendingFiles !== "number" || state.pendingFiles <= 0 || state.pendingFiles >= pending) {
        throw new Error("Fixture finalization progress did not decrease.");
      }
      pending = state.pendingFiles;
    }
    throw new Error("Fixture finalization exceeded its bounded retry count.");
  }

  it("accepts ten files, including 25 MiB, and attaches only private document copies", async () => {
    const sizes = [MAX_FILE_BYTES, ...Array.from({ length: 9 }, () => 64)];
    const session = await prepare(sizes);
    for (let index = 0; index < sizes.length; index++) await upload(session, index, sizes[index]);
    const state = await finalize(session);
    expect(state.status).toBe("success");
    const stored = await admin.from("intake_upload_sessions").select("result").eq("id", session.id).single();
    expect(stored.error).toBeNull();
    const result = stored.data!.result as { id: string };
    const documents = await admin.from("documents").select("storage_path,size_bytes").eq("claim_id", result.id);
    expect(documents.error).toBeNull();
    expect(documents.data).toHaveLength(10);
    expect(documents.data!.some((document) => document.size_bytes === MAX_FILE_BYTES)).toBe(true);
    expect(documents.data!.every((document) => !session.uploads.some((entry) => entry.path === document.storage_path))).toBe(true);
    const files = await admin.from("intake_upload_files").select("upload_path,storage_path")
      .eq("session_id", session.id).order("index");
    expect(files.error).toBeNull();
    const destination = files.data![0].storage_path;
    const beforeCopy = await admin.storage.from("claim-docs").info(destination);
    const duplicate = await admin.storage.from("claim-docs").copy(files.data![0].upload_path, destination);
    expect(Boolean(duplicate.error)).toBe(true);
    const afterCopy = await admin.storage.from("claim-docs").info(destination);
    expect(afterCopy.data?.version).toBe(beforeCopy.data?.version);
    const bucket = await admin.storage.getBucket("claim-docs");
    expect(bucket.data?.public).toBe(false);
    expect((await finalizeIntakeSession(admin, session.id, session.token)).reference).toBe(state.reference);
  });

  it("commits once and recovers a lost finalization response", async () => {
    const session = await prepare([64]);
    await upload(session, 0, 64);
    let responseLost = false;
    const uncertain = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        const response = await fetch(input, init);
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        if (url.pathname === "/rest/v1/rpc/finalize_intake_upload_session" && response.ok && !responseLost) {
          responseLost = true;
          await response.body?.cancel();
          return new Response('{"message":"fixture response unavailable"}', {
            status: 504, headers: { "Content-Type": "application/json" },
          });
        }
        return response;
      } },
    });
    let uncertainState = await finalizeIntakeSession(uncertain, session.id, session.token);
    for (let i = 0; i < MAX_FILES && uncertainState.status === "idle"; i += 1) {
      uncertainState = await finalizeIntakeSession(uncertain, session.id, session.token);
    }
    const states = [uncertainState, await finalize(session)];
    expect(responseLost).toBe(true);
    expect(states.every((state) => state.status === "success")).toBe(true);
    expect(states[0].reference).toBe(states[1].reference);
    const recorded = await admin.from("claims").select("id", { count: "exact", head: true }).eq("claim_ref", states[0].reference!);
    expect(recorded.error).toBeNull();
    expect(recorded.count).toBe(1);
  });

  it("preserves the session while an upload is missing, then accepts the completed upload", async () => {
    const session = await prepare([64]);
    const pending = await finalizeIntakeSession(admin, session.id, session.token);
    expect(pending.status).toBe("error");
    expect(pending.restartAllowed).not.toBe(true);
    await upload(session, 0, 64);
    expect((await finalize(session)).status).toBe("success");
  });

  it("cancels invalid file content without a claim and retains exact cleanup paths", async () => {
    const session = await prepare([64]);
    await upload(session, 0, 64, false);
    const state = await finalize(session);
    expect(state.status).toBe("error");
    expect(state.restartAllowed).toBe(true);
    const stored = await admin.from("intake_upload_sessions").select("status,result").eq("id", session.id).single();
    expect(stored.data).toEqual({ status: "cancelled", result: null });
    const queued = await admin.from("storage_cleanup_queue").select("attempts,processed_at,next_attempt_at")
      .eq("object_path", session.uploads[0].path);
    expect(queued.error).toBeNull();
    expect(queued.data?.[0]?.attempts).toBe(0);
    expect(queued.data?.[0]?.processed_at).toBeNull();
    expect(Date.parse(queued.data![0].next_attempt_at)).toBeGreaterThan(Date.now());
  });

  it("keeps submissions with no documents idempotent", async () => {
    const session = await prepare([]);
    const first = await finalize(session);
    const second = await finalize(session);
    expect(first.status).toBe("success");
    expect(second.reference).toBe(first.reference);
  });
});
