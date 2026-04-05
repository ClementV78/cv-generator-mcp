import { LIMITS } from "./constants";
import type {
  CardIcon,
  CvTheme,
  CvData,
  Experience,
  ExperienceProject,
  LanguageCard,
  MainEducationBlock,
  SidebarPosition,
  SidebarCard,
  SkillBarGroup,
  SkillBarItem,
  SkillGroup,
  SkillTagGroup,
  TagItem,
  TextItem,
} from "./types";

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asTheme = (value: unknown, fallback: CvTheme = "ocean"): CvTheme =>
  value === "zen" ||
  value === "zen-cream" ||
  value === "zen-orange" ||
  value === "zen-sunset" ||
  value === "claude" ||
  value === "graphite" ||
  value === "cyber" ||
  value === "cyber-purple" ||
  value === "ocean"
    ? value === "zen-sunset"
      ? "zen-orange"
      : value
    : fallback;

const asSidebarPosition = (value: unknown, fallback: SidebarPosition = "left"): SidebarPosition =>
  value === "right" ? "right" : fallback;

const getDefaultBadgeText = (fullName: string): string => {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "CV";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join(".");
};

export const createId = (prefix = "item"): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

export const createTextItem = (text = "Nouvelle ligne"): TextItem => ({
  id: createId("text"),
  text,
});

export const createTagItem = (label = "Nouveau tag"): TagItem => ({
  id: createId("tag"),
  label,
});

export const createSkillBarItem = (label = "Nouvelle compétence", level = 60): SkillBarItem => ({
  id: createId("skill"),
  label,
  level,
});

export const createSkillBarGroup = (title = "Nouveau bloc de compétences"): SkillBarGroup => ({
  id: createId("skill-group"),
  title,
  type: "bars",
  items: [createSkillBarItem()],
});

export const createSkillTagGroup = (title = "Langages & Outils"): SkillTagGroup => ({
  id: createId("tag-group"),
  title,
  type: "tags",
  items: [createTagItem("JavaScript"), createTagItem("TypeScript")],
});

export const createSidebarCard = (
  icon: CardIcon,
  title = "Nouvelle carte",
  subtitle = "Sous-titre",
  meta = "",
): SidebarCard => ({
  id: createId("card"),
  icon,
  title,
  subtitle,
  meta,
});

export const createLanguageCard = (
  title = "Nouvelle langue",
  subtitle = "Niveau à préciser",
): LanguageCard => ({
  id: createId("lang"),
  title,
  subtitle,
});

export const createProject = (): ExperienceProject => ({
  id: createId("project"),
  title: "Nouveau projet",
  period: "2025",
  bullets: [createTextItem("Décrire le périmètre et la contribution.")],
  techEnvironmentLabel: "Environnement technique",
  techEnvironment: "Technologies à préciser",
});

export const createExperience = (): Experience => ({
  id: createId("experience"),
  company: "Nouvelle entreprise",
  role: "Nouveau rôle",
  period: "2025",
  subtitle: "Sous-projet ou périmètre",
  bullets: [createTextItem("Décrire la mission et la contribution principale.")],
  techEnvironmentLabel: "Environnement technique",
  techEnvironment: "Technologies à préciser",
  projects: [],
});

export const createMainEducation = (): MainEducationBlock => ({
  enabled: true,
  title: "Formation",
  summary: "Ajouter ici un rappel de formation dense et optionnel.",
});

export const countSkillBars = (skillGroups: SkillGroup[]): number =>
  skillGroups
    .filter((group): group is SkillBarGroup => group.type === "bars")
    .reduce((total, group) => total + group.items.length, 0);

export const countTags = (skillGroups: SkillGroup[]): number =>
  skillGroups
    .filter((group): group is SkillTagGroup => group.type === "tags")
    .reduce((total, group) => total + group.items.length, 0);

export const sortSkillGroupsForLayout = (skillGroups: SkillGroup[]): SkillGroup[] =>
  [...skillGroups].sort((left, right) => {
    if (left.type === right.type) {
      return 0;
    }

    return left.type === "bars" ? -1 : 1;
  });

export const canAddFactory = (state: CvData, path: string, factory: string): boolean => {
  if (factory === "skill-bar-group" || factory === "skill-tag-group") {
    return state.skillGroups.length < LIMITS.maxSkillGroups;
  }

  if (factory === "skill-bar-item") {
    return countSkillBars(state.skillGroups) < LIMITS.maxSkillBars;
  }

  if (factory === "tag-item") {
    return countTags(state.skillGroups) < LIMITS.maxTags;
  }

  if (factory === "highlight") {
    return state.highlights.length < LIMITS.maxHighlights;
  }

  if (factory === "certification") {
    return state.certifications.length < LIMITS.maxCertifications;
  }

  if (factory === "language") {
    return state.languages.length < LIMITS.maxLanguages;
  }

  if (factory === "experience") {
    return state.experiences.length < LIMITS.maxExperiences;
  }

  if (factory === "project") {
    const projectList = getValueAtPath<ExperienceProject[]>(state, path);
    return Array.isArray(projectList) && projectList.length < LIMITS.maxProjectsPerExperience;
  }

  if (factory === "bullet") {
    const bullets = getValueAtPath<TextItem[]>(state, path);
    return Array.isArray(bullets) && bullets.length < LIMITS.maxBulletsPerList;
  }

  return true;
};

export const createItemFromFactory = (factory: string): unknown => {
  switch (factory) {
    case "skill-bar-group":
      return createSkillBarGroup();
    case "skill-tag-group":
      return createSkillTagGroup();
    case "skill-bar-item":
      return createSkillBarItem();
    case "tag-item":
      return createTagItem();
    case "highlight":
      return createTextItem("Nouveau highlight");
    case "certification":
      return createSidebarCard("certification", "Nouvelle certification", "2026");
    case "formation":
      return createSidebarCard("formation", "Nouvelle formation", "2026");
    case "language":
      return createLanguageCard();
    case "experience":
      return createExperience();
    case "project":
      return createProject();
    case "bullet":
      return createTextItem("Nouvelle contribution");
    default:
      return null;
  }
};

export const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const getValueAtPath = <T>(source: unknown, path: string): T | undefined => {
  if (!path) {
    return source as T;
  }

  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === undefined || current === null) {
      return undefined;
    }

    if (/^\d+$/.test(segment)) {
      return (current as unknown[])[Number(segment)];
    }

    return (current as Record<string, unknown>)[segment];
  }, source) as T | undefined;
};

export const setValueAtPath = (source: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = path.split(".");
  const last = segments.pop();

  if (!last) {
    return;
  }

  const target = segments.reduce<Record<string, unknown> | unknown[]>((current, segment) => {
    if (/^\d+$/.test(segment)) {
      return (current as unknown[])[Number(segment)] as Record<string, unknown> | unknown[];
    }

    return (current as Record<string, unknown>)[segment] as Record<string, unknown> | unknown[];
  }, source);

  if (/^\d+$/.test(last)) {
    (target as unknown[])[Number(last)] = value;
  } else {
    (target as Record<string, unknown>)[last] = value;
  }
};

export const addItemAtPath = (source: Record<string, unknown>, path: string, value: unknown): void => {
  const target = getValueAtPath<unknown[]>(source, path);

  if (Array.isArray(target)) {
    target.push(value);
  }
};

export const insertItemAtPath = (
  source: Record<string, unknown>,
  path: string,
  value: unknown,
  index: number,
): void => {
  const target = getValueAtPath<unknown[]>(source, path);

  if (!Array.isArray(target)) {
    return;
  }

  const safeIndex = Math.max(0, Math.min(index, target.length));
  target.splice(safeIndex, 0, value);
};

export const removeItemAtPath = (source: Record<string, unknown>, path: string, index: number): void => {
  const target = getValueAtPath<unknown[]>(source, path);

  if (Array.isArray(target)) {
    target.splice(index, 1);
  }
};

export const moveItemAtPath = (
  source: Record<string, unknown>,
  path: string,
  index: number,
  direction: -1 | 1,
): void => {
  const target = getValueAtPath<unknown[]>(source, path);

  if (!Array.isArray(target)) {
    return;
  }

  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= target.length) {
    return;
  }

  const [item] = target.splice(index, 1);
  target.splice(nextIndex, 0, item);
};

const normalizeTextItem = (input: unknown, fallback: string): TextItem => {
  const item = asRecord(input);
  return {
    id: asString(item.id, createId("text")),
    text: asString(item.text, fallback),
  };
};

const normalizeSkillGroup = (input: unknown): SkillGroup => {
  const item = asRecord(input);
  const type = item.type === "tags" ? "tags" : "bars";

  if (type === "tags") {
    return {
      id: asString(item.id, createId("tag-group")),
      title: asString(item.title, "Langages & Outils"),
      type,
      items: asArray<unknown>(item.items).map((entry) => {
        const tag = asRecord(entry);
        return {
          id: asString(tag.id, createId("tag")),
          label: asString(tag.label, "Nouveau tag"),
        };
      }),
    };
  }

  return {
    id: asString(item.id, createId("skill-group")),
    title: asString(item.title, "Bloc de compétences"),
    type,
    items: asArray<unknown>(item.items).map((entry) => {
      const skill = asRecord(entry);
      return {
        id: asString(skill.id, createId("skill")),
        label: asString(skill.label, "Nouvelle compétence"),
        level: Math.min(100, Math.max(0, asNumber(skill.level, 60))),
      };
    }),
  };
};

const normalizeSidebarCard = (
  input: unknown,
  fallbackTitle: string,
  fallbackSubtitle: string,
  fallbackIcon: CardIcon,
): SidebarCard => {
  const item = asRecord(input);
  const icon = item.icon === "formation" || item.icon === "generic" ? item.icon : fallbackIcon;
  return {
    id: asString(item.id, createId("card")),
    icon,
    title: asString(item.title, fallbackTitle),
    subtitle: asString(item.subtitle, fallbackSubtitle),
    meta: asString(item.meta),
  };
};

const normalizeLanguage = (input: unknown): LanguageCard => {
  const item = asRecord(input);
  return {
    id: asString(item.id, createId("lang")),
    title: asString(item.title, "Nouvelle langue"),
    subtitle: asString(item.subtitle, "Niveau à préciser"),
  };
};

const normalizeProject = (input: unknown): ExperienceProject => {
  const item = asRecord(input);
  return {
    id: asString(item.id, createId("project")),
    title: asString(item.title, "Nouveau projet"),
    period: asString(item.period, "2025"),
    bullets: asArray<unknown>(item.bullets).map((entry) =>
      normalizeTextItem(entry, "Décrire la contribution."),
    ),
    techEnvironmentLabel: asString(item.techEnvironmentLabel, "Environnement technique"),
    techEnvironment: asString(item.techEnvironment, "Technologies à préciser"),
  };
};

const normalizeExperience = (input: unknown): Experience => {
  const item = asRecord(input);
  return {
    id: asString(item.id, createId("experience")),
    company: asString(item.company, "Nouvelle entreprise"),
    role: asString(item.role, "Nouveau rôle"),
    period: asString(item.period, "2025"),
    subtitle: asString(item.subtitle, "Sous-projet ou périmètre"),
    bullets: asArray<unknown>(item.bullets).map((entry) =>
      normalizeTextItem(entry, "Décrire la mission."),
    ),
    techEnvironmentLabel: asString(item.techEnvironmentLabel, "Environnement technique"),
    techEnvironment: asString(item.techEnvironment, "Technologies à préciser"),
    projects: asArray<unknown>(item.projects).map(normalizeProject),
  };
};

export const normalizeCvData = (input: unknown): CvData => {
  const source = asRecord(input);
  const header = asRecord(source.header);
  const mainEducation = asRecord(source.mainEducation);
  const render = asRecord(source.render);
  const maxPagesValue = render.maxPages;
  const maxPages =
    maxPagesValue === 1 || maxPagesValue === 2 || maxPagesValue === 3 ? maxPagesValue : null;

  const name = asString(header.name, "Alex Martin");

  return {
    header: {
      name,
      badgeText: asString(header.badgeText, getDefaultBadgeText(name)),
      headline: asString(
        header.headline,
        "CLOUD & PLATFORM ENGINEER | SOLUTION ARCHITECT | DEVOPS",
      ),
      location: asString(header.location, "France"),
      email: asString(header.email, "alex.martin@example.com"),
      linkedin: asString(header.linkedin, "linkedin.com/in/alex-martin"),
      availabilityText: asString(
        header.availabilityText,
        "Disponible pour des missions en architecture Cloud, plateforme et DevOps",
      ),
      qrCodeLabel: asString(header.qrCodeLabel, "Version web"),
      qrCodeUrl: asString(header.qrCodeUrl, "https://example.com/cv"),
      showQrCode: asBoolean(header.showQrCode, true),
    },
    profileLabel: asString(source.profileLabel, "Profil professionnel"),
    profile: asString(
      source.profile,
      "Architecte Cloud et ingénieur DevOps avec une expérience en développement, conception technique, leadership technique et mise en œuvre de plateformes.",
    ),
    skillGroups: sortSkillGroupsForLayout(asArray<unknown>(source.skillGroups).map(normalizeSkillGroup)),
    highlights: asArray<unknown>(source.highlights).map((entry) =>
      normalizeTextItem(entry, "Nouveau highlight"),
    ),
    certifications: asArray<unknown>(source.certifications).map((entry) =>
      normalizeSidebarCard(entry, "Nouvelle certification", "2026", "certification"),
    ),
    formations: asArray<unknown>(source.formations).map((entry) =>
      normalizeSidebarCard(entry, "Nouvelle formation", "2026", "formation"),
    ),
    languages: asArray<unknown>(source.languages).map(normalizeLanguage),
    experiences: asArray<unknown>(source.experiences).map(normalizeExperience),
    mainEducation: {
      enabled: asBoolean(mainEducation.enabled, true),
      title: asString(mainEducation.title, "Formation"),
      summary: asString(
        mainEducation.summary,
        "Ajouter ici un rappel de formation ou de certifications complémentaires.",
      ),
    },
    render: {
      mode: render.mode === "preview" ? "preview" : "edit",
      maxPages,
      theme: asTheme(render.theme),
      sidebarPosition: asSidebarPosition(render.sidebarPosition),
    },
  };
};
