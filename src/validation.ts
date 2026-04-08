import { LIMITS, PAGE_HEIGHT_PX } from "./constants";
import { getCvLanguageCopy } from "./i18n";
import { countSkillBars, countTags } from "./model";
import type { CvData, ValidationIssue, ValidationResult } from "./types";
import { formatLineMessage } from "./validationShared";

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

export const collectStructureMessages = (state: CvData): string[] => {
  const messages: string[] = [];
  const copy = getCvLanguageCopy(state.render.language);

  if (state.skillGroups.length > LIMITS.maxSkillGroups) {
    messages.push(copy.structure.maxSkillGroups(LIMITS.maxSkillGroups));
  }

  if (countSkillBars(state.skillGroups) > LIMITS.maxSkillBars) {
    messages.push(copy.structure.maxSkillBars(LIMITS.maxSkillBars));
  }

  if (countTags(state.skillGroups) > LIMITS.maxTags) {
    messages.push(copy.structure.maxTags(LIMITS.maxTags));
  }

  if (state.highlights.length > LIMITS.maxHighlights) {
    messages.push(copy.structure.maxHighlights(LIMITS.maxHighlights));
  }

  if (state.certifications.length > LIMITS.maxCertifications) {
    messages.push(copy.structure.maxCertifications(LIMITS.maxCertifications));
  }

  if (state.languages.length > LIMITS.maxLanguages) {
    messages.push(copy.structure.maxLanguages(LIMITS.maxLanguages));
  }

  if (state.experiences.length > LIMITS.maxExperiences) {
    messages.push(copy.structure.maxExperiences(LIMITS.maxExperiences));
  }

  state.experiences.forEach((experience) => {
    if (experience.projects.length > LIMITS.maxProjectsPerExperience) {
      messages.push(copy.structure.maxProjectsPerExperience(LIMITS.maxProjectsPerExperience));
    }

    if (experience.bullets.length > LIMITS.maxBulletsPerList) {
      messages.push(copy.structure.maxBulletsPerExperience(LIMITS.maxBulletsPerList));
    }

    experience.projects.forEach((project) => {
      if (project.bullets.length > LIMITS.maxBulletsPerList) {
        messages.push(copy.structure.maxBulletsPerProject(LIMITS.maxBulletsPerList));
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
  const copy = getCvLanguageCopy(state.render.language);

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
        message: formatLineMessage(
          label,
          maxLines,
          element.innerText || element.textContent || "",
          state.render.language,
        ),
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
      message: copy.pageLimitExceeded(Number(state.render.maxPages)),
    });
  }

  return {
    pageCount,
    issues,
    structureMessages,
    pageLimitExceeded,
  };
};
