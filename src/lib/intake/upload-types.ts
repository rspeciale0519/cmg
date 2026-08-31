import type { FormState } from "@/lib/actions/types";

export type IntakeUploadSession = {
  id: string;
  token: string;
  expiresAt: string;
  uploads: Array<{ index: number; path: string; token: string; mime: string }>;
};

export type IntakeStartState = FormState & { uploadSession?: IntakeUploadSession };
export type IntakeFinalizeState = FormState & { restartAllowed?: boolean; pendingFiles?: number };

export type IntakeFileMetadata = {
  name: string;
  size: number;
  mime: string;
};
