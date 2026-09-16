import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntakeForm } from "./intake-form";

const { start, finalize, put } = vi.hoisted(() => ({ start: vi.fn(), finalize: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/actions/intake", () => ({ submitIntake: start, finalizeIntakeUpload: finalize }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: put }) } }),
}));
vi.mock("./turnstile", () => ({
  TurnstileWidget: ({ resetOn }: { resetOn: number }) => (
    <div data-testid="verification" data-reset={resetOn}>
      <input type="hidden" name="cf-turnstile-response" value="test-only-verification" />
    </div>
  ),
}));

const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  start.mockImplementation(async (_state, data: FormData) => ({
    status: "idle",
    uploadSession: {
      id: "fixture-session", token: "fixture-token", expiresAt: "2026-08-31T02:00:00Z",
      uploads: JSON.parse(data.get("uploadManifest") as string).map((file: { mime: string }, index: number) => ({
        index, path: `intake/fixture/${index}.pdf`, token: `fixture-upload-${index}`, mime: file.mime,
      })),
    },
  }));
  finalize.mockResolvedValue({ status: "success", reference: "CMG-TEST" });
  put.mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

function details() {
  const firstName = screen.getByLabelText(/First name/) as HTMLInputElement;
  const documents = screen.getByLabelText(/Declarations page/) as HTMLInputElement;
  return { firstName, documents, form: firstName.closest("form")! };
}

describe("intake form direct upload", () => {
  it.each([false, true])("submits separate contractor details with files=%s", async (hasFile) => {
    render(<IntakeForm referralCode="40000000-0000-4000-a000-000000000001" />);
    const { firstName, documents, form } = details();
    expect(form.querySelector('[name="lossTime"]')).toBeNull();
    expect(form.querySelector('[name="lossDate"]')).not.toBeNull();
    expect(form.querySelector('[name="cause"]')).not.toBeNull();
    fireEvent.change(firstName, { target: { value: "Homeowner" } });
    const values = {
      contractorName: "Contractor", contractorCompany: "Test Roofing",
      contractorPhone: "4075550101", contractorEmail: "contractor@example.invalid",
    };
    for (const [name, value] of Object.entries(values)) {
      const field = form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
      expect(field.required).toBe(false);
      fireEvent.change(field, { target: { value } });
    }
    if (hasFile) fireEvent.change(documents, { target: { files: [new File(["scan"], "scan.pdf", { type: "application/pdf" })] } });
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByText("Intake received.")).toBeDefined());
    const payload = start.mock.calls[0][1] as FormData;
    expect(payload.get("firstName")).toBe("Homeowner");
    for (const [name, value] of Object.entries(values)) expect(payload.get(name)).toBe(value);
    expect(payload.has("lossTime")).toBe(false);
    expect(payload.get("vendorReferralCode")).toBe("40000000-0000-4000-a000-000000000001");
    expect(put).toHaveBeenCalledTimes(hasFile ? 1 : 0);
  });

  it("cannot submit form values before hydration and never uses a native GET", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<IntakeForm />);
    const form = container.querySelector("form")!;
    expect(form.method).toBe("post");
    expect(form.getAttribute("action")).toBeNull();
    expect(form.querySelector("button[type=submit]")?.hasAttribute("disabled")).toBe(true);
    expect(form.querySelector("input[name=firstName]")?.matches(":disabled")).toBe(true);
    expect(form.querySelector("input[type=file]")?.matches(":disabled")).toBe(true);
    expect(container.querySelector("noscript")?.textContent).toContain("Enable JavaScript");
  });

  it("retains typed values, radio choices, and selected files after a validation refusal", async () => {
    start.mockResolvedValueOnce({ status: "error", fieldErrors: { email: "Enter an email address." } });
    render(<IntakeForm />);
    const { firstName, documents, form } = details();
    const file = new File(["scan"], "scan.pdf", { type: "application/pdf" });
    fireEvent.change(firstName, { target: { value: "Test Homeowner" } });
    fireEvent.click(screen.getAllByRole("radio", { name: "Yes" })[0]);
    fireEvent.change(screen.getByLabelText(/Second person's first name/), { target: { value: "Second" } });
    fireEvent.change(documents, { target: { files: [file] } });
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("1 field"));
    expect(firstName.value).toBe("Test Homeowner");
    expect((screen.getByLabelText(/Second person's first name/) as HTMLInputElement).value).toBe("Second");
    expect(documents.files?.[0]).toBe(file);
    expect(firstName.matches(":disabled")).toBe(false);
    expect(document.activeElement).toBe(screen.getByLabelText(/^Email/));
    expect(screen.getByTestId("verification").getAttribute("data-reset")).toBe("1");
    const payload = start.mock.calls[0][1] as FormData;
    expect([...payload.values()].every((value) => typeof value === "string")).toBe(true);
    expect(payload.has("documents")).toBe(false);
    expect(payload.get("firstName")).toBe("Test Homeowner");
    expect(payload.get("secondFirstName")).toBe("Second");
  });

  it("announces progress, freezes details, and focuses retry and success feedback", async () => {
    let completeUpload!: (value: { error: null }) => void;
    put.mockReturnValueOnce(new Promise((resolve) => { completeUpload = resolve; }));
    finalize.mockRejectedValueOnce(new Error("test-only lost response"));
    render(<IntakeForm />);
    const { firstName, documents, form } = details();
    const file = new File(["scan"], "scan.pdf", { type: "application/pdf" });
    fireEvent.change(firstName, { target: { value: "Test" } });
    fireEvent.change(documents, { target: { files: [file] } });
    fireEvent.submit(form);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(firstName.matches(":disabled")).toBe(true);
    expect(documents.matches(":disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Uploading document 1 of 1");
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect((screen.getByRole("button", { name: "Uploading documents…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("verification").getAttribute("data-reset")).toBe("0");
    expect(screen.getByText(/Do not refresh this page/)).toBeDefined();

    await act(async () => completeUpload({ error: null }));
    await waitFor(() => expect(screen.getByRole("alert")).toBe(document.activeElement));
    expect(firstName.matches(":disabled")).toBe(true);
    const retry = screen.getByRole("button", { name: "Retry confirmation" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText("Intake received.")).toBeDefined());
    expect(screen.getByRole("status")).toBe(document.activeElement);
    expect(screen.getByText("CMG-TEST")).toBeDefined();
    expect(start).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(2);
  });

  it("returns focus to a correctable file error after a confirmed safe restart", async () => {
    finalize.mockResolvedValueOnce({ status: "error", restartAllowed: true, fieldErrors: { documents: "Select the document again." } });
    render(<IntakeForm />);
    const { firstName, documents, form } = details();
    fireEvent.change(firstName, { target: { value: "Test" } });
    fireEvent.change(documents, { target: { files: [new File(["scan"], "scan.pdf", { type: "application/pdf" })] } });
    fireEvent.submit(form);
    await waitFor(() => expect(document.activeElement).toBe(documents));
    expect(firstName.matches(":disabled")).toBe(false);
    expect(firstName.value).toBe("Test");
    expect(screen.getByTestId("verification").getAttribute("data-reset")).toBe("1");
    expect(screen.getByRole("button", { name: "Submit intake" })).toBeDefined();
  });
});
