import { deepClone, normalizeCvData } from "../model";
import type { CvData, ValidationResult } from "../types";
import { renderCvHtmlDocumentNode } from "./renderHtmlNode";
import { renderCvPdf, type RenderPdfOptions } from "./renderPdf";
import { getCvDataJsonSchema, type CvDataJsonSchema } from "./schema";
import { validateCv, type ValidateCvOptions } from "./validateNode";

export type CvArtifactFormat = "html" | "json" | "pdf";

export interface PrepareCvResult {
  cvData: CvData;
}

export interface GenerateCvArtifactOptions {
  format: CvArtifactFormat;
  pdfOptions?: RenderPdfOptions;
}

interface GenerateCvArtifactBase {
  format: CvArtifactFormat;
  fileName: string;
  mimeType: string;
}

export interface GenerateCvTextArtifactResult extends GenerateCvArtifactBase {
  format: "html" | "json";
  content: string;
}

export interface GenerateCvBinaryArtifactResult extends GenerateCvArtifactBase {
  format: "pdf";
  binaryContent: Uint8Array;
}

export type GenerateCvArtifactResult = GenerateCvTextArtifactResult | GenerateCvBinaryArtifactResult;

export interface ValidateCvServiceOptions extends ValidateCvOptions {}

export interface ValidateCvServiceResult extends ValidationResult {
  cvData: CvData;
}

export const prepareCvData = (input: unknown): PrepareCvResult => ({
  cvData: normalizeCvData(input),
});

export const exportCvJson = (data: CvData): string => JSON.stringify(deepClone(data), null, 2);

export const getCvSchema = (): CvDataJsonSchema => getCvDataJsonSchema();

export const validateCvInput = async (
  input: unknown,
  options: ValidateCvServiceOptions = {},
): Promise<ValidateCvServiceResult> => {
  const { cvData } = prepareCvData(input);
  const validation = await validateCv(cvData, options);

  return {
    cvData,
    ...validation,
  };
};

export const generateCvArtifact = async (
  input: unknown,
  options: GenerateCvArtifactOptions,
): Promise<GenerateCvArtifactResult> => {
  const { cvData } = prepareCvData(input);

  if (options.format === "json") {
    return {
      format: "json",
      fileName: "cv-template.json",
      mimeType: "application/json",
      content: exportCvJson(cvData),
    };
  }

  if (options.format === "pdf") {
    return {
      format: "pdf",
      fileName: "cv-template.pdf",
      mimeType: "application/pdf",
      binaryContent: await renderCvPdf(cvData, options.pdfOptions),
    };
  }

  return {
    format: "html",
    fileName: "cv-template.html",
    mimeType: "text/html;charset=utf-8",
    content: await renderCvHtmlDocumentNode(cvData),
  };
};
