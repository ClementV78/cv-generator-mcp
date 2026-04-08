import type { CvLanguage } from "./types";

export const truncateValidationText = (value: string, maxLength = 42): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
};

export const formatLineMessage = (
  label: string,
  maxLines: number,
  rawText: string,
  language: CvLanguage = "english",
): string => {
  const lineWord =
    language === "french"
      ? maxLines > 1
        ? "lignes"
        : "ligne"
      : language === "spanish"
        ? maxLines > 1
          ? "líneas"
          : "línea"
        : maxLines > 1
          ? "lines"
          : "line";
  const text = truncateValidationText(rawText.trim().replace(/\s+/g, " "));

  if (!text) {
    if (language === "french") {
      return `${label} dépasse ${maxLines} ${lineWord}.`;
    }
    if (language === "spanish") {
      return `${label} supera ${maxLines} ${lineWord}.`;
    }
    return `${label} exceeds ${maxLines} ${lineWord}.`;
  }

  if (language === "french") {
    return `${label} "${text}" dépasse ${maxLines} ${lineWord}.`;
  }
  if (language === "spanish") {
    return `${label} "${text}" supera ${maxLines} ${lineWord}.`;
  }
  return `${label} "${text}" exceeds ${maxLines} ${lineWord}.`;
};
