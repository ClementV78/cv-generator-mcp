import type { CvLanguage } from "./types";

export const normalizeCvLanguage = (value: unknown, fallback: CvLanguage = "english"): CvLanguage =>
  value === "french" || value === "spanish" || value === "english" ? value : fallback;

export interface CvLanguageCopy {
  htmlLang: "en" | "fr" | "es";
  documentTitleSuffix: string;
  sectionSkills: string;
  sectionHighlights: string;
  sectionCertifications: string;
  sectionFormations: string;
  sectionLanguages: string;
  sectionExperienceAndProjects: string;
  labelTitle: string;
  labelSecondary: string;
  labelMetadata: string;
  labelLanguageLevel: string;
  labelPeriod: string;
  labelExperienceSubtitle: string;
  labelBulletPoint: string;
  labelCompany: string;
  labelBadgeText: string;
  labelLocation: string;
  labelAvailability: string;
  labelQrCode: string;
  labelQrCodeUrl: string;
  labelName: string;
  labelHeadline: string;
  labelProfileText: string;
  labelMainEducationTitle: string;
  labelMainEducationSummary: string;
  pageLimitExceeded: (maxPages: number) => string;
  structure: {
    maxSkillGroups: (value: number) => string;
    maxSkillBars: (value: number) => string;
    maxTags: (value: number) => string;
    maxHighlights: (value: number) => string;
    maxCertifications: (value: number) => string;
    maxLanguages: (value: number) => string;
    maxExperiences: (value: number) => string;
    maxProjectsPerExperience: (value: number) => string;
    maxBulletsPerExperience: (value: number) => string;
    maxBulletsPerProject: (value: number) => string;
  };
  defaults: {
    availabilityText: string;
    qrCodeLabel: string;
    profileLabel: string;
    profile: string;
    tagGroupTitle: string;
    newTag: string;
    newTextLine: string;
    newSkillLabel: string;
    newSkillGroupTitle: string;
    newCardTitle: string;
    newCardSubtitle: string;
    newLanguageTitle: string;
    newLanguageSubtitle: string;
    newProjectTitle: string;
    newProjectBullet: string;
    techEnvironmentLabel: string;
    technologiesToSpecify: string;
    newExperienceCompany: string;
    newExperienceRole: string;
    newExperienceSubtitle: string;
    newExperienceBullet: string;
    mainEducationTitle: string;
    mainEducationSummary: string;
  };
}

const ENGLISH_COPY: CvLanguageCopy = {
  htmlLang: "en",
  documentTitleSuffix: "Resume",
  sectionSkills: "Skills",
  sectionHighlights: "Highlights",
  sectionCertifications: "Certifications",
  sectionFormations: "Education",
  sectionLanguages: "Languages",
  sectionExperienceAndProjects: "Professional Experience and Projects",
  labelTitle: "Title",
  labelSecondary: "Secondary label",
  labelMetadata: "Metadata",
  labelLanguageLevel: "Language level",
  labelPeriod: "Period",
  labelExperienceSubtitle: "Experience subtitle",
  labelBulletPoint: "Bullet point",
  labelCompany: "Company",
  labelBadgeText: "Badge text",
  labelLocation: "Location",
  labelAvailability: "Availability",
  labelQrCode: "QR label",
  labelQrCodeUrl: "QR code URL",
  labelName: "Name",
  labelHeadline: "Headline",
  labelProfileText: "Professional profile",
  labelMainEducationTitle: "Education title",
  labelMainEducationSummary: "Education summary",
  pageLimitExceeded: (maxPages) => `The rendered CV exceeds the ${maxPages}-page limit.`,
  structure: {
    maxSkillGroups: (value) => `Maximum ${value} skill groups.`,
    maxSkillBars: (value) => `Maximum ${value} bar-based skills.`,
    maxTags: (value) => `Maximum ${value} tags in tag-based skill groups.`,
    maxHighlights: (value) => `Maximum ${value} highlights.`,
    maxCertifications: (value) => `Maximum ${value} certifications.`,
    maxLanguages: (value) => `Maximum ${value} languages.`,
    maxExperiences: (value) => `Maximum ${value} experiences.`,
    maxProjectsPerExperience: (value) => `Maximum ${value} projects per experience.`,
    maxBulletsPerExperience: (value) => `Maximum ${value} bullet points per experience.`,
    maxBulletsPerProject: (value) => `Maximum ${value} bullet points per project.`,
  },
  defaults: {
    availabilityText: "Available for cloud architecture, platform, and DevOps roles.",
    qrCodeLabel: "Web version",
    profileLabel: "Professional profile",
    profile:
      "Cloud architect and DevOps engineer with experience in software development, platform design, technical leadership, and scalable infrastructure delivery.",
    tagGroupTitle: "Languages & Tools",
    newTag: "New tag",
    newTextLine: "New line",
    newSkillLabel: "New skill",
    newSkillGroupTitle: "New skill group",
    newCardTitle: "New card",
    newCardSubtitle: "Subtitle",
    newLanguageTitle: "New language",
    newLanguageSubtitle: "Level to specify",
    newProjectTitle: "New project",
    newProjectBullet: "Describe the scope and contribution.",
    techEnvironmentLabel: "Technical environment",
    technologiesToSpecify: "Technologies to specify",
    newExperienceCompany: "New company",
    newExperienceRole: "New role",
    newExperienceSubtitle: "Project / scope",
    newExperienceBullet: "Describe the mission and the main contribution.",
    mainEducationTitle: "Education",
    mainEducationSummary: "Add a concise education or certification summary here.",
  },
};

const FRENCH_COPY: CvLanguageCopy = {
  htmlLang: "fr",
  documentTitleSuffix: "CV",
  sectionSkills: "Compétences",
  sectionHighlights: "Points forts",
  sectionCertifications: "Certifications",
  sectionFormations: "Formations",
  sectionLanguages: "Langues",
  sectionExperienceAndProjects: "Expériences professionnelles et projets",
  labelTitle: "Titre",
  labelSecondary: "Libellé secondaire",
  labelMetadata: "Méta",
  labelLanguageLevel: "Niveau de langue",
  labelPeriod: "Période",
  labelExperienceSubtitle: "Sous-titre d'expérience",
  labelBulletPoint: "Point",
  labelCompany: "Entreprise",
  labelBadgeText: "Texte du badge",
  labelLocation: "Localisation",
  labelAvailability: "Disponibilité",
  labelQrCode: "Libellé QR",
  labelQrCodeUrl: "URL du QR code",
  labelName: "Nom",
  labelHeadline: "Titre principal",
  labelProfileText: "Profil professionnel",
  labelMainEducationTitle: "Titre formation",
  labelMainEducationSummary: "Formation principale",
  pageLimitExceeded: (maxPages) => `Le rendu dépasse la limite de ${maxPages} pages.`,
  structure: {
    maxSkillGroups: (value) => `Maximum ${value} blocs de compétences.`,
    maxSkillBars: (value) => `Maximum ${value} compétences à barres.`,
    maxTags: (value) => `Maximum ${value} tags dans les groupes de type tags.`,
    maxHighlights: (value) => `Maximum ${value} points forts.`,
    maxCertifications: (value) => `Maximum ${value} certifications.`,
    maxLanguages: (value) => `Maximum ${value} langues.`,
    maxExperiences: (value) => `Maximum ${value} expériences.`,
    maxProjectsPerExperience: (value) => `Maximum ${value} projets par expérience.`,
    maxBulletsPerExperience: (value) => `Maximum ${value} points par expérience.`,
    maxBulletsPerProject: (value) => `Maximum ${value} points par projet.`,
  },
  defaults: {
    availabilityText: "Disponible pour des missions en architecture Cloud, plateforme et DevOps",
    qrCodeLabel: "Version web",
    profileLabel: "Profil professionnel",
    profile:
      "Architecte Cloud et ingénieur DevOps avec une expérience en développement, conception technique, leadership technique et mise en œuvre de plateformes.",
    tagGroupTitle: "Langages & Outils",
    newTag: "Nouveau tag",
    newTextLine: "Nouvelle ligne",
    newSkillLabel: "Nouvelle compétence",
    newSkillGroupTitle: "Nouveau bloc de compétences",
    newCardTitle: "Nouvelle carte",
    newCardSubtitle: "Sous-titre",
    newLanguageTitle: "Nouvelle langue",
    newLanguageSubtitle: "Niveau à préciser",
    newProjectTitle: "Nouveau projet",
    newProjectBullet: "Décrire le périmètre et la contribution.",
    techEnvironmentLabel: "Environnement technique",
    technologiesToSpecify: "Technologies à préciser",
    newExperienceCompany: "Nouvelle entreprise",
    newExperienceRole: "Nouveau rôle",
    newExperienceSubtitle: "Projet / périmètre",
    newExperienceBullet: "Décrire la mission et la contribution principale.",
    mainEducationTitle: "Formation",
    mainEducationSummary: "Ajouter ici un rappel de formation ou de certifications complémentaires.",
  },
};

const SPANISH_COPY: CvLanguageCopy = {
  htmlLang: "es",
  documentTitleSuffix: "CV",
  sectionSkills: "Competencias",
  sectionHighlights: "Puntos destacados",
  sectionCertifications: "Certificaciones",
  sectionFormations: "Formación",
  sectionLanguages: "Idiomas",
  sectionExperienceAndProjects: "Experiencia profesional y proyectos",
  labelTitle: "Título",
  labelSecondary: "Etiqueta secundaria",
  labelMetadata: "Metadatos",
  labelLanguageLevel: "Nivel de idioma",
  labelPeriod: "Período",
  labelExperienceSubtitle: "Subtítulo de experiencia",
  labelBulletPoint: "Viñeta",
  labelCompany: "Empresa",
  labelBadgeText: "Texto del distintivo",
  labelLocation: "Ubicación",
  labelAvailability: "Disponibilidad",
  labelQrCode: "Etiqueta QR",
  labelQrCodeUrl: "URL del código QR",
  labelName: "Nombre",
  labelHeadline: "Titular",
  labelProfileText: "Perfil profesional",
  labelMainEducationTitle: "Título de formación",
  labelMainEducationSummary: "Resumen de formación",
  pageLimitExceeded: (maxPages) => `El CV supera el límite de ${maxPages} páginas.`,
  structure: {
    maxSkillGroups: (value) => `Máximo ${value} bloques de competencias.`,
    maxSkillBars: (value) => `Máximo ${value} competencias con barras.`,
    maxTags: (value) => `Máximo ${value} etiquetas en los grupos de tipo tags.`,
    maxHighlights: (value) => `Máximo ${value} puntos destacados.`,
    maxCertifications: (value) => `Máximo ${value} certificaciones.`,
    maxLanguages: (value) => `Máximo ${value} idiomas.`,
    maxExperiences: (value) => `Máximo ${value} experiencias.`,
    maxProjectsPerExperience: (value) => `Máximo ${value} proyectos por experiencia.`,
    maxBulletsPerExperience: (value) => `Máximo ${value} viñetas por experiencia.`,
    maxBulletsPerProject: (value) => `Máximo ${value} viñetas por proyecto.`,
  },
  defaults: {
    availabilityText: "Disponible para puestos de arquitectura cloud, plataforma y DevOps.",
    qrCodeLabel: "Versión web",
    profileLabel: "Perfil profesional",
    profile:
      "Arquitecto cloud e ingeniero DevOps con experiencia en desarrollo de software, diseño técnico, liderazgo técnico y entrega de plataformas escalables.",
    tagGroupTitle: "Lenguajes y herramientas",
    newTag: "Nueva etiqueta",
    newTextLine: "Nueva línea",
    newSkillLabel: "Nueva competencia",
    newSkillGroupTitle: "Nuevo bloque de competencias",
    newCardTitle: "Nueva tarjeta",
    newCardSubtitle: "Subtítulo",
    newLanguageTitle: "Nuevo idioma",
    newLanguageSubtitle: "Nivel por definir",
    newProjectTitle: "Nuevo proyecto",
    newProjectBullet: "Describe el alcance y la contribución.",
    techEnvironmentLabel: "Entorno técnico",
    technologiesToSpecify: "Tecnologías por definir",
    newExperienceCompany: "Nueva empresa",
    newExperienceRole: "Nuevo puesto",
    newExperienceSubtitle: "Proyecto / alcance",
    newExperienceBullet: "Describe la misión y la contribución principal.",
    mainEducationTitle: "Formación",
    mainEducationSummary: "Añade aquí un resumen breve de formación o certificaciones complementarias.",
  },
};

export const getCvLanguageCopy = (language: CvLanguage): CvLanguageCopy => {
  switch (language) {
    case "french":
      return FRENCH_COPY;
    case "spanish":
      return SPANISH_COPY;
    case "english":
    default:
      return ENGLISH_COPY;
  }
};

const gatherLanguageHints = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(gatherLanguageHints);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(gatherLanguageHints);
  }
  return [];
};

export const inferCvLanguage = (input: unknown): CvLanguage => {
  const haystack = gatherLanguageHints(input)
    .join(" ")
    .toLowerCase();

  if (
    /\b(perfil profesional|idiomas|formaci[oó]n|entorno t[eé]cnico|disponible para|ingenier[oa]|experiencia profesional)\b/u.test(
      haystack,
    )
  ) {
    return "spanish";
  }

  if (
    /\b(profil professionnel|langues|formation|environnement technique|disponible|ing[ée]nieur|exp[ée]riences professionnelles)\b/u.test(
      haystack,
    )
  ) {
    return "french";
  }

  return "english";
};
