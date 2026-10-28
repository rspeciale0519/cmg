// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";

// Only the Next.js import marker is replaced. Auth, HTTP, Storage, SQL, and
// application upload functions below run against the actual disposable stack.
vi.mock("server-only", () => ({}));

const STACK = "CMGPA_private_upload_disposable";
const ORIGIN = "http://127.0.0.1:15521";
const enabled = process.env.CMG_PRIVATE_UPLOAD_RECOVERY_TEST === "1";
const describeLocal = enabled ? describe : describe.skip;
const originalFetch = globalThis.fetch;
const retained: Record<string, unknown> = {};

function targetGuard() {
  if (process.env.CMG_TEST_STACK !== STACK) throw new Error("The disposable upload stack is required.");
  const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "about:blank");
  if (endpoint.origin !== ORIGIN || endpoint.pathname !== "/" || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash) throw new Error("The exact disposable API URL is required.");
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Disposable local keys must be supplied without loading an environment file.");
  }

  const networkIds: string[] = [];
  for (const [service, internalPort, hostPort] of [["db", "5432/tcp", "15522"], ["kong", "8000/tcp", "15521"]]) {
    const name = `supabase_${service}_${STACK}`;
    // Never inspect container Env: the selected fields contain identity only.
    const format = '{{json .Name}}|{{json .Config.Labels}}|{{json .NetworkSettings.Ports}}|{{json .NetworkSettings.Networks}}|{{json .State.Status}}';
    const result = spawnSync("docker", ["inspect", "--format", format, name], {
      encoding: "utf8", timeout: 10_000, windowsHide: true,
    });
    if (result.status !== 0) throw new Error("Disposable Docker identity could not be checked.");
    const parts = result.stdout.trim().split("|").map((value) => JSON.parse(value));
    const [actualName, labels, ports, networks, state] = parts;
    const bindings = ports[internalPort] as Array<{ HostPort: string }> | undefined;
    const network = networks[`supabase_network_${STACK}`] as { NetworkID?: string } | undefined;
    if (actualName !== `/${name}` || labels["com.supabase.cli.project"] !== STACK ||
        labels["com.docker.compose.project"] !== STACK || state !== "running" ||
        !bindings?.length || bindings.some(({ HostPort }) => HostPort !== hostPort) || !network?.NetworkID) {
      throw new Error("Disposable Docker identity does not match the approved stack.");
    }
    networkIds.push(network.NetworkID);
  }
  if (networkIds[0] !== networkIds[1]) throw new Error("Disposable API and database networks do not match.");
}

function localUrl(input: string | URL | Request) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.origin !== ORIGIN || url.username || url.password) throw new Error("A non-disposable request was refused.");
  return url;
}

const localFetch: typeof fetch = (input, init) => {
  localUrl(input);
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  if (method.toUpperCase() === "DELETE") throw new Error("Fixture deletion is not authorized.");
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  return originalFetch(input, {
    ...init, redirect: "error",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });
};

function check(error: unknown, operation: string) {
  // SDK errors and URLs can contain capabilities. Report the operation only.
  if (error) throw new Error(`Disposable upload check failed: ${operation}.`);
}

function signedUploadUrl(path: string, token: string) {
  const url = new URL(`/storage/v1/object/upload/sign/claim-docs/${path}`, ORIGIN);
  url.searchParams.set("token", token);
  return localUrl(url);
}

async function interruptUpload(url: URL, body: Uint8Array) {
  const partial = body.subarray(0, 256 * 1024);
  const written = await new Promise<number>((resolve, reject) => {
    let interrupted = false;
    let bytesWritten = 0;
    const req = request(localUrl(url), {
      method: "PUT", agent: false,
      headers: { "content-type": "application/pdf", "content-length": body.length },
    });
    req.setTimeout(10_000, () => req.destroy(new Error("Upload interruption deadline exceeded.")));
    req.once("response", (response) => {
      response.resume();
      reject(new Error("Storage responded before the transfer interruption."));
      req.destroy();
    });
    req.once("error", () => {
      if (!interrupted) reject(new Error("Upload failed before the planned interruption."));
    });
    req.once("close", () => {
      if (interrupted) resolve(bytesWritten);
      else reject(new Error("Upload closed before the planned interruption."));
    });
    req.write(partial, (error) => {
      if (error) return;
      bytesWritten = req.socket?.bytesWritten ?? 0;
      interrupted = true;
      // Content-Length still advertises the whole file. No end() call or
      // remaining bytes are sent: this closes a real incomplete HTTP request.
      req.destroy();
    });
  });
  expect(written).toBeGreaterThanOrEqual(partial.length);
  expect(written).toBeLessThan(body.length);
  await delay(500);
  return { bodyBytesSent: partial.length, socketBytesWritten: written };
}

async function objectProof(admin: SupabaseClient<Database>, path: string, expectedHash: string) {
  const storage = admin.storage.from("claim-docs");
  const info = await storage.info(path);
  check(info.error, "object metadata");
  if (!info.data) throw new Error("Disposable object metadata is missing.");
  const download = await storage.download(path);
  check(download.error, "object bytes");
  if (!download.data) throw new Error("Disposable object bytes are missing.");
  const hash = createHash("sha256").update(Buffer.from(await download.data.arrayBuffer())).digest("hex");
  expect(hash).toBe(expectedHash);
  return { id: info.data.id, version: info.data.version, size: info.data.size, sha256: hash };
}

afterAll(() => {
  vi.unstubAllGlobals();
  if (Object.keys(retained).length) {
    // No cleanup is authorized. UUIDs, exact paths, and hashes permit later
    // review; passwords, keys, session tokens, and signed URLs never leave memory.
    console.info("[private-upload] retained disposable fixture", JSON.stringify(retained));
  }
});

describeLocal("private upload recovery against disposable Auth, Postgres, and Storage", () => {
  it("recovers an interrupted 25 MiB transfer without duplicate documents or replacement bytes", async () => {
    targetGuard();
    vi.stubGlobal("fetch", localFetch);
    const [{ createClient }, { PDFDocument }, { preparePrivateUploadSession, readPrivateUploadFiles },
      { finalizePrivateUploadSession }, { MAX_FILE_BYTES }] = await Promise.all([
      import("@supabase/supabase-js"), import("pdf-lib"), import("./session"),
      import("./finalize"), import("@/lib/validators/files"),
    ]);
    const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } };
    const admin = createClient<Database>(ORIGIN, process.env.SUPABASE_SECRET_KEY!, options);
    const caller = createClient<Database>(ORIGIN, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);

    const tag = randomUUID();
    const email = `private-upload-${tag}@example.invalid`;
    const password = `Aa7!${randomBytes(24).toString("hex")}`;
    retained.stack = STACK;
    retained.fixtureTag = tag;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    check(created.error, "synthetic customer creation");
    if (!created.data.user) throw new Error("Synthetic customer was not created.");
    const userId = created.data.user.id;
    retained.userId = userId;
    const login = await caller.auth.signInWithPassword({ email, password });
    check(login.error, "synthetic customer sign-in");
    expect(login.data.user?.id).toBe(userId);
    const profile = await caller.from("profiles").select("id,role,is_active").eq("id", userId).single();
    check(profile.error, "synthetic customer profile");
    expect(profile.data).toEqual({ id: userId, role: "customer", is_active: true });

    let claimRef = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `CMG-2099-${randomInt(1000, 10000)}`;
      const existing = await admin.from("claims").select("id").eq("claim_ref", candidate).maybeSingle();
      check(existing.error, "synthetic claim reference lookup");
      if (!existing.data) { claimRef = candidate; break; }
    }
    if (!claimRef) throw new Error("An unused synthetic claim reference was not found.");
    const claimId = randomUUID();
    retained.claimId = claimId;
    retained.claimRef = claimRef;
    const claim = await admin.from("claims").insert({
      id: claimId, claim_ref: claimRef, property_street: "1 Disposable Upload Way",
      property_city: "Orlando", property_state: "Florida", property_zip: "32801",
      carrier: "Fixture Carrier", policy_number: `UPLOAD-${tag}`, carrier_tenure: "three_plus_years",
      loss_date: "2026-07-01", cause: "hurricane", description: "Disposable upload recovery fixture",
    });
    check(claim.error, "synthetic claim creation");
    const claimantId = randomUUID();
    retained.claimantId = claimantId;
    const claimant = await admin.from("claimants").insert({
      id: claimantId, claim_id: claimId, user_id: userId, first_name: "Upload", last_name: "Fixture",
      email, initials: "UF", is_primary: true,
    });
    check(claimant.error, "synthetic claimant link");
    const visible = await caller.from("claims").select("id").eq("id", claimId).single();
    check(visible.error, "customer claim access under RLS");
    expect(visible.data?.id).toBe(claimId);

    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("Disposable private upload recovery fixture");
    const body = new Uint8Array(MAX_FILE_BYTES).fill(0x20);
    body.set(await pdf.save());
    const expectedHash = createHash("sha256").update(body).digest("hex");
    retained.sizeBytes = body.length;
    retained.expectedSha256 = expectedHash;
    const prepared = await preparePrivateUploadSession(admin, claimId, userId, [
      { name: `upload-recovery-${tag}.pdf`, size: body.length, mime: "application/pdf" },
    ], "other", "customer");
    expect(prepared.status).toBe("idle");
    if (!prepared.uploadSession) throw new Error("Private upload reservation was not created.");
    const session = prepared.uploadSession;
    retained.sessionId = session.id;
    const [file] = await readPrivateUploadFiles(admin, session.id);
    retained.uploadPath = file.upload_path;
    retained.storagePath = file.storage_path;
    const uploadUrl = signedUploadUrl(session.uploads[0].path, session.uploads[0].token);
    const finish = () => finalizePrivateUploadSession(admin, caller, session.id, session.token, userId, claimId);
    retained.interruption = await interruptUpload(uploadUrl, body);

    const missing = await admin.storage.from("claim-docs").info(file.upload_path);
    expect(missing.data).toBeNull();
    expect(missing.error).not.toBeNull();
    expect(await finish()).toEqual({ status: "idle", pendingFiles: 1 });
    const pending = await admin.from("private_upload_sessions").select("status,result").eq("id", session.id).single();
    check(pending.error, "pending session readback");
    expect(pending.data).toEqual({ status: "pending", result: null });
    const empty = await caller.from("documents").select("id").eq("claim_id", claimId);
    check(empty.error, "interrupted document lookup");
    expect(empty.data).toEqual([]);

    const uploaded = await localFetch(uploadUrl, {
      method: "PUT", body, headers: { "content-type": "application/pdf" },
    });
    const uploadStatus = uploaded.status;
    await uploaded.body?.cancel();
    expect(uploadStatus).toBe(200);
    expect((await finish()).status).toBe("success");
    const documents = await caller.from("documents").select("id,storage_path,size_bytes,uploaded_by")
      .eq("claim_id", claimId);
    check(documents.error, "completed documents");
    expect(documents.data).toHaveLength(1);
    expect(documents.data?.[0]).toMatchObject({
      storage_path: file.storage_path, size_bytes: MAX_FILE_BYTES, uploaded_by: userId,
    });
    retained.documentId = documents.data![0].id;
    const beforeStage = await objectProof(admin, file.upload_path, expectedHash);
    const beforePermanent = await objectProof(admin, file.storage_path, expectedHash);

    const changed = body.slice();
    changed[changed.length - 1] = 0x0a;
    expect(createHash("sha256").update(changed).digest("hex")).not.toBe(expectedHash);
    const replay = await localFetch(uploadUrl, {
      method: "PUT", body: changed,
      headers: { "content-type": "application/pdf", "x-upsert": "true" },
    });
    const replayStatus = replay.status;
    const replayBody = await replay.json() as { error?: string; code?: string; message?: string };
    expect(replay.ok).toBe(false);
    expect([replayBody.error, replayBody.code, replayBody.message].join(" ")).toMatch(/duplicate|already exists|ResourceAlreadyExists/i);
    const copied = await admin.storage.from("claim-docs").copy(file.upload_path, file.storage_path);
    expect(copied.error).not.toBeNull();
    expect(copied.error?.message).toMatch(/duplicate|already exists|ResourceAlreadyExists/i);
    expect((await finish()).status).toBe("success");
    expect((await finish()).status).toBe("success");
    expect(await objectProof(admin, file.upload_path, expectedHash)).toEqual(beforeStage);
    expect(await objectProof(admin, file.storage_path, expectedHash)).toEqual(beforePermanent);
    const finalDocuments = await caller.from("documents").select("id,storage_path,size_bytes,uploaded_by")
      .eq("claim_id", claimId);
    check(finalDocuments.error, "retry document readback");
    expect(finalDocuments.data).toEqual(documents.data);
    const completed = await admin.from("private_upload_sessions").select("id,status,result")
      .eq("claim_id", claimId).eq("uploaded_by", userId);
    check(completed.error, "completed session readback");
    expect(completed.data).toHaveLength(1);
    expect(completed.data?.[0]).toEqual({
      id: session.id, status: "completed",
      result: { documents: [{ id: documents.data![0].id, storage_path: file.storage_path }] },
    });
    retained.uploadHttpStatus = uploadStatus;
    retained.replayHttpStatus = replayStatus;
    retained.stagingProof = beforeStage;
    retained.permanentProof = beforePermanent;
    retained.documentCount = finalDocuments.data?.length;
  }, 120_000);
});
