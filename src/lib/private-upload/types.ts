import type { FormState } from "@/lib/actions/types";

export type PrivateUploadSession = {
  id: string;
  token: string;
  expiresAt: string;
  uploads: Array<{ index: number; path: string; token: string; mime: string }>;
};

export type PrivatePrepareState = FormState & { uploadSession?: PrivateUploadSession };
export type PrivateFinalizeState = FormState & { pendingFiles?: number; restartAllowed?: boolean };
