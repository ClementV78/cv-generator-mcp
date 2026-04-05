import { LIMITS, PAGE_HEIGHT_PX } from "./constants";
import { countSkillBars, countTags } from "./model";
import type { CvData, ValidationIssue, ValidationResult } from "./types";

const getLineHeight = (element: HTMLElement): number => {
  const computed = window.getComputedStyle(element);
  const lineHeight = Number.parseFloat(computed.lineHeight);

  if (Number.isFinite(lineHeight)) {
    return lineHeight;
  }

  const fontSize = Number.parseFloat(computed.fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.4 : 20;
};

const countRenderedLines = (element: HTMLElement): number => {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rawRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  range.detach?.();

  if (rawRects.length > 0) {
    const sortedRects = rawRects.sort((left, right) => left.top - right.top);
    const uniqueLineTops: number[] = [];

    sortedRects.forEach((rect) => {
      const previousTop =
        uniqueLineTops.length > 0 ? uniqueLineTops[uniqueLineTops.length - 1] : undefined;

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

const truncate = (value: string, maxLength = 42): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
};

const formatLineMessage = (label: string, maxLines: number, rawText: string): string => {
  const lineWord = maxLines > 1 ? "lignes" : "ligne";
  const text = truncate(rawText.trim().replace(/\s+/g, " "));

  if (!text) {
    return `${label} depasse ${maxLines} ${lineWord}.`;
  }

  return `${label} "${text}" depasse ${maxLines} ${lineWord}.`;
};

export const collectStructureMessages = (state: CvData): string[] => {
  const messages: string[] = [];

  if (state.skillGroups.length > LIMITS.maxSkillGroups) {
    messages.push(`Maximum ${LIMITS.maxSkillGroups} blocs de competences.`);
  }

  if (countSkillBars(state.skillGroups) > LIMITS.maxSkillBars) {
    messages.push(`Maximum ${LIMITS.maxSkillBars} competences a barres.`);
  }

  if (countTags(state.skillGroups) > LIMITS.maxTags) {
    messages.push(`Maximum ${LIMITS.maxTags} tags dans les groupes de type tags.`);
  }

  if (state.highlights.length > LIMITS.maxHighlights) {
    messages.push(`Maximum ${LIMITS.maxHighlights} highlights.`);
  }

  if (state.certifications.length > LIMITS.maxCertifications) {
    messages.push(`Maximum ${LIMITS.maxCertifications} certifications.`);
  }

  if (state.languages.length > LIMITS.maxLanguages) {
    messages.push(`Maximum ${LIMITS.maxLanguages} langues.`);
  }

  if (state.experiences.length > LIMITS.maxExperiences) {
    messages.push(`Maximum ${LIMITS.maxExperiences} experiences.`);
  }

  state.experiences.forEach((experience) => {
    if (experience.projects.length > LIMITS.maxProjectsPerExperience) {
      messages.push(`Maximum ${LIMITS.maxProjectsPerExperience} projets par experience.`);
    }

    if (experience.bullets.length > LIMITS.maxBulletsPerList) {
      messages.push(`Maximum ${LIMITS.maxBulletsPerList} bullet points par experience.`);
    }

    experience.projects.forEach((project) => {
      if (project.bullets.length > LIMITS.maxBulletsPerList) {
        messages.push(`Maximum ${LIMITS.maxBulletsPerList} bullet points par projet.`);
      }
    });
  });

  return messages;
};

export const validateRenderedDocument = (
  root: HTMLElement,
  state: CvData,
): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const structureMessages = collectStructureMessages(state);

  root.querySelectorAll<HTMLElement>("[data-max-lines]").forEach((element) => {
    const maxLines = Number(element.dataset.maxLines || 0);
    const label = element.dataset.label || "Bloc";
    const targetBind = element.dataset.validationId || element.dataset.bind || undefined;
    const lineCount = countRenderedLines(element);
    const isInvalid = maxLines > 0 && lineCount > maxLines;

    element.classList.toggle("is-over-limit", isInvalid);

    if (isInvalid) {
      issues.push({
        id: `${targetBind ?? label}-${maxLines}`,
        message: formatLineMessage(label, maxLines, element.innerText || element.textContent || ""),
        targetBind,
      });
    }
  });

  const sheet = root.querySelector<HTMLElement>(".cv-sheet");
  const pageCount = sheet ? Math.max(1, Math.ceil(sheet.scrollHeight / PAGE_HEIGHT_PX)) : 1;
  const pageLimitExceeded =
    state.render.maxPages !== null && pageCount > Number(state.render.maxPages);

  if (pageLimitExceeded) {
    issues.push({
      id: `page-limit-${state.render.maxPages}`,
      message: `Le rendu depasse la limite de ${state.render.maxPages} pages.`,
    });
  }

  return {
    pageCount,
    issues,
    structureMessages,
    pageLimitExceeded,
  };
};
