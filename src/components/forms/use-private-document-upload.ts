"use client";

import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { idleState, type FormState } from "@/lib/actions/types";
import { MAX_FILES } from "@/lib/validators/files";
import {
  privateFinalizeData, privateUploadStartData, privateUploadsMatchFiles, uploadPrivateFile,
  type PrivateFinalizeState, type PrivatePrepareState, type PrivateUploadSession,
} from "./private-upload-client";

type Attempt = { session: PrivateUploadSession; files: File[]; uploaded: Set<number> };
type Phase = "idle" | "preparing" | "uploading" | "finalizing";
type PrepareAction = (previous: FormState, data: FormData) => Promise<PrivatePrepareState>;
type FinalizeAction = (formData: FormData) => Promise<PrivateFinalizeState>;

const PREPARE_ERROR = "We could not prepare this upload. Your choices and files remain here. Please try again.";
const RETRY_ERROR = "We could not confirm this upload. Keep this page open and retry.";
const RESTART_ERROR = "This upload session has ended. Check the details and submit again.";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function usePrivateDocumentUpload(
  prepare: PrepareAction,
  finalize: FinalizeAction,
  idleButtonLabel: string,
) {
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [state, setState] = useState<FormState>(idleState);
  const [phase, setPhase] = useState<Phase>("idle");
  const [locked, setLocked] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, current: 0 });
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const attemptRef = useRef<Attempt | null>(null);
  const filesRef = useRef<File[]>([]);
  const formRef = useRef<HTMLFormElement | null>(null);
  const inFlight = useRef(false);
  const received = useRef(false);

  useEffect(() => {
    if (!locked) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [locked]);

  function selectFiles(files: FileList | null) {
    if (!inFlight.current && !attemptRef.current) {
      filesRef.current = Array.from(files ?? []);
      received.current = false;
    }
  }

  function finish(result: PrivateFinalizeState) {
    if (result.status === "success") {
      received.current = true;
      attemptRef.current = null;
      filesRef.current = [];
      const fileInput = formRef.current?.querySelector<HTMLInputElement>('input[type="file"][name="files"]');
      if (fileInput) fileInput.value = "";
      setLocked(false);
      setState(result);
      return true;
    }
    if (result.restartAllowed === true) {
      attemptRef.current = null;
      setLocked(false);
      setProgress({ completed: 0, total: 0, current: 0 });
      setState({ ...result, status: "error", message: result.message ?? RESTART_ERROR });
      return true;
    }
    setState({ status: "error", message: result.message ?? RETRY_ERROR });
    return false;
  }

  async function confirm(attempt: Attempt) {
    setPhase("finalizing");
    setConfirmed(null);
    let remaining = attempt.files.length;
    for (let index = 0; index < MAX_FILES; index += 1) {
      const result = await finalize(privateFinalizeData(attempt.session));
      if (result.status !== "idle") return result;
      const pending = result.pendingFiles;
      if (typeof pending !== "number" || !Number.isInteger(pending) || pending <= 0 || pending > remaining) {
        throw new Error("Invalid document confirmation progress");
      }
      if (pending === remaining) return result;
      remaining = pending;
      setConfirmed(attempt.files.length - remaining);
    }
    throw new Error("Document confirmation request limit reached");
  }

  async function continueAttempt(attempt: Attempt, retry: boolean) {
    if (retry) {
      const result = await confirm(attempt);
      const canUploadMissing = result.status === "idle" &&
        typeof result.pendingFiles === "number" && attempt.uploaded.size < attempt.files.length;
      if (!canUploadMissing) {
        if (finish(result) || attempt.uploaded.size === attempt.files.length) return;
      }
      setState(idleState);
    }
    if (privateUploadsMatchFiles(attempt.session, attempt.files)) {
      for (const upload of attempt.session.uploads) {
        if (attempt.uploaded.has(upload.index)) continue;
        setPhase("uploading");
        setProgress({ completed: attempt.uploaded.size, total: attempt.files.length, current: upload.index + 1 });
        if (await uploadPrivateFile(upload, attempt.files[upload.index])) attempt.uploaded.add(upload.index);
        setProgress((current) => ({ ...current, completed: attempt.uploaded.size }));
      }
    }
    finish(await confirm(attempt));
  }

  function submit(form: HTMLFormElement) {
    if (!ready || inFlight.current || received.current) return;
    const existing = attemptRef.current;
    formRef.current = form;
    const prepared = existing ? null : privateUploadStartData(new FormData(form), filesRef.current);
    if (prepared && !prepared.ok) {
      setState({ status: "error", fieldErrors: { files: prepared.message } });
      return;
    }
    inFlight.current = true;
    setState(idleState);
    setPhase(existing ? "finalizing" : "preparing");
    startTransition(async () => {
      try {
        if (existing) { await continueAttempt(existing, true); return; }
        if (!prepared?.ok) return;
        const result = await prepare(idleState, prepared.payload);
        if (result.status !== "idle" || !result.uploadSession) {
          setState(result.status === "error" ? result : { status: "error", message: PREPARE_ERROR });
          return;
        }
        const attempt = { session: result.uploadSession, files: prepared.files, uploaded: new Set<number>() };
        attemptRef.current = attempt;
        setLocked(true);
        setProgress({ completed: 0, total: attempt.files.length, current: 0 });
        await continueAttempt(attempt, false);
      } catch {
        setState({ status: "error", message: attemptRef.current ? RETRY_ERROR : PREPARE_ERROR });
      } finally {
        inFlight.current = false;
        setPhase("idle");
      }
    });
  }

  const pending = phase !== "idle";
  const retryUploads = locked && progress.completed < progress.total;
  const buttonLabel = phase === "preparing" ? "Preparing upload…"
    : phase === "uploading" ? "Uploading documents…"
    : phase === "finalizing" ? "Confirming upload…"
    : locked ? (retryUploads ? "Retry upload" : "Retry confirmation") : idleButtonLabel;
  const progressMessage = phase === "preparing" ? "Preparing your upload."
    : phase === "uploading" ? `Uploading document ${progress.current} of ${progress.total}.`
    : phase === "finalizing" ? (confirmed === null ? "Confirming your upload."
      : `Confirming your upload. ${confirmed} of ${progress.total} documents checked.`)
    : locked ? `${progress.completed} of ${progress.total} documents uploaded.` : "";
  return { state, ready, pending, locked, buttonLabel, progressMessage, selectFiles, submit };
}
