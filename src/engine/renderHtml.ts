import exportStyles from "../styles.css?inline";
import { renderCvSheet } from "../app";
import { getCvLanguageCopy } from "../i18n";
import { deepClone } from "../model";
import type { CvData } from "../types";
import { generateQrSvg } from "./qr";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const renderCvSheetMarkup = async (state: CvData): Promise<string> => {
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

export const renderCvHtmlDocument = async (state: CvData): Promise<string> => {
  const previewState: CvData = deepClone(state);
  previewState.render.mode = "preview";
  const sheetMarkup = await renderCvSheetMarkup(previewState);
  const copy = getCvLanguageCopy(previewState.render.language);

  return `<!doctype html>
<html lang="${copy.htmlLang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(previewState.header.name)} - ${escapeHtml(copy.documentTitleSuffix)}</title>
    <style>${exportStyles}</style>
  </head>
  <body>
    ${sheetMarkup}
  </body>
</html>`;
};
