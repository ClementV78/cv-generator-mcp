import { LIMITS } from "./constants";
import { getCvLanguageCopy } from "./i18n";
import { canAddFactory } from "./model";
import type {
  CardIcon,
  CvData,
  Experience,
  ExperienceProject,
  LanguageCard,
  SidebarCard,
  SkillBarGroup,
  SkillBarItem,
  SkillGroup,
  SkillTagGroup,
  TagItem,
  TextItem,
  ValidationResult,
} from "./types";

interface RenderOptions {
  interactive: boolean;
  validation?: ValidationResult | null;
  selectedPreset?: string;
  selectedExportFormat?: "html" | "json";
  activeCardIconMenu?: string | null;
  qrCodeMarkup?: string | null;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const controlClass = (interactive: boolean): string => (interactive ? "edit-only" : "is-hidden");

const renderIcon = (icon: CardIcon): string => {
  if (icon === "formation") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 2 8l10 5 8-4v6h2V8L12 3Zm-6 9v3l6 3 6-3v-3l-6 3-6-3Z"></path>
      </svg>
    `;
  }

  if (icon === "generic") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4h10l4 4v12H5V4Zm9 1.5V9h3.5L14 5.5ZM7 11h10v1.5H7V11Zm0 3h10v1.5H7V14Zm0 3h7v1.5H7V17Z"></path>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5.2 3.4 10 8 11 4.6-1 8-5.8 8-11V5l-8-3Zm-1 13-3-3 1.4-1.4 1.6 1.6 3.6-3.6L16 10l-5 5Z"></path>
    </svg>
  `;
};

const renderToolbarButtons = (path: string, index: number, interactive: boolean, removable = true): string => `
  <div class="item-toolbar ${controlClass(interactive)}">
    <button type="button" class="icon-button" data-action="move-item" data-path="${path}" data-index="${index}" data-direction="-1" aria-label="Monter" title="Monter">&uarr;</button>
    <button type="button" class="icon-button" data-action="move-item" data-path="${path}" data-index="${index}" data-direction="1" aria-label="Descendre" title="Descendre">&darr;</button>
    ${removable ? `<button type="button" class="icon-button is-danger" data-action="remove-item" data-path="${path}" data-index="${index}" aria-label="Supprimer" title="Supprimer">&times;</button>` : ""}
  </div>
`;

const renderSectionHeader = (
  title: string,
  interactive: boolean,
  path?: string,
  factory?: string,
  canAdd = false,
  extra?: string,
): string => `
  <div class="section-heading">
    <h3>${escapeHtml(title)}</h3>
    <div class="section-actions ${controlClass(interactive)}">
      ${extra ?? ""}
      ${
        path && factory && canAdd
          ? `<button type="button" data-action="add-item" data-path="${path}" data-factory="${factory}">+ Ajouter</button>`
          : ""
      }
    </div>
  </div>
`;

const renderEditableText = (
  value: string,
  bind: string,
  interactive: boolean,
  maxLines?: number,
  label?: string,
  className = "",
  multiline = false,
): string => `
  <div
    class="editable-text ${className}"
    ${interactive ? 'contenteditable="true"' : ""}
    data-bind="${bind}"
    data-validation-id="${bind}"
    ${multiline ? 'data-multiline="true"' : ""}
    ${maxLines ? `data-max-lines="${maxLines}"` : ""}
    ${label ? `data-label="${escapeHtml(label)}"` : ""}
    spellcheck="false"
  >${escapeHtml(value)}</div>
`;

const renderBullet = (
  item: TextItem,
  path: string,
  index: number,
  interactive: boolean,
  bulletLabel: string,
): string => `
  <li class="bullet-item">
    ${renderEditableText(item.text, `${path}.${index}.text`, interactive, LIMITS.bulletLines, bulletLabel)}
    ${renderToolbarButtons(path, index, interactive)}
  </li>
`;

const renderSkillBarRow = (
  item: SkillBarItem,
  path: string,
  index: number,
  interactive: boolean,
): string => `
  <div class="skill-row">
    <div class="skill-row-main">
      ${renderEditableText(item.label, `${path}.${index}.label`, interactive)}
      <span class="skill-level-value">${item.level}%</span>
    </div>
    <div class="skill-track"><span style="width:${item.level}%"></span></div>
    <div class="skill-row-actions ${controlClass(interactive)}">
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value="${item.level}"
        data-action="set-range"
        data-bind="${path}.${index}.level"
      />
      ${renderToolbarButtons(path, index, interactive)}
    </div>
  </div>
`;

const renderTagRow = (item: TagItem, path: string, index: number, interactive: boolean): string => `
  <div class="tag-pill">
    <span
      class="editable-text"
      ${interactive ? 'contenteditable="true"' : ""}
      data-bind="${path}.${index}.label"
      spellcheck="false"
    >${escapeHtml(item.label)}</span>
    <span class="${controlClass(interactive)} tag-toolbar">
      <button type="button" class="icon-button" data-action="move-item" data-path="${path}" data-index="${index}" data-direction="-1" title="Monter">&uarr;</button>
      <button type="button" class="icon-button" data-action="move-item" data-path="${path}" data-index="${index}" data-direction="1" title="Descendre">&darr;</button>
      <button type="button" class="icon-button is-danger" data-action="remove-item" data-path="${path}" data-index="${index}" title="Supprimer">&times;</button>
    </span>
  </div>
`;

const renderSkillGroup = (
  group: SkillGroup,
  index: number,
  state: CvData,
  interactive: boolean,
): string => {
  const groupPath = `skillGroups.${index}`;
  const itemPath = `${groupPath}.items`;
  const itemsMarkup =
    group.type === "bars"
      ? (group as SkillBarGroup).items
          .map((item, itemIndex) => renderSkillBarRow(item, itemPath, itemIndex, interactive))
          .join("")
      : `<div class="tag-cloud">${(group as SkillTagGroup).items
          .map((item, itemIndex) => renderTagRow(item, itemPath, itemIndex, interactive))
          .join("")}</div>`;

  return `
    <section class="sidebar-section skill-section">
      <div class="section-heading">
        ${renderEditableText(group.title, `${groupPath}.title`, interactive, undefined, undefined, "section-title-edit")}
        <div class="section-actions ${controlClass(interactive)}">
          <button
            type="button"
            data-action="add-item"
            data-path="${itemPath}"
            data-factory="${group.type === "bars" ? "skill-bar-item" : "tag-item"}"
            ${canAddFactory(state, itemPath, group.type === "bars" ? "skill-bar-item" : "tag-item") ? "" : "disabled"}
          >+ Ajouter</button>
          ${renderToolbarButtons("skillGroups", index, interactive, true)}
        </div>
      </div>
      <div class="skill-group-body">${itemsMarkup}</div>
    </section>
  `;
};

const renderSidebarCard = (
  item: SidebarCard,
  path: string,
  index: number,
  interactive: boolean,
  titleLines: number,
  titleLabel: string,
  secondaryLabel: string,
  metadataLabel: string,
  activeCardIconMenu?: string | null,
): string => `
  <div class="sidebar-card">
    <div class="card-icon card-icon-picker">
      ${
        interactive
          ? `
              <button
                type="button"
                class="card-icon-trigger"
                data-action="toggle-card-icon-menu"
                data-menu-id="${path}.${index}.icon"
                aria-label="Changer le type de carte"
                title="Changer le type de carte"
              >
                ${renderIcon(item.icon)}
                <span class="card-icon-edit-badge" aria-hidden="true">✎</span>
              </button>
              ${
                activeCardIconMenu === `${path}.${index}.icon`
                  ? `
                      <div class="card-icon-menu">
                        <button type="button" class="card-icon-option ${item.icon === "certification" ? "is-active" : ""}" data-action="select-card-icon" data-bind="${path}.${index}.icon" data-value="certification" title="Certification">
                          ${renderIcon("certification")}
                        </button>
                        <button type="button" class="card-icon-option ${item.icon === "formation" ? "is-active" : ""}" data-action="select-card-icon" data-bind="${path}.${index}.icon" data-value="formation" title="Formation">
                          ${renderIcon("formation")}
                        </button>
                        <button type="button" class="card-icon-option ${item.icon === "generic" ? "is-active" : ""}" data-action="select-card-icon" data-bind="${path}.${index}.icon" data-value="generic" title="Générique">
                          ${renderIcon("generic")}
                        </button>
                      </div>
                    `
                  : ""
              }
            `
          : renderIcon(item.icon)
      }
    </div>
    <div class="card-content">
      ${renderEditableText(item.title, `${path}.${index}.title`, interactive, titleLines, titleLabel)}
      ${renderEditableText(
        item.subtitle,
        `${path}.${index}.subtitle`,
        interactive,
        LIMITS.certificationMetaLines,
        secondaryLabel,
        "card-meta",
      )}
      ${
        item.meta ? renderEditableText(item.meta, `${path}.${index}.meta`, interactive, 1, metadataLabel, "card-meta soft") : ""
      }
    </div>
    <div class="card-controls ${controlClass(interactive)}">
      ${renderToolbarButtons(path, index, interactive)}
    </div>
  </div>
`;

const renderLanguageCard = (
  item: LanguageCard,
  path: string,
  index: number,
  interactive: boolean,
  copy: ReturnType<typeof getCvLanguageCopy>,
): string => `
  <div class="language-card">
    ${renderEditableText(item.title, `${path}.${index}.title`, interactive, 1, copy.defaults.newLanguageTitle)}
    ${renderEditableText(item.subtitle, `${path}.${index}.subtitle`, interactive, LIMITS.languageLines, copy.labelLanguageLevel, "card-meta")}
    ${renderToolbarButtons(path, index, interactive)}
  </div>
`;

const renderProject = (
  project: ExperienceProject,
  experienceIndex: number,
  projectIndex: number,
  interactive: boolean,
  copy: ReturnType<typeof getCvLanguageCopy>,
): string => {
  const projectPath = `experiences.${experienceIndex}.projects.${projectIndex}`;
  const bulletsPath = `${projectPath}.bullets`;

  return `
    <div class="project-card">
        <div class="project-header">
        ${renderEditableText(project.title, `${projectPath}.title`, interactive, undefined, undefined, "project-title")}
        ${renderEditableText(project.period, `${projectPath}.period`, interactive, 1, copy.labelPeriod, "project-period")}
        ${renderToolbarButtons(`experiences.${experienceIndex}.projects`, projectIndex, interactive)}
      </div>
      <ul class="bullet-list">
        ${project.bullets
          .map((bullet, bulletIndex) => renderBullet(bullet, bulletsPath, bulletIndex, interactive, copy.labelBulletPoint))
          .join("")}
      </ul>
      <div class="inline-actions ${controlClass(interactive)}">
        <button type="button" data-action="add-item" data-path="${bulletsPath}" data-factory="bullet">+ Bullet</button>
      </div>
      <div class="tech-box">
        <strong>${renderEditableText(project.techEnvironmentLabel, `${projectPath}.techEnvironmentLabel`, interactive, 1, copy.defaults.techEnvironmentLabel, "inline-edit")} :</strong>
        ${renderEditableText(project.techEnvironment, `${projectPath}.techEnvironment`, interactive, LIMITS.techEnvironmentLines, copy.defaults.techEnvironmentLabel, "inline-edit")}
      </div>
    </div>
  `;
};

const renderExperience = (
  experience: Experience,
  index: number,
  state: CvData,
  interactive: boolean,
  copy: ReturnType<typeof getCvLanguageCopy>,
): string => {
  const experiencePath = `experiences.${index}`;
  const bulletsPath = `${experiencePath}.bullets`;
  const projectsPath = `${experiencePath}.projects`;

  return `
    <article class="experience-item">
      <div class="experience-dot"></div>
      <div class="experience-card">
        <div class="experience-header">
          <div class="experience-title-line">
            ${renderEditableText(experience.role, `${experiencePath}.role`, interactive, undefined, undefined, "experience-role")}
            ${renderEditableText(experience.company, `${experiencePath}.company`, interactive, 1, copy.labelCompany, "experience-company")}
          </div>
          ${renderEditableText(experience.period, `${experiencePath}.period`, interactive, 1, copy.labelPeriod, "experience-period")}
          ${renderToolbarButtons("experiences", index, interactive)}
        </div>
        ${renderEditableText(experience.subtitle, `${experiencePath}.subtitle`, interactive, 2, copy.labelExperienceSubtitle, "experience-subtitle")}
        <ul class="bullet-list">
          ${experience.bullets
            .map((bullet, bulletIndex) => renderBullet(bullet, bulletsPath, bulletIndex, interactive, copy.labelBulletPoint))
            .join("")}
        </ul>
        <div class="inline-actions ${controlClass(interactive)}">
          <button
            type="button"
            data-action="add-item"
            data-path="${bulletsPath}"
            data-factory="bullet"
            ${canAddFactory(state, bulletsPath, "bullet") ? "" : "disabled"}
          >+ Bullet</button>
          <button
            type="button"
            data-action="add-item"
            data-path="${projectsPath}"
            data-factory="project"
            ${canAddFactory(state, projectsPath, "project") ? "" : "disabled"}
          >+ Projet</button>
        </div>
        ${
          experience.projects.length > 0
            ? `<div class="project-list">${experience.projects.map((project, projectIndex) => renderProject(project, index, projectIndex, interactive, copy)).join("")}</div>`
            : ""
        }
        <div class="tech-box">
          <strong>${renderEditableText(experience.techEnvironmentLabel, `${experiencePath}.techEnvironmentLabel`, interactive, 1, copy.defaults.techEnvironmentLabel, "inline-edit")} :</strong>
          ${renderEditableText(experience.techEnvironment, `${experiencePath}.techEnvironment`, interactive, LIMITS.techEnvironmentLines, copy.defaults.techEnvironmentLabel, "inline-edit")}
        </div>
      </div>
    </article>
  `;
};

const renderStatusSummary = (validation?: ValidationResult | null): string => {
  if (!validation) {
    return `<span class="status-chip">Prêt</span>`;
  }

  const issueItems = validation.issues.slice(0, 3);
  const structureItems = validation.structureMessages.slice(0, Math.max(0, 3 - issueItems.length));

  if (issueItems.length === 0 && structureItems.length === 0) {
    return `<span class="status-chip is-success">Aucune alerte</span>`;
  }

  return [
    ...issueItems.map(
      (issue) =>
        issue.targetBind
          ? `
              <button
                type="button"
                class="status-chip is-warning status-chip-button"
                data-action="jump-to-issue"
                data-target-bind="${escapeHtml(issue.targetBind)}"
                title="${escapeHtml(issue.message)}"
              >${escapeHtml(issue.message)}</button>
            `
          : `<span class="status-chip is-warning" title="${escapeHtml(issue.message)}">${escapeHtml(issue.message)}</span>`,
    ),
    ...structureItems.map(
      (item) => `<span class="status-chip is-warning" title="${escapeHtml(item)}">${escapeHtml(item)}</span>`,
    ),
  ].join("");
};

export const renderApp = (state: CvData, options: RenderOptions): string => {
  const {
    interactive,
    validation,
    selectedPreset = "devops",
    selectedExportFormat = "html",
    activeCardIconMenu = null,
    qrCodeMarkup = null,
  } = options;
  const modeClass = state.render.mode === "preview" ? "mode-preview" : "mode-edit";
  const themeClass = `theme-${state.render.theme}`;
  const sidebarClass = state.render.sidebarPosition === "right" ? "sidebar-right" : "sidebar-left";
  const sidebarToggleArrow = state.render.sidebarPosition === "right" ? "&larr;" : "&rarr;";
  const sidebarToggleTitle =
    state.render.sidebarPosition === "right"
      ? "Remettre la colonne ? gauche"
      : "D?placer la colonne ? droite";
  const canAddSkillGroups = canAddFactory(state, "skillGroups", "skill-bar-group");

  return `
    <div class="editor-shell ${modeClass} ${themeClass}">
      <header class="app-toolbar">
        <div class="toolbar-brand">
          <div class="toolbar-kicker">Template editor</div>
          <h1>Éditeur de CV HTML</h1>
          <p>Template verrouillé, contenu totalement personnalisable.</p>
        </div>
        <div class="toolbar-actions">
          <label class="toolbar-field toolbar-field-preset">
            <span class="preset-label">PRESET</span>
            <span class="preset-hint">Charge un exemple métier prêt à éditer</span>
            <select data-action="apply-preset">
              <option value="cloud-architect" ${selectedPreset === "cloud-architect" ? "selected" : ""}>Cloud Architect</option>
              <option value="java-developer" ${selectedPreset === "java-developer" ? "selected" : ""}>Developpeur Java</option>
              <option value="devops" ${selectedPreset === "devops" ? "selected" : ""}>DevOps</option>
              <option value="soc-engineer" ${selectedPreset === "soc-engineer" ? "selected" : ""}>Ingenieur SOC</option>
              <option value="sophrologue-trainer" ${selectedPreset === "sophrologue-trainer" ? "selected" : ""}>Sophrologue / Formateur</option>
            </select>
          </label>
          <label class="toolbar-field">
            <span>Mode</span>
            <button type="button" data-action="toggle-mode">${state.render.mode === "edit" ? "Passer en preview" : "Revenir en édition"}</button>
          </label>
          <label class="toolbar-field">
            <span>Pages max</span>
            <select data-action="set-max-pages">
              <option value="" ${state.render.maxPages === null ? "selected" : ""}>Aucune limite</option>
              <option value="1" ${state.render.maxPages === 1 ? "selected" : ""}>1 page</option>
              <option value="2" ${state.render.maxPages === 2 ? "selected" : ""}>2 pages</option>
              <option value="3" ${state.render.maxPages === 3 ? "selected" : ""}>3 pages</option>
            </select>
          </label>
          <label class="toolbar-field">
            <span>Thème</span>
            <select data-action="set-theme">
              <option value="ocean" ${state.render.theme === "ocean" ? "selected" : ""}>Ocean DevOps</option>
              <option value="zen" ${state.render.theme === "zen" ? "selected" : ""}>Zen</option>
              <option value="zen-cream" ${state.render.theme === "zen-cream" ? "selected" : ""}>Zen Crème</option>
              <option value="zen-orange" ${state.render.theme === "zen-orange" ? "selected" : ""}>Zen Ambre</option>
              <option value="claude" ${state.render.theme === "claude" ? "selected" : ""}>Claude Code</option>
              <option value="graphite" ${state.render.theme === "graphite" ? "selected" : ""}>Graphite</option>
              <option value="cyber" ${state.render.theme === "cyber" ? "selected" : ""}>Cyber Blue</option>
              <option value="cyber-purple" ${state.render.theme === "cyber-purple" ? "selected" : ""}>Cyber Purple</option>
            </select>
          </label>
          <label class="toolbar-field">
            <span>CV language</span>
            <select data-action="set-language">
              <option value="english" ${state.render.language === "english" ? "selected" : ""}>English</option>
              <option value="french" ${state.render.language === "french" ? "selected" : ""}>Français</option>
              <option value="spanish" ${state.render.language === "spanish" ? "selected" : ""}>Español</option>
            </select>
          </label>
          <label class="toolbar-field">
            <span>Format export</span>
            <select data-action="set-export-format">
              <option value="html" ${selectedExportFormat === "html" ? "selected" : ""}>Export HTML</option>
              <option value="json" ${selectedExportFormat === "json" ? "selected" : ""}>JSON</option>
            </select>
          </label>
          <button type="button" data-action="export-document">Exporter</button>
          <button type="button" data-action="export-pdf">Imprimer (PDF)</button>
          <button type="button" data-action="trigger-import">Importer JSON</button>
          <input type="file" id="json-import-input" accept="application/json" class="is-hidden" />
        </div>
        <div class="toolbar-status">
          <span class="status-chip">Pages estimées : ${validation?.pageCount ?? 1}</span>
          ${renderStatusSummary(validation)}
        </div>
      </header>

      ${renderCvSheet(state, { interactive, activeCardIconMenu, qrCodeMarkup })}
    </div>
  `;
};

interface RenderCvSheetOptions {
  interactive: boolean;
  activeCardIconMenu?: string | null;
  qrCodeMarkup?: string | null;
}

export const renderCvSheet = (state: CvData, options: RenderCvSheetOptions): string => {
  const { interactive, activeCardIconMenu = null, qrCodeMarkup = null } = options;
  const themeClass = `theme-${state.render.theme}`;
  const sidebarClass = state.render.sidebarPosition === "right" ? "sidebar-right" : "sidebar-left";
  const copy = getCvLanguageCopy(state.render.language);
  const sidebarToggleArrow = state.render.sidebarPosition === "right" ? "&larr;" : "&rarr;";
  const sidebarToggleTitle =
    state.render.sidebarPosition === "right"
      ? "Remettre la colonne à gauche"
      : "Déplacer la colonne à droite";
  const canAddSkillGroups = canAddFactory(state, "skillGroups", "skill-bar-group");

  return `
      <div class="cv-sheet ${themeClass} ${sidebarClass}">
          <aside class="sidebar">
            <div class="sidebar-top-actions ${controlClass(interactive)}">
              <button
                type="button"
                class="sidebar-side-toggle"
                data-action="toggle-sidebar-position"
                aria-label="${sidebarToggleTitle}"
                title="${sidebarToggleTitle}"
              >${sidebarToggleArrow}</button>
            </div>
            <div class="cv-badge">
              ${renderEditableText(state.header.badgeText, "header.badgeText", interactive, 2, copy.labelBadgeText, "badge-text")}
            </div>

          <section class="contact-list">
            ${renderEditableText(state.header.location, "header.location", interactive, 2, copy.labelLocation, "contact-item")}
            ${renderEditableText(state.header.email, "header.email", interactive, 2, "Email", "contact-item")}
            ${renderEditableText(state.header.linkedin, "header.linkedin", interactive, 2, "LinkedIn", "contact-item")}
            ${renderEditableText(state.header.availabilityText, "header.availabilityText", interactive, 3, copy.labelAvailability, "contact-item")}
          </section>

          ${
              state.header.showQrCode
                ? `
                <section class="qr-block">
                  <div class="section-actions ${controlClass(interactive)} qr-actions">
                    <button type="button" class="icon-button is-danger qr-icon-button" data-action="toggle-qr" title="Supprimer le bloc QR" aria-label="Supprimer le bloc QR">&times;</button>
                  </div>
                  ${
                    qrCodeMarkup
                      ? `<div class="qr-placeholder" aria-label="QR code">${qrCodeMarkup}</div>`
                      : `<div class="qr-placeholder" data-qr-url="${escapeHtml(state.header.qrCodeUrl).replace(/"/g, "&quot;")}" aria-label="QR code"></div>`
                  }
                  ${renderEditableText(state.header.qrCodeLabel, "header.qrCodeLabel", interactive, 1, copy.labelQrCode, "qr-label")}
                  ${renderEditableText(state.header.qrCodeUrl, "header.qrCodeUrl", interactive, 2, copy.labelQrCodeUrl, `qr-url ${controlClass(interactive)}`)}
                </section>
              `
              : `
                <section class="qr-block qr-block-placeholder ${controlClass(interactive)}">
                  <button type="button" class="qr-add-button" data-action="toggle-qr" title="Ajouter un bloc QR" aria-label="Ajouter un bloc QR">
                    <span class="qr-add-symbol">+</span>
                    <span>QR</span>
                  </button>
                </section>
              `
          }

          <section class="sidebar-section">
            ${renderSectionHeader(
              copy.sectionSkills,
              interactive,
              undefined,
              undefined,
              false,
              canAddSkillGroups
                ? `
                    <button type="button" data-action="add-item" data-path="skillGroups" data-factory="skill-bar-group">+ Compétences</button>
                    <button type="button" data-action="add-item" data-path="skillGroups" data-factory="skill-tag-group">+ Tags</button>
                  `
                : `<span class="group-limit-hint ${controlClass(interactive)}">3 blocs max</span>`,
            )}
            ${state.skillGroups.map((group, index) => renderSkillGroup(group, index, state, interactive)).join("")}
          </section>

          <section class="sidebar-section">
            ${renderSectionHeader(copy.sectionHighlights, interactive, "highlights", "highlight", canAddFactory(state, "highlights", "highlight"))}
            <div class="stacked-list">
              ${state.highlights
                .map(
                  (item, index) => `
                    <div class="highlight-card">
                      ${renderEditableText(item.text, `highlights.${index}.text`, interactive, LIMITS.highlightLines, copy.sectionHighlights)}
                      ${renderToolbarButtons("highlights", index, interactive)}
                    </div>
                  `,
                )
                .join("")}
            </div>
          </section>

          <section class="sidebar-section">
            ${renderSectionHeader(copy.sectionCertifications, interactive, "certifications", "certification", canAddFactory(state, "certifications", "certification"))}
            <div class="stacked-list">
              ${state.certifications
                .map((item, index) =>
                  renderSidebarCard(
                    item,
                    "certifications",
                    index,
                    interactive,
                    LIMITS.certificationTitleLines,
                    copy.sectionCertifications,
                    copy.labelSecondary,
                    copy.labelMetadata,
                    activeCardIconMenu,
                  ),
                )
                .join("")}
            </div>
          </section>

          <section class="sidebar-section">
            ${renderSectionHeader(copy.sectionFormations, interactive, "formations", "formation", true)}
            <div class="stacked-list">
              ${state.formations
                .map((item, index) =>
                  renderSidebarCard(
                    item,
                    "formations",
                    index,
                    interactive,
                    2,
                    copy.sectionFormations,
                    copy.labelSecondary,
                    copy.labelMetadata,
                    activeCardIconMenu,
                  ),
                )
                .join("")}
            </div>
          </section>

          <section class="sidebar-section">
            ${renderSectionHeader(copy.sectionLanguages, interactive, "languages", "language", canAddFactory(state, "languages", "language"))}
            <div class="stacked-list">
              ${state.languages.map((item, index) => renderLanguageCard(item, "languages", index, interactive, copy)).join("")}
            </div>
          </section>
        </aside>

        <main class="main-column">
          <header class="hero">
            ${renderEditableText(state.header.name, "header.name", interactive, 2, copy.labelName, "hero-name")}
            ${renderEditableText(state.header.headline, "header.headline", interactive, 3, copy.labelHeadline, "hero-headline")}
          </header>

          <section class="profile-box">
            <strong>${renderEditableText(state.profileLabel, "profileLabel", interactive, 1, copy.defaults.profileLabel, "inline-edit")} :</strong>
            ${renderEditableText(state.profile, "profile", interactive, LIMITS.profileLines, copy.labelProfileText, "profile-text")}
          </section>

          <section class="experience-section">
            ${renderSectionHeader(copy.sectionExperienceAndProjects, interactive, "experiences", "experience", canAddFactory(state, "experiences", "experience"))}
            <div class="experience-timeline">
              ${state.experiences.map((experience, index) => renderExperience(experience, index, state, interactive, copy)).join("")}
            </div>
          </section>

          ${
            state.mainEducation.enabled
                  ? `
                <section class="main-education">
                  <div class="section-heading">
                    <h2>${renderEditableText(state.mainEducation.title, "mainEducation.title", interactive, 1, copy.labelMainEducationTitle, "inline-edit")}</h2>
                    <div class="section-actions ${controlClass(interactive)}">
                      <button type="button" data-action="toggle-main-education">Supprimer l'encart</button>
                    </div>
                  </div>
                  ${renderEditableText(state.mainEducation.summary, "mainEducation.summary", interactive, 5, copy.labelMainEducationSummary, "education-summary", true)}
                </section>
              `
              : `
                <section class="main-education main-education-placeholder ${controlClass(interactive)}">
                  <button type="button" data-action="toggle-main-education">+ Ajouter un encart formation</button>
                </section>
              `
          }
        </main>
      </div>
  `;
};
