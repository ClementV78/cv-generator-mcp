import { access } from "node:fs/promises";
import process from "node:process";
import { PDFDocument } from "pdf-lib";
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

const A4_PAGE_HEIGHT_PTS = 841.89;
const BREAK_TARGET_SHIFT_PTS = 72;
const MIN_FINAL_SLICE_HEIGHT_PTS = 150;

interface PaginatedSliceHints {
  estimatedContinuousHeightPts?: number;
  mainBreakOffsets?: number[];
  sidebarBreakOffsets?: number[];
}

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

const toUniqueSorted = (values: number[]): number[] => {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.round(value * 100) / 100)
    .sort((a, b) => a - b);
  const unique: number[] = [];
  for (const value of sorted) {
    if (unique.length === 0 || Math.abs(value - unique[unique.length - 1]!) > 1) {
      unique.push(value);
    }
  }
  return unique;
};

const nearestDistance = (values: number[], target: number): number => {
  if (values.length === 0) {
    return 0;
  }

  let best = Number.POSITIVE_INFINITY;
  for (const value of values) {
    const distance = Math.abs(value - target);
    if (distance < best) {
      best = distance;
    }
  }

  return best;
};

const computeSmartSliceBoundaries = (
  sourceHeight: number,
  hints: PaginatedSliceHints,
): number[] => {
  const estimatedHeight = hints.estimatedContinuousHeightPts;
  const scale =
    estimatedHeight && estimatedHeight > 0
      ? Math.min(1, sourceHeight / estimatedHeight)
      : 1;
  const mainBreakOffsets = toUniqueSorted(
    (hints.mainBreakOffsets ?? []).map((value) => value * scale),
  );
  const sidebarBreakOffsets = toUniqueSorted(
    (hints.sidebarBreakOffsets ?? []).map((value) => value * scale),
  );
  const allBreakOffsets = toUniqueSorted([...mainBreakOffsets, ...sidebarBreakOffsets]).filter(
    (value) => value > 0 && value < sourceHeight,
  );
  const boundaries: number[] = [0];
  let cursor = 0;

  while (sourceHeight - cursor > A4_PAGE_HEIGHT_PTS + 0.5) {
    const target = cursor + A4_PAGE_HEIGHT_PTS;
    let minAllowed = Math.max(
      cursor + 36,
      target - BREAK_TARGET_SHIFT_PTS,
    );
    const maxAllowed = Math.min(
      sourceHeight - MIN_FINAL_SLICE_HEIGHT_PTS,
      target,
    );
    const remainingSpan = sourceHeight - cursor;
    if (remainingSpan <= A4_PAGE_HEIGHT_PTS * 2 + 0.5) {
      minAllowed = Math.max(minAllowed, sourceHeight - A4_PAGE_HEIGHT_PTS);
    }
    let nextBoundary = target;

    if (allBreakOffsets.length > 0 && maxAllowed > minAllowed) {
      const candidates = allBreakOffsets.filter((value) => value >= minAllowed && value <= maxAllowed);
      if (candidates.length > 0) {
        const stronglyAlignedCandidates = candidates.filter(
          (candidate) =>
            nearestDistance(mainBreakOffsets, candidate) <= 18 &&
            nearestDistance(sidebarBreakOffsets, candidate) <= 24,
        );
        if (stronglyAlignedCandidates.length > 0) {
          nextBoundary = stronglyAlignedCandidates[stronglyAlignedCandidates.length - 1]!;
        } else {
          let bestScore = Number.POSITIVE_INFINITY;
          for (const candidate of candidates) {
            const targetDistance = Math.abs(candidate - target);
            const alignmentDistance = Math.max(
              nearestDistance(mainBreakOffsets, candidate),
              nearestDistance(sidebarBreakOffsets, candidate),
            );
            const score = targetDistance * 0.9 + alignmentDistance * 2.5;
            if (score < bestScore) {
              bestScore = score;
              nextBoundary = candidate;
            }
          }
        }
      }
    }

    nextBoundary = Math.max(nextBoundary, minAllowed);
    nextBoundary = Math.min(nextBoundary, sourceHeight - 1);
    if (nextBoundary <= cursor + 1) {
      nextBoundary = Math.min(sourceHeight, cursor + A4_PAGE_HEIGHT_PTS);
    }

    boundaries.push(nextBoundary);
    cursor = nextBoundary;
  }

  boundaries.push(sourceHeight);
  return toUniqueSorted(boundaries);
};

const paginatePdfToA4 = async (
  sourcePdf: Uint8Array,
  hints: PaginatedSliceHints = {},
): Promise<Uint8Array> => {
  const source = await PDFDocument.load(sourcePdf);
  const output = await PDFDocument.create();
  const sourcePages = source.getPages();

  for (const [sourcePageIndex, sourcePage] of sourcePages.entries()) {
    const sourceWidth = sourcePage.getWidth();
    const sourceHeight = sourcePage.getHeight();
    const boundaries =
      sourcePageIndex === 0
        ? computeSmartSliceBoundaries(sourceHeight, hints)
        : computeSmartSliceBoundaries(sourceHeight, {});

    for (let sliceIndex = 0; sliceIndex < boundaries.length - 1; sliceIndex += 1) {
      const startOffset = boundaries[sliceIndex]!;
      const endOffset = boundaries[sliceIndex + 1]!;
      const constrainedStartOffset = Math.max(startOffset, endOffset - A4_PAGE_HEIGHT_PTS);
      const top = sourceHeight - constrainedStartOffset;
      const bottom = sourceHeight - endOffset;
      const sliceHeight = endOffset - constrainedStartOffset;

      const embeddedSlice = await output.embedPage(sourcePage, {
        left: 0,
        right: sourceWidth,
        bottom,
        top,
      });

      const page = output.addPage([sourceWidth, A4_PAGE_HEIGHT_PTS]);
      page.drawPage(embeddedSlice, {
        x: 0,
        y: A4_PAGE_HEIGHT_PTS - sliceHeight,
        width: sourceWidth,
        height: sliceHeight,
      });
    }
  }

  return await output.save();
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
    const continuousMetrics = await measureCvLayout(data, "continuous");
    const paginatedMetrics = await measureCvLayout(data, "paginated");
    const estimatedHeightMm = Math.ceil((continuousMetrics.continuousHeight / 72) * 25.4);
    const paginatedGuardHeightMm =
      paginatedMetrics.pageCount <= 1
        ? 297
        : (paginatedMetrics.pageCount - 1) * 297 + 160;
    const continuousPageHeightMm = Math.max(297, estimatedHeightMm + 24, paginatedGuardHeightMm);

    const continuousPdf = await renderPdfWithVivliostyle({
      html,
      mode: "continuous",
      title: `${data.header.name} - CV`,
      outputFormat: resolvedOptions.format,
      timeoutMs: resolvedOptions.timeoutMs,
      browserExecutablePath: executablePath,
      continuousPageHeightMm,
    });

    if (resolvedOptions.mode === "continuous") {
      return continuousPdf;
    }

    return await paginatePdfToA4(continuousPdf, {
      estimatedContinuousHeightPts: continuousMetrics.continuousHeight,
      mainBreakOffsets: continuousMetrics.mainBreakOffsets,
      sidebarBreakOffsets: continuousMetrics.sidebarBreakOffsets,
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
