import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeFinalizeState, IntakeStartState, IntakeUploadSession } from "@/lib/intake/upload-types";
import { useIntakeUpload } from "./use-intake-upload";

const { start, finalize, put } = vi.hoisted(() => ({ start: vi.fn(), finalize: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/actions/intake", () => ({ submitIntake: start, finalizeIntakeUpload: finalize }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: put }) } }),
}));

function pdf(name = "policy.pdf") {
  return new File(["test document"], name, { type: "application/pdf" });
}

function fileList(files: File[]): FileList {
  return Object.assign(files, { item: (index: number) => files[index] ?? null });
}

function session(count: number): IntakeUploadSession {
  return {
    id: "fixture-session", token: "fixture-secret", expiresAt: "2026-08-31T02:00:00Z",
    uploads: Array.from({ length: count }, (_, index) => ({
      index, path: `intake/fixture/${index}.pdf`, token: `fixture-upload-${index}`, mime: "application/pdf",
    })),
  };
}

function form() {
  const element = document.createElement("form");
  element.innerHTML = '<input name="firstName" value="Test"><input name="cf-turnstile-response" value="test-only-token">';
  return element;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolveValue) => { resolve = resolveValue; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  start.mockImplementation(async (_state, data: FormData) => ({
    status: "idle", uploadSession: session(JSON.parse(data.get("uploadManifest") as string).length),
  }));
  finalize.mockResolvedValue({ status: "success", reference: "CMG-TEST" });
  put.mockResolvedValue({ error: null });
});
afterEach(cleanup);

describe("public intake upload state", () => {
  it("finalizes an intake with no documents without loading an upload", async () => {
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
    expect(finalize).toHaveBeenCalledExactlyOnceWith("fixture-session", "fixture-secret");
  });

  it("validates files locally without consuming a verification attempt", () => {
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([new File(["x"], "unsafe.exe", { type: "application/octet-stream" })])));
    act(() => result.current.submit(form()));
    expect(result.current.state.fieldErrors?.documents).toContain("not a file type");
    expect(result.current.locked).toBe(false);
    expect(result.current.turnstileReset).toBe(0);
    expect(start).not.toHaveBeenCalled();
  });

  it("preserves fields and files after preparation validation errors", async () => {
    const element = form();
    const file = pdf();
    start.mockResolvedValueOnce({ status: "error", fieldErrors: { email: "Enter an email address." } });
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([file])));
    act(() => result.current.submit(element));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.turnstileReset).toBe(1);
    expect(result.current.locked).toBe(false);
    expect(new FormData(element).get("firstName")).toBe("Test");
    act(() => result.current.submit(element));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(put.mock.calls[0][2]).toBe(file);
  });

  it("handles a lost preparation response without instructing the user to reload", async () => {
    start.mockRejectedValueOnce(new Error("test-only transport error"));
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state.message).toContain("remain here");
    expect(result.current.state.message).not.toMatch(/reload|test-only transport/);
    expect(result.current.turnstileReset).toBe(1);
    expect(result.current.locked).toBe(false);
    expect(finalize).not.toHaveBeenCalled();
  });

  it("blocks duplicate submissions and freezes the original file selection", async () => {
    const waiting = deferred<IntakeStartState>();
    start.mockReturnValueOnce(waiting.promise);
    const original = pdf("original.pdf");
    const { result } = renderHook(useIntakeUpload);
    const element = form();
    act(() => result.current.selectFiles(fileList([original])));
    act(() => {
      result.current.submit(element);
      result.current.submit(element);
      result.current.selectFiles(fileList([pdf("replacement.pdf")]));
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    await act(async () => waiting.resolve({ status: "idle", uploadSession: session(1) }));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(put.mock.calls[0][2]).toBe(original);
    act(() => result.current.submit(element));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("reports stage progress and waits for each file before finalizing", async () => {
    const first = deferred<{ error: null }>();
    const second = deferred<{ error: null }>();
    put.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([pdf("first.pdf"), pdf("second.pdf")])));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(result.current.progressMessage).toBe("Uploading document 1 of 2.");
    expect(result.current.locked).toBe(true);
    expect(result.current.turnstileReset).toBe(0);
    expect(finalize).not.toHaveBeenCalled();
    await act(async () => first.resolve({ error: null }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(result.current.progressMessage).toBe("Uploading document 2 of 2.");
    expect(finalize).not.toHaveBeenCalled();
    await act(async () => second.resolve({ error: null }));
    await waitFor(() => expect(result.current.state.reference).toBe("CMG-TEST"));
  });

  it.each(["400", "409", "lost-response"])("lets finalization confirm an upload after %s", async (failure) => {
    if (failure === "lost-response") put.mockRejectedValueOnce(new Error("upload response lost"));
    else put.mockResolvedValueOnce({ error: { statusCode: failure, message: "Asset Already Exists" } });
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([pdf()])));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(put).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("retries a lost finalization response with the same session and no repeat upload", async () => {
    finalize.mockRejectedValueOnce(new Error("fixture-secret must not be shown"));
    const { result } = renderHook(useIntakeUpload);
    const element = form();
    act(() => result.current.selectFiles(fileList([pdf()])));
    act(() => result.current.submit(element));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.locked).toBe(true);
    expect(result.current.buttonLabel).toBe("Retry confirmation");
    expect(result.current.state.message).not.toContain("fixture-secret");
    expect(result.current.turnstileReset).toBe(0);
    const navigation = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(navigation);
    expect(navigation.defaultPrevented).toBe(true);
    act(() => result.current.submit(element));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(finalize.mock.calls).toEqual([
      ["fixture-session", "fixture-secret"], ["fixture-session", "fixture-secret"],
    ]);
    const completeNavigation = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(completeNavigation);
    expect(completeNavigation.defaultPrevented).toBe(false);
  });

  it("checks for a committed intake before retrying an uncertain file upload", async () => {
    put.mockRejectedValueOnce(new Error("upload may have arrived"));
    finalize.mockRejectedValueOnce(new Error("commit response lost"));
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([pdf()])));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("preserves server retry instructions while keeping the session locked", async () => {
    finalize.mockResolvedValueOnce({ status: "error", message: "Wait a few minutes before you retry." });
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state.message).toBe("Wait a few minutes before you retry.");
    expect(result.current.locked).toBe(true);
    expect(result.current.turnstileReset).toBe(0);
  });

  it("retries only unfinished uploads at their original paths", async () => {
    put.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "connection failed" } });
    finalize.mockResolvedValueOnce({ status: "error" }).mockResolvedValueOnce({ status: "error" });
    const files = [pdf("first.pdf"), pdf("second.pdf")];
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList(files)));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.buttonLabel).toBe("Retry upload");
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(put.mock.calls.map((call) => [call[0], call[1], call[2]])).toEqual([
      ["intake/fixture/0.pdf", "fixture-upload-0", files[0]],
      ["intake/fixture/1.pdf", "fixture-upload-1", files[1]],
      ["intake/fixture/1.pdf", "fixture-upload-1", files[1]],
    ]);
    expect(finalize).toHaveBeenCalledTimes(3);
  });

  it.each([undefined, false])("keeps expired sessions frozen without an explicit restart signal (%s)", async (restartAllowed) => {
    start.mockResolvedValue({ status: "idle", uploadSession: { ...session(0), expiresAt: "1970-01-01T00:00:00Z" } });
    finalize.mockResolvedValue({ status: "error", restartAllowed });
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.locked).toBe(true);
    act(() => result.current.submit(form()));
    await waitFor(() => expect(finalize).toHaveBeenCalledTimes(2));
    expect(start).toHaveBeenCalledTimes(1);
    expect(result.current.turnstileReset).toBe(0);
  });

  it("unlocks editing only after the server confirms restart is safe", async () => {
    finalize.mockResolvedValueOnce({ status: "error", restartAllowed: true });
    const file = pdf();
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([file])));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.locked).toBe(false);
    expect(result.current.turnstileReset).toBe(1);
    expect(result.current.buttonLabel).toBe("Submit intake");
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(start).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[1][2]).toBe(file);
  });

  it("does not upload bytes against an incomplete capability manifest", async () => {
    start.mockResolvedValue({ status: "idle", uploadSession: session(0) });
    finalize.mockResolvedValue({ status: "error" });
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([pdf()])));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(put).not.toHaveBeenCalled();
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(result.current.locked).toBe(true);
  });

  it("announces confirmation progress until the same session returns success", async () => {
    const second = deferred<IntakeFinalizeState>();
    const third = deferred<IntakeFinalizeState>();
    finalize.mockResolvedValueOnce({ status: "idle", pendingFiles: 2 })
      .mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise);
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([pdf("1.pdf"), pdf("2.pdf"), pdf("3.pdf")])));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(finalize).toHaveBeenCalledTimes(2));
    expect(result.current.progressMessage).toBe("Confirming your intake. 1 of 3 documents checked.");
    expect(result.current.state.status).toBe("idle");
    expect(result.current.pending).toBe(true);
    expect(result.current.locked).toBe(true);
    await act(async () => second.resolve({ status: "idle", pendingFiles: 1 }));
    await waitFor(() => expect(finalize).toHaveBeenCalledTimes(3));
    expect(result.current.progressMessage).toBe("Confirming your intake. 2 of 3 documents checked.");
    await act(async () => third.resolve({ status: "success", reference: "CMG-TEST" }));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(3);
    expect(finalize.mock.calls).toEqual(Array.from({ length: 3 }, () => ["fixture-session", "fixture-secret"]));
  });

  it("retries the same session without uploads after a timeout during confirmation progress", async () => {
    finalize.mockResolvedValueOnce({ status: "idle", pendingFiles: 1 })
      .mockRejectedValueOnce(new Error("test-only verification timeout"));
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([pdf("1.pdf"), pdf("2.pdf")])));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.locked).toBe(true);
    expect(result.current.turnstileReset).toBe(0);
    expect(result.current.buttonLabel).toBe("Retry confirmation");
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(2);
    expect(finalize.mock.calls).toEqual(Array.from({ length: 3 }, () => ["fixture-session", "fixture-secret"]));
  });

  it.each([undefined, null, 0, -1, 1.5, NaN, Infinity, "1", 2, 11])(
    "stops malformed confirmation progress without losing the session (%s)",
    async (pendingFiles) => {
      finalize.mockResolvedValue({ status: "idle", pendingFiles });
      const { result } = renderHook(useIntakeUpload);
      act(() => result.current.selectFiles(fileList([pdf("1.pdf"), pdf("2.pdf")])));
      act(() => result.current.submit(form()));
      await waitFor(() => expect(result.current.state.status).toBe("error"));
      expect(result.current.pending).toBe(false);
      expect(result.current.locked).toBe(true);
      expect(result.current.turnstileReset).toBe(0);
      expect(finalize).toHaveBeenCalledTimes(1);
      expect(put).toHaveBeenCalledTimes(2);
    },
  );

  it.each([2, 3])("stops a non-decreasing remaining count of %s after progress", async (pendingFiles) => {
    finalize.mockResolvedValueOnce({ status: "idle", pendingFiles: 2 })
      .mockResolvedValue({ status: "idle", pendingFiles });
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([pdf("1.pdf"), pdf("2.pdf"), pdf("3.pdf")])));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(finalize).toHaveBeenCalledTimes(2);
    expect(result.current.locked).toBe(true);
  });

  it("confirms all ten files with no more than ten calls", async () => {
    finalize.mockImplementation(async () => {
      const pendingFiles = 10 - finalize.mock.calls.length;
      return pendingFiles > 0 ? { status: "idle", pendingFiles }
        : { status: "success", reference: "CMG-TEST" };
    });
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList(Array.from({ length: 10 }, (_, index) => pdf(`${index}.pdf`)))));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(finalize).toHaveBeenCalledTimes(10);
    expect(put).toHaveBeenCalledTimes(10);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("does not repeat uncertain uploads when a retry reports stalled confirmation progress", async () => {
    put.mockResolvedValue({ error: { message: "upload response lost" } });
    finalize.mockResolvedValueOnce({ status: "error" })
      .mockResolvedValue({ status: "idle", pendingFiles: 2 });
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([pdf("1.pdf"), pdf("2.pdf"), pdf("3.pdf")])));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.state.status).toBe("error");
    expect(result.current.locked).toBe(true);
    expect(finalize).toHaveBeenCalledTimes(3);
    expect(put).toHaveBeenCalledTimes(3);
  });

  it("still allows a server-confirmed restart after intermediate progress", async () => {
    finalize.mockResolvedValueOnce({ status: "idle", pendingFiles: 1 })
      .mockResolvedValueOnce({ status: "error", restartAllowed: true });
    const { result } = renderHook(useIntakeUpload);
    act(() => result.current.selectFiles(fileList([pdf("1.pdf"), pdf("2.pdf")])));
    act(() => result.current.submit(form()));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.locked).toBe(false);
    expect(result.current.turnstileReset).toBe(1);
    expect(result.current.buttonLabel).toBe("Submit intake");
    expect(finalize).toHaveBeenCalledTimes(2);
  });
});
