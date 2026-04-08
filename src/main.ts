import "./styles.css";
import { STORAGE_KEY } from "./constants";
import { renderApp } from "./app";
import { presets, type PresetKey } from "./data/presets";
import { hydrateQrPlaceholders } from "./engine/qr";
import { measurePreviewValidation } from "./engine/validationBrowser";
import { renderCvHtmlDocument } from "./engine/renderHtml";
import { getCvLanguageCopy, normalizeCvLanguage } from "./i18n";
import { sampleCv } from "./data/sampleCv";
import {
  addItemAtPath,
  canAddFactory,
  createId,
  createItemFromFactory,
  createTextItem,
  deepClone,
  insertItemAtPath,
  moveItemAtPath,
  normalizeCvData,
  removeItemAtPath,
  setValueAtPath,
  sortSkillGroupsForLayout,
} from "./model";
import { CvStore } from "./store";
import type { CvData, ValidationResult } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

const loadInitialState = (): CvData => {
  const persisted = localStorage.getItem(STORAGE_KEY);

  if (!persisted) {
    return deepClone(sampleCv);
  }

  try {
    return normalizeCvData(JSON.parse(persisted) as unknown);
  } catch {
    return deepClone(sampleCv);
  }
};

const store = new CvStore(loadInitialState());
let currentValidation: ValidationResult | null = null;
let selectedPreset: PresetKey = "devops";
let selectedExportFormat: "html" | "json" = "html";
let activeCardIconMenu: string | null = null;

const toPlainText = (value: string): string =>
  value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const toMultilineText = (value: string): string =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const getEditableValue = (element: HTMLElement): string =>
  element.dataset.multiline === "true" ? toMultilineText(element.innerText) : toPlainText(element.innerText);

const clearIssueHighlights = (): void => {
  app.querySelectorAll(".is-focused-issue").forEach((element) => {
    element.classList.remove("is-focused-issue");
  });
};

const focusIssueTarget = (targetBind?: string): void => {
  if (!targetBind) {
    return;
  }

  clearIssueHighlights();

  const escapedTargetBind =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(targetBind)
      : targetBind.replace(/"/g, '\\"');
  const selector = `[data-validation-id="${escapedTargetBind}"]`;
  const target = app.querySelector<HTMLElement>(selector);

  if (!target) {
    return;
  }

  target.classList.add("is-focused-issue");
  target.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });
};

const downloadFile = (name: string, content: BlobPart, type: string): void => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const printHtmlDocument = (html: string): void => {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;

    if (!frameWindow) {
      URL.revokeObjectURL(url);
      iframe.remove();
      window.alert("Impossible de lancer l'impression du PDF.");
      return;
    }

    frameWindow.focus();
    frameWindow.print();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      iframe.remove();
    }, 1000);
  };

  iframe.src = url;
  document.body.appendChild(iframe);
};

const getPreferredEnvironmentLabel = (state: CvData): string =>
  state.experiences.find((experience) => experience.techEnvironmentLabel.trim())?.techEnvironmentLabel ??
  getCvLanguageCopy(state.render.language).defaults.techEnvironmentLabel;

const rerender = (state: CvData): void => {
  currentValidation = measurePreviewValidation(state);

  app.innerHTML = renderApp(state, {
    interactive: true,
    validation: currentValidation,
    selectedPreset,
    selectedExportFormat,
    activeCardIconMenu,
  });

  void hydrateQrPlaceholders(app);
};

const normalizeSkillGroupOrderInDraft = (draft: CvData): void => {
  draft.skillGroups = sortSkillGroupsForLayout(draft.skillGroups);
};

store.subscribe((state) => {
  rerender(state);
});

app.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const actionTarget = target.closest<HTMLElement>("[data-action]");

  if (!actionTarget) {
    if (activeCardIconMenu) {
      activeCardIconMenu = null;
      rerender(store.getState());
    }
    return;
  }

  const action = actionTarget.dataset.action;
  const state = store.getState();

  if (action !== "toggle-card-icon-menu" && action !== "select-card-icon" && activeCardIconMenu) {
    activeCardIconMenu = null;
  }

  if (action === "toggle-mode") {
    store.update((draft) => {
      draft.render.mode = draft.render.mode === "edit" ? "preview" : "edit";
    });
    return;
  }

  if (action === "toggle-qr") {
    store.update((draft) => {
      draft.header.showQrCode = !draft.header.showQrCode;
    });
    return;
  }

  if (action === "toggle-main-education") {
    store.update((draft) => {
      draft.mainEducation.enabled = !draft.mainEducation.enabled;
    });
    return;
  }

  if (action === "toggle-sidebar-position") {
    store.update((draft) => {
      draft.render.sidebarPosition = draft.render.sidebarPosition === "right" ? "left" : "right";
    });
    return;
  }

  if (action === "jump-to-issue") {
    focusIssueTarget(actionTarget.dataset.targetBind);
    return;
  }

  if (action === "toggle-card-icon-menu") {
    const menuId = actionTarget.dataset.menuId ?? null;
    activeCardIconMenu = activeCardIconMenu === menuId ? null : menuId;
    rerender(store.getState());
    return;
  }

  if (action === "select-card-icon") {
    const bind = actionTarget.dataset.bind;
    const value = actionTarget.dataset.value;

    if (!bind || (value !== "certification" && value !== "formation" && value !== "generic")) {
      return;
    }

    activeCardIconMenu = null;
    store.update((draft) => {
      setValueAtPath(draft as unknown as Record<string, unknown>, bind, value);
    });
    return;
  }

  if (action === "trigger-import") {
    app.querySelector<HTMLInputElement>("#json-import-input")?.click();
    return;
  }

  if (action === "export-document") {
    if (currentValidation?.pageLimitExceeded) {
      window.alert(
        "Le rendu dépasse la limite de pages fixée. Réduis le contenu ou augmente la limite avant export.",
      );
      return;
    }

    if (selectedExportFormat === "json") {
      downloadFile("cv-template.json", JSON.stringify(state, null, 2), "application/json");
      return;
    }

    const html = await renderCvHtmlDocument(state);
    downloadFile("cv-template.html", html, "text/html;charset=utf-8");
    return;
  }

  if (action === "export-pdf") {
    if (currentValidation?.pageLimitExceeded) {
      window.alert(
        "Le rendu dépasse la limite de pages fixée. Réduis le contenu ou augmente la limite avant export.",
      );
      return;
    }

    const html = await renderCvHtmlDocument(state);
    printHtmlDocument(html);
    return;
  }

  if (action === "add-item") {
    const path = actionTarget.dataset.path;
    const factory = actionTarget.dataset.factory;

    if (!path || !factory) {
      return;
    }

    if (!canAddFactory(state, path, factory)) {
      window.alert("Impossible d'ajouter cet élément : limite atteinte pour ce bloc.");
      return;
    }

    const copy = getCvLanguageCopy(state.render.language);
    let item = createItemFromFactory(factory, state.render.language);

    if (factory === "experience") {
      item = {
        id: createId("experience"),
        company: copy.defaults.newExperienceCompany,
        role: copy.defaults.newExperienceRole,
        period: "2025",
        subtitle: copy.defaults.newExperienceSubtitle,
        bullets: [createTextItem(copy.defaults.newExperienceBullet)],
        techEnvironmentLabel: getPreferredEnvironmentLabel(state),
        techEnvironment: copy.defaults.technologiesToSpecify,
        projects: [],
      };
    }

    if (factory === "project") {
      const experienceMatch = path.match(/^experiences\.(\d+)\.projects$/);
      const experienceIndex = experienceMatch ? Number(experienceMatch[1]) : NaN;
      const inheritedLabel =
        !Number.isNaN(experienceIndex) && state.experiences[experienceIndex]
          ? state.experiences[experienceIndex].techEnvironmentLabel
          : getPreferredEnvironmentLabel(state);

      item = {
        id: createId("project"),
        title: copy.defaults.newProjectTitle,
        period: "2025",
        bullets: [createTextItem(copy.defaults.newProjectBullet)],
        techEnvironmentLabel: inheritedLabel,
        techEnvironment: copy.defaults.technologiesToSpecify,
      };
    }

    if (item === null) {
      return;
    }

    store.update((draft) => {
      if (path === "skillGroups" && (factory === "skill-bar-group" || factory === "skill-tag-group")) {
        const insertIndex =
          factory === "skill-bar-group"
            ? draft.skillGroups.findIndex((group) => group.type === "tags")
            : draft.skillGroups.length;

        if (insertIndex >= 0) {
          insertItemAtPath(draft as unknown as Record<string, unknown>, path, item, insertIndex);
          return;
        }
      }

      addItemAtPath(draft as unknown as Record<string, unknown>, path, item);

      if (path === "skillGroups") {
        normalizeSkillGroupOrderInDraft(draft);
      }
    });
    return;
  }

  if (action === "remove-item") {
    const path = actionTarget.dataset.path;
    const index = Number(actionTarget.dataset.index);

    if (!path || Number.isNaN(index)) {
      return;
    }

    store.update((draft) => {
      removeItemAtPath(draft as unknown as Record<string, unknown>, path, index);

      if (path === "skillGroups") {
        normalizeSkillGroupOrderInDraft(draft);
      }
    });
    return;
  }

  if (action === "move-item") {
    const path = actionTarget.dataset.path;
    const index = Number(actionTarget.dataset.index);
    const direction = Number(actionTarget.dataset.direction) as -1 | 1;

    if (!path || Number.isNaN(index) || (direction !== -1 && direction !== 1)) {
      return;
    }

    store.update((draft) => {
      moveItemAtPath(draft as unknown as Record<string, unknown>, path, index, direction);

      if (path === "skillGroups") {
        normalizeSkillGroupOrderInDraft(draft);
      }
    });
  }
});

app.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  const action = target.dataset.action;

  if (action === "set-range" && target instanceof HTMLInputElement) {
    const bind = target.dataset.bind;

    if (!bind) {
      return;
    }

    store.update((draft) => {
      setValueAtPath(draft as unknown as Record<string, unknown>, bind, Number(target.value));
    });
    return;
  }

  if (action === "set-select" && target instanceof HTMLSelectElement) {
    const bind = target.dataset.bind;

    if (!bind) {
      return;
    }

    store.update((draft) => {
      setValueAtPath(draft as unknown as Record<string, unknown>, bind, target.value);
    });
    return;
  }

  if (action === "apply-preset" && target instanceof HTMLSelectElement) {
    const presetKey = target.value as PresetKey;
    const preset = presets[presetKey];

    if (!preset) {
      return;
    }

    selectedPreset = presetKey;
    store.replace(deepClone(preset));
    return;
  }

  if (action === "set-max-pages" && target instanceof HTMLSelectElement) {
    const value = target.value ? Number(target.value) : null;
    store.update((draft) => {
      draft.render.maxPages = value === 1 || value === 2 || value === 3 ? value : null;
    });
    return;
  }

  if (action === "set-theme" && target instanceof HTMLSelectElement) {
    const value = target.value;
    store.update((draft) => {
      draft.render.theme =
        value === "zen" ||
        value === "zen-cream" ||
        value === "zen-orange" ||
        value === "claude" ||
        value === "graphite" ||
        value === "cyber" ||
        value === "cyber-purple"
          ? value
          : "ocean";
    });
    return;
  }

  if (action === "set-language" && target instanceof HTMLSelectElement) {
    const value = normalizeCvLanguage(target.value, "english");
    store.update((draft) => {
      draft.render.language = value;
    });
    return;
  }

  if (action === "set-export-format" && target instanceof HTMLSelectElement) {
    const value = target.value;
    selectedExportFormat = value === "json" ? "json" : "html";
    rerender(store.getState());
  }
});

app.addEventListener(
  "blur",
  (event) => {
    const target = event.target as HTMLElement;

    if (!(target instanceof HTMLElement) || !target.dataset.bind || !target.isContentEditable) {
      return;
    }

    const nextValue = getEditableValue(target);
    const bind = target.dataset.bind;

    store.update((draft) => {
      setValueAtPath(draft as unknown as Record<string, unknown>, bind, nextValue);
    });
  },
  true,
);

app.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement;

  if (!target.isContentEditable) {
    return;
  }

  if (event.key === "Enter" && target.dataset.multiline !== "true") {
    event.preventDefault();
    target.blur();
  }
});

app.addEventListener("paste", (event) => {
  const target = event.target as HTMLElement;

  if (!target.isContentEditable) {
    return;
  }

  event.preventDefault();
  const pastedText = event.clipboardData?.getData("text/plain") ?? "";
  document.execCommand("insertText", false, pastedText);
});

app.addEventListener("change", async (event) => {
  const target = event.target as HTMLInputElement;

  if (target.id !== "json-import-input" || !target.files?.[0]) {
    return;
  }

  try {
    const text = await target.files[0].text();
    const imported = normalizeCvData(JSON.parse(text) as unknown);
    store.replace(imported);
  } catch {
    window.alert("Le fichier JSON n'a pas pu être importé.");
  } finally {
    target.value = "";
  }
});
