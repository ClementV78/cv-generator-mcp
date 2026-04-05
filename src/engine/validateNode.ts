import { PAGE_HEIGHT_PX } from "../constants";
import type { CvData, ValidationIssue, ValidationResult } from "../types";
import { collectStructureMessages } from "../validation";
import { PdfRenderError, resolveBrowserExecutablePath } from "./renderPdf";
import { renderCvHtmlDocumentNode } from "./renderHtmlNode";
import { chromium, type Page } from "playwright-core";

export interface ValidateCvOptions {
  browserExecutablePath?: string;
  timeoutMs?: number;
  measureRender?: boolean;
}

const DEFAULT_VALIDATE_OPTIONS: Required<ValidateCvOptions> = {
  browserExecutablePath: "",
  timeoutMs: 15_000,
  measureRender: true,
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
});

export const validateCvStructure = (data: CvData): ValidationResult => ({
  pageCount: 1,
  issues: [],
  structureMessages: collectStructureMessages(data),
  pageLimitExceeded: false,
});

type BrowserValidationIssue = {
  id: string;
  message: string;
  targetBind?: string;
};

type BrowserValidationPayload = {
  pageCount: number;
  issues: BrowserValidationIssue[];
  pageLimitExceeded: boolean;
};

const BROWSER_VALIDATION_SCRIPT = `({ pageHeightPx, maxPagesLimit }) => {
  const getLineHeight = (element) => {
    const computed = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(computed.lineHeight);

    if (Number.isFinite(lineHeight)) {
      return lineHeight;
    }

    const fontSize = Number.parseFloat(computed.fontSize);
    return Number.isFinite(fontSize) ? fontSize * 1.4 : 20;
  };

  const countRenderedLines = (element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rawRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);

    if (typeof range.detach === "function") {
      range.detach();
    }

    if (rawRects.length > 0) {
      const sortedRects = rawRects.sort((left, right) => left.top - right.top);
      const uniqueLineTops = [];

      sortedRects.forEach((rect) => {
        const previousTop = uniqueLineTops.length > 0 ? uniqueLineTops[uniqueLineTops.length - 1] : undefined;

        if (previousTop === undefined || Math.abs(previousTop - rect.top) > 2) {
          uniqueLineTops.push(rect.top);
        }
      });

      if (uniqueLineTops.length > 0) {
        return uniqueLineTops.length;
      }
    }

    const lineHeight = getLineHeight(element);
    return Math.max(1, Math.round(element.scrollHeight / lineHeight));
  };

  const truncate = (value, maxLength = 42) => {
    if (value.length <= maxLength) {
      return value;
    }

    return value.slice(0, maxLength - 1).trimEnd() + "...";
  };

  const formatLineMessage = (label, maxLines, rawText) => {
    const lineWord = maxLines > 1 ? "lignes" : "ligne";
    const text = truncate(rawText.trim().replace(/\\s+/g, " "));

    if (!text) {
      return label + " depasse " + maxLines + " " + lineWord + ".";
    }

    return label + " \\"" + text + "\\" depasse " + maxLines + " " + lineWord + ".";
  };

  const issues = [];

  document.querySelectorAll("[data-max-lines]").forEach((element) => {
    const maxLines = Number(element.dataset.maxLines || 0);
    const label = element.dataset.label || "Bloc";
    const targetBind = element.dataset.validationId || element.dataset.bind || undefined;
    const lineCount = countRenderedLines(element);

    if (maxLines > 0 && lineCount > maxLines) {
      issues.push({
        id: (targetBind ?? label) + "-" + maxLines,
        message: formatLineMessage(label, maxLines, element.innerText || element.textContent || ""),
        targetBind,
      });
    }
  });

  const sheet = document.querySelector(".cv-sheet");
  const pageCount = sheet ? Math.max(1, Math.ceil(sheet.scrollHeight / pageHeightPx)) : 1;
  const pageLimitExceeded = typeof maxPagesLimit === "number" ? pageCount > maxPagesLimit : false;

  if (pageLimitExceeded) {
    issues.push({
      id: "page-limit-" + maxPagesLimit,
      message: "Le rendu depasse la limite de " + maxPagesLimit + " pages.",
    });
  }

  return {
    pageCount,
    issues,
    pageLimitExceeded,
  };
}`;

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

  const executablePath = await resolveBrowserExecutablePath(resolvedOptions.browserExecutablePath);

  if (!executablePath) {
    throw new CvValidationError(
      "browser_not_found",
      "Aucun navigateur Chromium/Chrome compatible n'a ete trouve pour mesurer le rendu du CV.",
    );
  }

  const html = await renderCvHtmlDocumentNode(data);
  const maxPages = data.render.maxPages;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
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

    const payload = (await page.evaluate(
      ({ script, params }) => {
        const validator = new Function(`return (${script});`)() as (input: {
          pageHeightPx: number;
          maxPagesLimit?: number;
        }) => BrowserValidationPayload;
        return validator(params);
      },
      {
        script: BROWSER_VALIDATION_SCRIPT,
        params: {
          pageHeightPx: PAGE_HEIGHT_PX,
          maxPagesLimit: maxPages ?? undefined,
        },
      },
    )) as BrowserValidationPayload;

    return {
      pageCount: payload.pageCount,
      issues: payload.issues as ValidationIssue[],
      structureMessages,
      pageLimitExceeded: payload.pageLimitExceeded,
    };
  } catch (error) {
    if (error instanceof PdfRenderError || error instanceof CvValidationError) {
      throw error;
    }

    throw new CvValidationError("render_validation_failed", "La validation de rendu a echoue.", {
      cause: error,
    });
  } finally {
    await page?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
};

export const validateCv = async (
  input: CvData,
  options: ValidateCvOptions = {},
): Promise<ValidationResult> => validateCvRender(input, options);
