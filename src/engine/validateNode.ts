import type { CvData, ValidationResult } from "../types";
import { collectStructureMessages } from "../validation";
import { measureCvLayout, type PdfMode } from "./pdfLayout";

export interface ValidateCvOptions {
  browserExecutablePath?: string;
  timeoutMs?: number;
  measureRender?: boolean;
  pdfMode?: PdfMode;
}

const DEFAULT_VALIDATE_OPTIONS: Required<ValidateCvOptions> = {
  browserExecutablePath: "",
  timeoutMs: 15_000,
  measureRender: true,
  pdfMode: "paginated",
};

export class CvValidationError extends Error {
  readonly code: string;
  cause?: unknown;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "CvValidationError";
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export const resolveValidateOptions = (
  options: ValidateCvOptions = {},
): Required<ValidateCvOptions> => ({
  browserExecutablePath: options.browserExecutablePath ?? DEFAULT_VALIDATE_OPTIONS.browserExecutablePath,
  timeoutMs: options.timeoutMs ?? DEFAULT_VALIDATE_OPTIONS.timeoutMs,
  measureRender: options.measureRender ?? DEFAULT_VALIDATE_OPTIONS.measureRender,
  pdfMode: options.pdfMode ?? DEFAULT_VALIDATE_OPTIONS.pdfMode,
});

export const validateCvStructure = (data: CvData): ValidationResult => ({
  pageCount: 1,
  issues: [],
  structureMessages: collectStructureMessages(data),
  pageLimitExceeded: false,
});

export const validateCvRender = async (
  data: CvData,
  options: ValidateCvOptions = {},
): Promise<ValidationResult> => {
  const resolvedOptions = resolveValidateOptions(options);
  const structureMessages = collectStructureMessages(data);

  if (!resolvedOptions.measureRender) {
    return {
      pageCount: 1,
      issues: [],
      structureMessages,
      pageLimitExceeded: false,
    };
  }

  try {
    const metrics = await measureCvLayout(data, resolvedOptions.pdfMode);
    return {
      pageCount: metrics.pageCount,
      issues: metrics.issues,
      structureMessages,
      pageLimitExceeded: metrics.pageLimitExceeded,
    };
  } catch (error) {
    throw new CvValidationError("render_validation_failed", "La validation de rendu a echoue.", {
      cause: error,
    });
  }
};

export const validateCv = async (
  input: CvData,
  options: ValidateCvOptions = {},
): Promise<ValidationResult> => validateCvRender(input, options);
