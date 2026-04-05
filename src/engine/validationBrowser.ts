import { renderCvSheet } from "../app";
import { deepClone } from "../model";
import type { CvData, ValidationResult } from "../types";
import { validateRenderedDocument } from "../validation";

export const measurePreviewValidation = (state: CvData): ValidationResult => {
  const previewState: CvData = deepClone(state);
  previewState.render.mode = "preview";

  const container = document.createElement("div");
  container.className = "measure-root";
  container.setAttribute("aria-hidden", "true");
  container.innerHTML = renderCvSheet(previewState, {
    interactive: false,
    activeCardIconMenu: null,
    qrCodeMarkup: null,
  });

  document.body.appendChild(container);
  const validation = validateRenderedDocument(container, previewState);
  document.body.removeChild(container);

  return validation;
};
