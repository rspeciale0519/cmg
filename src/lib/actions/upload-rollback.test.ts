import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One invariant, on both upload paths: **a `documents` row and its bytes exist
 * together or not at all.**
 *
 * The row is the claim's account of what is on file; the object is the file. A
 * row without its object is not a missing document, it is a document the app
 * says it has — the list renders it, `issueDocumentDownload` mints a signed URL
 * for it and writes `document.signed_url_issued` into `audit_log`, and the
 * operator gets a link that 404s with the trail asserting the file was released.
 * There is no repair from the UI once the claim is past the `lor_signed` gate,
 * because `documents_delete` refuses that row by then.
 *
 * Both actions used to upload a file and commit its row per iteration while the
 * removal list accumulated across the whole loop, so a failure on file three
 * deleted the bytes of files one and two and left their rows behind. The fix is
 * structural: upload every object, then insert every row in one statement.
 * A lost response can still hide a successful commit. Error paths must queue
 * cleanup so the guarded worker can distinguish attached bytes from orphans.
 *
 * The doubles below model a bucket as a set of paths and the table as an array
 * of rows, so the assertions are the invariant itself rather than a count of
 * calls: after any refusal, every remaining row's `storage_path` must still name
 * a live object.
 */

const stub = vi.hoisted(() => {
  const CLAIM = { id: "20000000-0000-4000-a000-0000000000c1", claim_ref: "CMG-2026-0207" };

  return {
    CLAIM,
    session: { userId: "00000000-0000-4000-a000-000000000009", email: "adjuster@cmg.test" },

    /** Bucket contents, keyed by object path. */
    objects: new Set<string>(),
    /** `documents` rows that survived their statement. */
    rows: [] as Array<{ claim_id: string; storage_path: string; visibility?: string }>,
    /** Exact paths durably reserved before their Storage upload. */
    intents: new Set<string>(),

    /* Knobs, reset in beforeEach. */
    failUploadOnCall: 0 as number,
    rowInsertError: null as { message: string } | null,
    committedResponse: "normal" as "normal" | "lost" | "empty" | "partial",
    uploadCalls: 0,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn(async () => {}) }));

vi.mock("@/lib/authz", () => ({
  requireStaff: vi.fn(async () => stub.session),
  requireRole: vi.fn(async () => stub.session),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { portalUploadUser: { scope: "portal-upload:user", max: 20, window: "1 hour" } },
  checkRateLimit: vi.fn(async () => true),
  clientIpFromHeaders: vi.fn(() => "203.0.113.9"),
  inetOrNull: vi.fn((value: string) => value),
}));

/** The bucket. `upload` writes a path; `remove` deletes the paths it is given. */
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: async (name: string, args: { p_object_paths?: string[] }) => {
      if (name === "enqueue_storage_cleanup_exact") {
        for (const path of args.p_object_paths ?? []) stub.intents.add(path);
      }
      return { data: 1, error: null };
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          stub.uploadCalls += 1;
          if (stub.uploadCalls === stub.failUploadOnCall) {
            return { error: { message: "storage unreachable" } };
          }
          stub.objects.add(path);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          for (const path of paths) stub.objects.delete(path);
          return { error: null };
        },
      }),
    },
  })),
}));

/** The table, under the caller's own session, as both actions do it. */
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "claims"
              ? { data: stub.CLAIM, error: null }
              : { data: null, error: null },
        }),
      }),
      /* Accepts a single row as well as an array, so this double is not itself
         the thing asserting the fix. Run against the per-file loop that shipped
         before it, these tests fail on the invariant — rows left behind whose
         objects were removed — rather than on the shape of the call. */
      insert: (
        rows:
          | { claim_id: string; storage_path: string; visibility?: string }
          | Array<{ claim_id: string; storage_path: string; visibility?: string }>,
      ) => ({
        select: async () => {
          if (stub.rowInsertError) return { data: null, error: stub.rowInsertError };
          const batch = Array.isArray(rows) ? rows : [rows];
          // One statement, so all of it lands or none of it does.
          stub.rows.push(...batch);
          const data = batch.map((_, index) => ({ id: `row-${index}` }));
          if (stub.committedResponse === "lost") {
            return { data: null, error: { message: "database response lost" } };
          }
          if (stub.committedResponse === "empty") return { data: null, error: null };
          if (stub.committedResponse === "partial") return { data: data.slice(0, 1), error: null };
          return { data, error: null };
        },
      }),
    }),
  })),
}));

import { uploadClaimDocument } from "./documents";
import { uploadPortalDocument } from "./portal-documents";
import { idleState } from "./types";

function photo(name: string): File {
  const bytes = new Uint8Array(64);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return new File([bytes.buffer as ArrayBuffer], name, { type: "image/jpeg" });
}

function form(fields: Record<string, string>, names: string[]): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  for (const name of names) data.append("files", photo(name));
  return data;
}

const adminForm = (names: string[]) =>
  form({ claimId: stub.CLAIM.id, kind: "photo", visibility: "internal" }, names);

const portalForm = (names: string[]) =>
  form({ claimId: stub.CLAIM.id, kind: "photo" }, names);

/** The invariant, checked from the rows outward. */
function everyRowHasItsBytes(): boolean {
  return stub.rows.every((row) => stub.objects.has(row.storage_path));
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.objects = new Set();
  stub.rows = [];
  stub.intents = new Set();
  stub.failUploadOnCall = 0;
  stub.rowInsertError = null;
  stub.committedResponse = "normal";
  stub.uploadCalls = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

const SURFACES = [
  { name: "admin", action: uploadClaimDocument, build: adminForm },
  { name: "portal", action: uploadPortalDocument, build: portalForm },
] as const;

for (const surface of SURFACES) {
  describe(`${surface.name} upload — rows and bytes stay together`, () => {
    it("writes three rows and three objects when all three files land", async () => {
      const state = await surface.action(idleState, surface.build(["a.jpg", "b.jpg", "c.jpg"]));

      expect(state.status).toBe("success");
      expect(stub.rows).toHaveLength(3);
      expect(stub.objects.size).toBe(3);
      expect(stub.intents.size).toBe(3);
      expect(everyRowHasItsBytes()).toBe(true);
    });

    /**
     * The regression. Files one and two are already in the bucket when file
     * three fails; before the fix their rows were committed and their bytes were
     * then removed by the rollback, leaving two downloads that 404.
     */
    it("leaves no row behind when the third object fails to upload", async () => {
      stub.failUploadOnCall = 3;

      const state = await surface.action(idleState, surface.build(["a.jpg", "b.jpg", "c.jpg"]));

      expect(state.status).toBe("error");
      expect(stub.rows).toHaveLength(0);
      expect(stub.objects.size).toBe(2);
      expect(stub.intents.size).toBe(3);
      expect([...stub.objects].every((path) => stub.intents.has(path))).toBe(true);
      expect(everyRowHasItsBytes()).toBe(true);
    });

    /**
     * The other direction. `documents_insert` refuses the whole statement — an
     * assistant filing an `lor_signed`, a claim the adjuster is not assigned to
     * — and every object uploaded for it needs guarded cleanup.
     */
    it("queues every orphan when the rows are refused", async () => {
      stub.rowInsertError = { message: "new row violates row-level security policy" };

      const state = await surface.action(idleState, surface.build(["a.jpg", "b.jpg", "c.jpg"]));

      expect(state.status).toBe("error");
      expect(stub.rows).toHaveLength(0);
      expect(stub.objects.size).toBe(3);
      expect(stub.intents.size).toBe(3);
      expect([...stub.objects].every((path) => stub.intents.has(path))).toBe(true);
    });

    it.each(["lost", "empty", "partial"] as const)(
      "preserves committed bytes when the insert response is %s",
      async (response) => {
        stub.committedResponse = response;

        const state = await surface.action(idleState, surface.build(["a.jpg", "b.jpg", "c.jpg"]));

        expect(state.status).toBe("error");
        expect(stub.rows).toHaveLength(3);
        expect(stub.objects.size).toBe(3);
        expect(stub.intents.size).toBe(3);
        expect(everyRowHasItsBytes()).toBe(true);
      },
    );

    it("holds for a single file, which is the common case", async () => {
      stub.failUploadOnCall = 1;

      const state = await surface.action(idleState, surface.build(["only.jpg"]));

      expect(state.status).toBe("error");
      expect(stub.rows).toHaveLength(0);
      expect(stub.objects.size).toBe(0);
    });
  });
}

describe("upload — the rows themselves", () => {
  it("files every object under the claim's own prefix, which the CHECK requires", async () => {
    await uploadClaimDocument(idleState, adminForm(["a.jpg", "b.jpg"]));

    for (const row of stub.rows) {
      expect(row.storage_path.startsWith(`claims/${stub.CLAIM.id}/`)).toBe(true);
    }
  });

  /* A homeowner may not choose `visibility`, and the action does not read it
     from the form — the only value `documents_insert` admits from a customer is
     the one they can see afterwards. */
  it("fixes a homeowner's upload at customer visibility whatever the form says", async () => {
    const data = portalForm(["a.jpg"]);
    data.append("visibility", "internal");

    await uploadPortalDocument(idleState, data);

    expect(stub.rows).toHaveLength(1);
    expect(stub.rows[0]).toMatchObject({ visibility: "customer" });
  });
});
