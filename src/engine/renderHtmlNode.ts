import { readFile } from "node:fs/promises";
import { renderCvSheet } from "../app";
import { deepClone } from "../model";
import type { CvData } from "../types";
import { generateQrSvg } from "./qr";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

let cachedExportStyles: string | null = null;

const loadExportStyles = async (): Promise<string> => {
  if (cachedExportStyles !== null) {
    return cachedExportStyles;
  }

  const stylesUrl = new URL("../styles.css", import.meta.url);
  cachedExportStyles = await readFile(stylesUrl, "utf-8");
  return cachedExportStyles;
};

export const renderCvSheetMarkupNode = async (state: CvData): Promise<string> => {
  const previewState: CvData = deepClone(state);
  previewState.render.mode = "preview";
  const qrCodeMarkup =
    previewState.header.showQrCode && previewState.header.qrCodeUrl
      ? await generateQrSvg(previewState.header.qrCodeUrl)
      : null;

  return renderCvSheet(previewState, {
    interactive: false,
    activeCardIconMenu: null,
    qrCodeMarkup,
  });
};

export const renderCvHtmlDocumentNode = async (state: CvData): Promise<string> => {
  const previewState: CvData = deepClone(state);
  previewState.render.mode = "preview";
  const styles = await loadExportStyles();
  const sheetMarkup = await renderCvSheetMarkupNode(previewState);

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(previewState.header.name)} - CV</title>
    <style>${styles}</style>
  </head>
  <body>
    ${sheetMarkup}
  </body>
</html>`;
};
