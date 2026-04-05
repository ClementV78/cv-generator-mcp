import { access } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright-core";
import type { CvData } from "../types";
import { renderCvHtmlDocumentNode } from "./renderHtmlNode";

export type PdfMode = "paginated" | "continuous";

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
  timeoutMs: 15_000,
};

const WINDOWS_CHROMIUM_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Chromium\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe",
];

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

const hasAccess = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const resolveBrowserExecutablePath = async (
  preferredPath?: string,
): Promise<string | undefined> => {
  if (preferredPath && preferredPath.trim()) {
    return (await hasAccess(preferredPath)) ? preferredPath : undefined;
  }

  const candidatePaths = WINDOWS_CHROMIUM_PATHS.filter((value): value is string => Boolean(value && value.trim()));

  for (const candidate of candidatePaths) {
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
  const resolvedOptions = resolvePdfOptions(options);
  const executablePath = await resolveBrowserExecutablePath(resolvedOptions.browserExecutablePath);

  if (!executablePath) {
    throw new PdfRenderError(
      "browser_not_found",
      "Aucun navigateur Chromium/Chrome compatible n'a ete trouve pour generer le PDF.",
    );
  }

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      executablePath,
      headless: true,
      timeout: resolvedOptions.timeoutMs,
    });

    page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "load",
      timeout: resolvedOptions.timeoutMs,
    });
    await page.emulateMedia({ media: "print" });

    const pdfBuffer =
      resolvedOptions.mode === "continuous"
        ? await page.pdf({
            width: "210mm",
            height: `${await page.evaluate(() => {
              const body = document.body;
              const htmlElement = document.documentElement;
              const sheet = document.querySelector<HTMLElement>(".cv-sheet");
              const measuredHeight = Math.max(
                body?.scrollHeight ?? 0,
                body?.offsetHeight ?? 0,
                htmlElement?.scrollHeight ?? 0,
                htmlElement?.offsetHeight ?? 0,
                sheet?.scrollHeight ?? 0,
                sheet?.offsetHeight ?? 0,
              );
              return Math.max(1, Math.ceil(measuredHeight + 24));
            })}px`,
            printBackground: resolvedOptions.printBackground,
            preferCSSPageSize: false,
            margin: {
              top: "0",
              right: "0",
              bottom: "0",
              left: "0",
            },
          })
        : await page.pdf({
            format: resolvedOptions.format,
            printBackground: resolvedOptions.printBackground,
            preferCSSPageSize: resolvedOptions.preferCSSPageSize,
            margin: resolvedOptions.margin,
          });

    return new Uint8Array(pdfBuffer);
  } catch (error) {
    throw new PdfRenderError("pdf_render_failed", "La generation du PDF a echoue.", {
      cause: error,
    });
  } finally {
    await page?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
};

export const renderCvPdf = async (
  data: CvData,
  options: RenderPdfOptions = {},
): Promise<Uint8Array> => {
  const html = await renderCvHtmlDocumentNode(data);
  return renderCvPdfFromHtml(html, options);
};
