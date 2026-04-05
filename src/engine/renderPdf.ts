import { access } from "node:fs/promises";
import process from "node:process";
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

const WINDOWS_CHROMIUM_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Chromium\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe",
];

const LINUX_CHROMIUM_PATHS = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
];

const MAC_CHROMIUM_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

const BROWSER_ENV_KEYS = [
  "CV_BROWSER_EXECUTABLE_PATH",
  "BROWSER_EXECUTABLE_PATH",
  "PUPPETEER_EXECUTABLE_PATH",
  "CHROME_PATH",
] as const;

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

const hasAccess = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const resolveBrowserExecutablePath = async (
  preferredPath?: string,
): Promise<string | undefined> => {
  const fromEnvironment = BROWSER_ENV_KEYS.map((key) => process.env[key]).find(
    (value): value is string => Boolean(value && value.trim()),
  );

  const platformCandidates =
    process.platform === "win32"
      ? WINDOWS_CHROMIUM_PATHS
      : process.platform === "darwin"
        ? MAC_CHROMIUM_PATHS
        : LINUX_CHROMIUM_PATHS;

  const candidates = [preferredPath, fromEnvironment, ...platformCandidates]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim());

  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);

    if (await hasAccess(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

export const renderCvPdfFromHtml = async (
  html: string,
  options: RenderPdfOptions = {},
): Promise<Uint8Array> => {
  try {
    const resolvedOptions = resolvePdfOptions(options);
    const executablePath = await resolveBrowserExecutablePath(resolvedOptions.browserExecutablePath);

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
      browserExecutablePath: executablePath,
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
    const executablePath = await resolveBrowserExecutablePath(resolvedOptions.browserExecutablePath);
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
      browserExecutablePath: executablePath,
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
