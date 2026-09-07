"use client";

import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { finalizeIntakeUpload, submitIntake } from "@/lib/actions/intake";
import { idleState, type FormState } from "@/lib/actions/types";
import type { IntakeFinalizeState, IntakeUploadSession } from "@/lib/intake/upload-types";
import { MAX_FILES } from "@/lib/validators/files";
import { intakeStartData, intakeUploadsMatchFiles, uploadIntakeFile } from "./intake-upload-client";

type Phase = "idle" | "preparing" | "uploading" | "finalizing";
type Attempt = { session: IntakeUploadSession; files: File[]; uploaded: Set<number> };

const PREPARE_ERROR =
  "We could not prepare your intake. Your form and selected files remain here. Please try again.";
const RETRY_ERROR =
  "We could not confirm your intake. Keep this tab open and use the retry button. Your form and selected files remain here.";
const RESTART_ERROR =
  "This upload session has ended. Your form and selected files remain here. Check the details and submit again.";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function useIntakeUpload() {
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [state, setState] = useState<FormState>(idleState);
  const [phase, setPhase] = useState<Phase>("idle");
  const [locked, setLocked] = useState(false);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [progress, setProgress] = useState({ completed: 0, total: 0, current: 0 });
  const [confirmedFiles, setConfirmedFiles] = useState<number | null>(null);
  const attemptRef = useRef<Attempt | null>(null);
  const filesRef = useRef<File[]>([]);
  const inFlight = useRef(false);
  const received = useRef(false);

  useEffect(() => {
    if (!locked) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [locked]);

  function selectFiles(files: FileList | null) {
    if (inFlight.current || attemptRef.current || received.current) return;
    filesRef.current = Array.from(files ?? []);
  }

  function finish(result: IntakeFinalizeState) {
    if (result.status === "success") {
      received.current = true;
      attemptRef.current = null;
      filesRef.current = [];
      setLocked(false);
      setState(result);
      return true;
    }
    if (result.restartAllowed === true) {
      attemptRef.current = null;
      setLocked(false);
      setProgress({ completed: 0, total: 0, current: 0 });
      setTurnstileReset((value) => value + 1);
      setState({ ...result, status: "error", message: result.message ?? RESTART_ERROR });
      return true;
    }
    // Frozen fields cannot be corrected. Keep retry guidance in the focused alert.
    setState({ status: "error", message: result.message ?? RETRY_ERROR });
    return false;
  }

  async function finalize(attempt: Attempt) {
    setPhase("finalizing");
    setConfirmedFiles(null);
    let remaining = attempt.files.length;
    for (let request = 0; request < MAX_FILES; request += 1) {
      const result = await finalizeIntakeUpload(attempt.session.id, attempt.session.token);
      if (result.status !== "idle") return result;

      const pending = result.pendingFiles;
      if (typeof pending !== "number" || !Number.isInteger(pending) || pending <= 0 || pending >= remaining) {
        // Abort this attempt without falling through to another upload round.
        throw new Error("Intake confirmation progress is invalid");
      }
      remaining = pending;
      setConfirmedFiles(attempt.files.length - remaining);
    }
    throw new Error("Intake confirmation request limit reached");
  }

  async function continueAttempt(attempt: Attempt, retry: boolean) {
    if (retry) {
      // The last request may already have committed. Check before sending more bytes.
      const result = await finalize(attempt);
      if (finish(result) || attempt.uploaded.size === attempt.files.length) return;
      setState(idleState);
    }

    if (intakeUploadsMatchFiles(attempt.session, attempt.files)) {
      for (const upload of attempt.session.uploads) {
        if (attempt.uploaded.has(upload.index)) continue;
        setPhase("uploading");
        setProgress({
          completed: attempt.uploaded.size,
          total: attempt.files.length,
          current: upload.index + 1,
        });
        if (await uploadIntakeFile(upload, attempt.files[upload.index])) {
          attempt.uploaded.add(upload.index);
        }
        setProgress((previous) => ({ ...previous, completed: attempt.uploaded.size }));
      }
    }
    // A conflict or lost upload response can still mean every file arrived.
    finish(await finalize(attempt));
  }

  function submit(form: HTMLFormElement) {
    if (!ready || inFlight.current || received.current) return;

    const existing = attemptRef.current;
    // Read values before React disables the fieldset. Disabled controls are omitted.
    const prepared = existing ? null : intakeStartData(new FormData(form), filesRef.current);
    if (prepared && !prepared.ok) {
      setState({ status: "error", fieldErrors: { documents: prepared.message } });
      return;
    }

    inFlight.current = true;
    setState(idleState);
    setPhase(existing ? "finalizing" : "preparing");
    startTransition(async () => {
      try {
        if (existing) {
          await continueAttempt(existing, true);
          return;
        }
        if (!prepared?.ok) return;
        const result = await submitIntake(idleState, prepared.payload);
        if (result.status === "success") {
          finish(result);
          return;
        }
        if (result.status !== "idle" || !result.uploadSession) {
          setState(result.status === "error" ? result : { status: "error", message: PREPARE_ERROR });
          setTurnstileReset((value) => value + 1);
          return;
        }

        const attempt: Attempt = {
          session: result.uploadSession,
          files: prepared.files,
          uploaded: new Set(),
        };
        attemptRef.current = attempt;
        setLocked(true);
        setProgress({ completed: 0, total: attempt.files.length, current: 0 });
        await continueAttempt(attempt, false);
      } catch {
        setState({ status: "error", message: attemptRef.current ? RETRY_ERROR : PREPARE_ERROR });
        if (!attemptRef.current) setTurnstileReset((value) => value + 1);
      } finally {
        inFlight.current = false;
        setPhase("idle");
      }
    });
  }

  const pending = phase !== "idle";
  const retryUploads = locked && progress.completed < progress.total;
  const buttonLabel = phase === "preparing" ? "Preparing intake…"
    : phase === "uploading" ? "Uploading documents…"
    : phase === "finalizing" ? "Confirming intake…"
    : locked ? (retryUploads ? "Retry upload" : "Retry confirmation") : "Submit intake";
  const progressMessage = phase === "preparing" ? "Preparing your intake for upload."
    : phase === "uploading" ? `Uploading document ${progress.current} of ${progress.total}.`
    : phase === "finalizing" ? (confirmedFiles === null ? "Confirming your intake."
      : `Confirming your intake. ${confirmedFiles} of ${progress.total} documents checked.`)
    : locked ? `${progress.completed} of ${progress.total} documents uploaded.` : "";

  return {
    state, pending, locked, ready, turnstileReset, buttonLabel, progressMessage,
    selectFiles, submit,
  };
}
