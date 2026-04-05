import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "@vivliostyle/cli";
import { createTempWorkspace, removeTempWorkspace } from "./output";

export interface VivliostylePdfOptions {
  html: string;
  mode: "paginated" | "continuous";
  title?: string;
  outputFormat?: "A4";
  timeoutMs?: number;
  browserExecutablePath?: string;
  continuousPageHeightMm?: number;
}

export class VivliostyleRenderError extends Error {
  readonly code: string;
  cause?: unknown;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "VivliostyleRenderError";
    this.code = code;
    this.cause = options?.cause;
  }
}

const injectHeadStyle = (html: string, styleContent: string): string => {
  const injection = `<style>${styleContent}</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${injection}</head>`);
  }

  return `${html}${injection}`;
};

const toPdfPageSize = (options: VivliostylePdfOptions): string => {
  if (options.mode === "continuous") {
    if (!options.continuousPageHeightMm) {
      throw new VivliostyleRenderError(
        "continuous_height_required",
        "Le rendu PDF continu avec Vivliostyle requiert une hauteur de page explicite.",
      );
    }

    return `210mm,${options.continuousPageHeightMm}mm`;
  }

  return options.outputFormat ?? "A4";
};

const withContinuousPdfOverrides = (html: string): string =>
  injectHeadStyle(
    html,
    [
      "@page {",
      "  margin: 0;",
      "}",
      "html, body {",
      "  margin: 0;",
      "  padding: 0;",
      "}",
      "body {",
      "  background: #ffffff;",
      "}",
      ".cv-sheet {",
      "  margin: 0 auto;",
      "  box-shadow: none !important;",
      "}",
    ].join("\n"),
  );

export const renderPdfWithVivliostyle = async (
  options: VivliostylePdfOptions,
): Promise<Uint8Array> => {
  const workspacePath = await createTempWorkspace("vivliostyle");
  const htmlPath = path.join(workspacePath, "cv-document.html");
  const pdfPath = path.join(workspacePath, "cv-document.pdf");
  const html =
    options.mode === "continuous" ? withContinuousPdfOverrides(options.html) : options.html;

  try {
    await writeFile(htmlPath, html, "utf8");

    await build({
      input: htmlPath,
      output: pdfPath,
      singleDoc: true,
      size: toPdfPageSize(options),
      title: options.title,
      logLevel: "silent",
      timeout: options.timeoutMs,
      executableBrowser: options.browserExecutablePath || undefined,
    });

    return new Uint8Array(await readFile(pdfPath));
  } catch (error) {
    throw new VivliostyleRenderError(
      "vivliostyle_render_failed",
      "Le rendu PDF Vivliostyle a echoue.",
      { cause: error },
    );
  } finally {
    await removeTempWorkspace(workspacePath);
  }
};
