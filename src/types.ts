export type EditorMode = "edit" | "preview";
export type CardIcon = "certification" | "formation" | "generic";
export type SkillGroupType = "bars" | "tags";
export type CvTheme =
  | "ocean"
  | "zen"
  | "zen-cream"
  | "zen-orange"
  | "claude"
  | "graphite"
  | "cyber"
  | "cyber-purple";
export type SidebarPosition = "left" | "right";
export const CV_LANGUAGE_VALUES = ["english", "french", "spanish"] as const;
export type CvLanguage = (typeof CV_LANGUAGE_VALUES)[number];

export interface HeaderData {
  name: string;
  badgeText: string;
  headline: string;
  location: string;
  email: string;
  linkedin: string;
  availabilityText: string;
  qrCodeLabel: string;
  qrCodeUrl: string;
  showQrCode: boolean;
}

export interface TextItem {
  id: string;
  text: string;
}

export interface TagItem {
  id: string;
  label: string;
}

export interface SkillBarItem {
  id: string;
  label: string;
  level: number;
}

export interface SkillBarGroup {
  id: string;
  title: string;
  type: "bars";
  items: SkillBarItem[];
}

export interface SkillTagGroup {
  id: string;
  title: string;
  type: "tags";
  items: TagItem[];
}

export type SkillGroup = SkillBarGroup | SkillTagGroup;

export interface SidebarCard {
  id: string;
  icon: CardIcon;
  title: string;
  subtitle: string;
  meta?: string;
}

export interface LanguageCard {
  id: string;
  title: string;
  subtitle: string;
}

export interface ExperienceProject {
  id: string;
  title: string;
  period: string;
  bullets: TextItem[];
  techEnvironmentLabel: string;
  techEnvironment: string;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  period: string;
  subtitle: string;
  bullets: TextItem[];
  techEnvironmentLabel: string;
  techEnvironment: string;
  projects: ExperienceProject[];
}

export interface MainEducationBlock {
  enabled: boolean;
  title: string;
  summary: string;
}

export interface RenderSettings {
  mode: EditorMode;
  maxPages: 1 | 2 | 3 | null;
  theme: CvTheme;
  sidebarPosition: SidebarPosition;
  language: CvLanguage;
}

export interface CvData {
  header: HeaderData;
  profileLabel: string;
  profile: string;
  skillGroups: SkillGroup[];
  highlights: TextItem[];
  certifications: SidebarCard[];
  formations: SidebarCard[];
  languages: LanguageCard[];
  experiences: Experience[];
  mainEducation: MainEducationBlock;
  render: RenderSettings;
}

export interface ValidationIssue {
  id: string;
  message: string;
  targetBind?: string;
}

export interface ValidationResult {
  pageCount: number;
  issues: ValidationIssue[];
  structureMessages: string[];
  pageLimitExceeded: boolean;
}
