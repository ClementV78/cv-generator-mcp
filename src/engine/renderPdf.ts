import type { CvData } from "../types";
import { measureCvLayout, type PdfMode } from "./pdfLayout";
import { renderCvHtmlDocumentNode } from "./renderHtmlNode";
import { renderPdfWithVivliostyle, VivliostyleRenderError } from "./vivliostyle";

export type { PdfMode };

export interface RenderPdfOptions {
  mode?: PdfMode;
  format?: "A4";
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
  margin?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  browserExecutablePath?: string;
  timeoutMs?: number;
}

const DEFAULT_PDF_OPTIONS: Required<RenderPdfOptions> = {
  mode: "paginated",
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: {
    top: "8mm",
    right: "8mm",
    bottom: "8mm",
    left: "8mm",
  },
  browserExecutablePath: "",
  timeoutMs: 120_000,
};

export class PdfRenderError extends Error {
  readonly code: string;
  cause?: unknown;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "PdfRenderError";
    this.code = code;
    this.cause = options?.cause;
  }
}

export const resolvePdfOptions = (options: RenderPdfOptions = {}): Required<RenderPdfOptions> => ({
  mode: options.mode ?? DEFAULT_PDF_OPTIONS.mode,
  format: options.format ?? DEFAULT_PDF_OPTIONS.format,
  printBackground: options.printBackground ?? DEFAULT_PDF_OPTIONS.printBackground,
  preferCSSPageSize: options.preferCSSPageSize ?? DEFAULT_PDF_OPTIONS.preferCSSPageSize,
  margin: options.margin ?? DEFAULT_PDF_OPTIONS.margin,
  browserExecutablePath: options.browserExecutablePath ?? DEFAULT_PDF_OPTIONS.browserExecutablePath,
  timeoutMs: options.timeoutMs ?? DEFAULT_PDF_OPTIONS.timeoutMs,
});

export const renderCvPdfFromHtml = async (
  html: string,
  options: RenderPdfOptions = {},
): Promise<Uint8Array> => {
  try {
    const resolvedOptions = resolvePdfOptions(options);

    if (resolvedOptions.mode === "continuous") {
      throw new PdfRenderError(
        "html_pdf_continuous_not_supported",
        "Le rendu PDF continu requiert des metriques calculees a partir de CvData.",
      );
    }

    return await renderPdfWithVivliostyle({
      html,
      mode: resolvedOptions.mode,
      outputFormat: resolvedOptions.format,
      timeoutMs: resolvedOptions.timeoutMs,
      browserExecutablePath: resolvedOptions.browserExecutablePath,
    });
  } catch (error) {
    if (error instanceof PdfRenderError) {
      throw error;
    }

    if (error instanceof VivliostyleRenderError) {
      throw new PdfRenderError(error.code, error.message, { cause: error.cause });
    }

    throw new PdfRenderError("pdf_render_failed", "La generation du PDF a echoue.", {
      cause: error,
    });
  }
};

export const renderCvPdf = async (
  data: CvData,
  options: RenderPdfOptions = {},
): Promise<Uint8Array> => {
  try {
    const resolvedOptions = resolvePdfOptions(options);
    const html = await renderCvHtmlDocumentNode(data);
    const metrics =
      resolvedOptions.mode === "continuous"
        ? await measureCvLayout(data, "continuous")
        : null;

    return await renderPdfWithVivliostyle({
      html,
      mode: resolvedOptions.mode,
      title: `${data.header.name} - CV`,
      outputFormat: resolvedOptions.format,
      timeoutMs: resolvedOptions.timeoutMs,
      browserExecutablePath: resolvedOptions.browserExecutablePath,
      continuousPageHeightMm:
        metrics === null ? undefined : Math.max(297, Math.ceil((metrics.continuousHeight / 72) * 25.4)),
    });
  } catch (error) {
    if (error instanceof PdfRenderError) {
      throw error;
    }

    if (error instanceof VivliostyleRenderError) {
      throw new PdfRenderError(error.code, error.message, { cause: error.cause });
    }

    throw new PdfRenderError("pdf_render_failed", "La generation du PDF a echoue.", {
      cause: error,
    });
  }
};
