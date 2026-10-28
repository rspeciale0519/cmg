import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormState } from "@/lib/actions/types";
import type { PrivateUploadSession } from "./private-upload-client";
import type { PrivatePrepareState } from "./private-upload-client";
import { usePrivateDocumentUpload } from "./use-private-document-upload";

const { put } = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: put }) } }),
}));

function pdf(name: string) {
  return new File(["test document"], name, { type: "application/pdf" });
}

function fileList(files: File[]): FileList {
  return Object.assign(files, { item: (index: number) => files[index] ?? null });
}

function session(count: number): PrivateUploadSession {
  return {
    id: "fixture-session", token: "fixture-session-token", expiresAt: "2026-09-27T12:00:00Z",
    uploads: Array.from({ length: count }, (_, index) => ({
      index, path: `private/fixture/${index}.pdf`, token: `fixture-upload-${index}`, mime: "application/pdf",
    })),
  };
}

function form() {
  const element = document.createElement("form");
  element.innerHTML = '<input name="claimId" value="claim-1"><select name="kind"><option value="photo" selected>Photo</option></select>';
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.name = "files";
  element.append(fileInput);
  return element;
}

beforeEach(() => {
  vi.resetAllMocks();
  put.mockResolvedValue({ error: null });
});
afterEach(cleanup);

describe("private document upload state", () => {
  it("uploads missing files after confirmation reports no progress", async () => {
    put.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "response lost" } })
      .mockResolvedValueOnce({ error: null });
    const prepare = vi.fn(async (_previous: FormState, data: FormData): Promise<PrivatePrepareState> => ({
      status: "idle" as const,
      uploadSession: session(JSON.parse(String(data.get("uploadManifest"))).length),
    }));
    const finalize = vi.fn()
      .mockResolvedValueOnce({ status: "idle", pendingFiles: 2 })
      .mockResolvedValueOnce({ status: "idle", pendingFiles: 2 })
      .mockResolvedValueOnce({ status: "success" });
    const { result } = renderHook(() => usePrivateDocumentUpload(prepare, finalize, "Send to CMG"));
    const selected = [pdf("one.pdf"), pdf("two.pdf")];
    const element = form();
    act(() => result.current.selectFiles(fileList(selected)));
    act(() => result.current.submit(element));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.locked).toBe(true);
    act(() => result.current.submit(element));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(3);
    expect(finalize.mock.calls.map(([data]) => [data.get("id"), data.get("token")])).toEqual([
      ["fixture-session", "fixture-session-token"],
      ["fixture-session", "fixture-session-token"],
      ["fixture-session", "fixture-session-token"],
    ]);
    expect(put).toHaveBeenCalledTimes(3);
    expect(put.mock.calls.map((call) => call[0])).toEqual([
      "private/fixture/0.pdf", "private/fixture/1.pdf", "private/fixture/1.pdf",
    ]);
  });

  it("retries a lost finalization response without uploading the file again", async () => {
    const prepare = vi.fn(async () => ({ status: "idle" as const, uploadSession: session(1) }));
    const finalize = vi.fn()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({ status: "success" });
    const { result } = renderHook(() => usePrivateDocumentUpload(prepare, finalize, "Send to CMG"));
    const element = form();
    act(() => result.current.selectFiles(fileList([pdf("one.pdf")])));
    act(() => result.current.submit(element));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.locked).toBe(true);
    act(() => result.current.submit(element));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(2);
    expect(finalize.mock.calls.map(([data]) => [data.get("id"), data.get("token")])).toEqual([
      ["fixture-session", "fixture-session-token"],
      ["fixture-session", "fixture-session-token"],
    ]);
  });
  it("allows another upload after success on the same mounted form", async () => {
    const prepare = vi.fn(async () => ({ status: "idle" as const, uploadSession: session(1) }));
    const finalize = vi.fn(async () => ({ status: "success" as const }));
    const { result } = renderHook(() => usePrivateDocumentUpload(prepare, finalize, "Add to the file"));
    const element = form();
    act(() => result.current.selectFiles(fileList([pdf("first.pdf")])));
    act(() => result.current.submit(element));
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    act(() => result.current.selectFiles(fileList([pdf("second.pdf")])));
    act(() => result.current.submit(element));
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(finalize).toHaveBeenCalledTimes(2));
    expect(result.current.state.status).toBe("success");
    expect(put).toHaveBeenCalledTimes(2);
  });
});
