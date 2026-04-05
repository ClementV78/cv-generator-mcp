export const truncateValidationText = (value: string, maxLength = 42): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
};

export const formatLineMessage = (label: string, maxLines: number, rawText: string): string => {
  const lineWord = maxLines > 1 ? "lignes" : "ligne";
  const text = truncateValidationText(rawText.trim().replace(/\s+/g, " "));

  if (!text) {
    return `${label} depasse ${maxLines} ${lineWord}.`;
  }

  return `${label} "${text}" depasse ${maxLines} ${lineWord}.`;
};
