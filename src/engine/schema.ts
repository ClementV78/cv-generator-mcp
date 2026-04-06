export const CV_THEME_VALUES = [
  "ocean",
  "zen",
  "zen-cream",
  "zen-orange",
  "claude",
  "graphite",
  "cyber",
  "cyber-purple",
] as const;

export const SIDEBAR_POSITION_VALUES = ["left", "right"] as const;
export const CARD_ICON_VALUES = ["certification", "formation", "generic"] as const;
export const SKILL_GROUP_TYPE_VALUES = ["bars", "tags"] as const;

const cvDataMinimalExample = {
  header: {
    name: "Thomas Dubois",
    badgeText: "T.D",
    headline: "ARCHITECTE CLOUD SENIOR | AWS | AZURE | KUBERNETES",
    location: "Paris, France",
    email: "thomas.dubois@email.com",
    linkedin: "linkedin.com/in/thomas-dubois-cloud",
    availabilityText: "Disponible pour des missions d'architecture cloud.",
    qrCodeLabel: "Version web",
    qrCodeUrl: "https://example.com/cv/thomas-dubois",
    showQrCode: true,
  },
  profileLabel: "Profil professionnel",
  profile:
    "Architecte Cloud avec 10 ans d'experience en conception de plateformes scalables.",
  skillGroups: [
    {
      id: "skill-group-1",
      title: "Cloud & Plateforme",
      type: "bars",
      items: [
        { id: "skill-1", label: "AWS", level: 92 },
        { id: "skill-2", label: "Azure", level: 86 },
      ],
    },
    {
      id: "tag-group-1",
      title: "Langages & Outils",
      type: "tags",
      items: [
        { id: "tag-1", label: "Terraform" },
        { id: "tag-2", label: "Kubernetes" },
      ],
    },
  ],
  highlights: [{ id: "highlight-1", text: "Migration cloud de 40+ applications critiques." }],
  certifications: [
    {
      id: "cert-1",
      icon: "certification",
      title: "AWS Solutions Architect Professional",
      subtitle: "2025",
    },
  ],
  formations: [
    {
      id: "formation-1",
      icon: "formation",
      title: "Master Informatique",
      subtitle: "Ecole Polytechnique",
      meta: "2013",
    },
  ],
  languages: [{ id: "lang-1", title: "Francais", subtitle: "langue maternelle" }],
  experiences: [
    {
      id: "exp-1",
      company: "CloudScale Solutions",
      role: "Lead Cloud Architect",
      period: "2021 - Present",
      subtitle: "Architecture cloud pour clients enterprise",
      bullets: [
        { id: "bullet-1", text: "Conception d'architectures AWS/Azure hautement disponibles." },
      ],
      techEnvironmentLabel: "Environnement technique",
      techEnvironment: "AWS, Azure, Kubernetes, Terraform",
      projects: [],
    },
  ],
  mainEducation: {
    enabled: true,
    title: "Formation",
    summary: "Master Informatique - Ecole Polytechnique.",
  },
  render: {
    mode: "preview",
    maxPages: 2,
    theme: "ocean",
    sidebarPosition: "left",
  },
} as const;

export const cvDataJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://cv-generator.local/schema/cv-data.json",
  title: "CvData",
  description:
    "Contrat canonical du CV. IMPORTANT: utilisez header/profile/experiences/skillGroups. N'utilisez pas personalInfo/summary/experience/skills/education.",
  $comment:
    "Workflow conseille pour un agent: 1) get_cv_schema 2) construire cv_data conforme 3) validate_cv 4) generate_cv_pdf ou generate_cv_html.",
  type: "object",
  additionalProperties: false,
  examples: [cvDataMinimalExample],
  required: [
    "header",
    "profileLabel",
    "profile",
    "skillGroups",
    "highlights",
    "certifications",
    "formations",
    "languages",
    "experiences",
    "mainEducation",
    "render",
  ],
  properties: {
    header: {
      type: "object",
      description: "Bloc d'identite principal affiche en tete et dans la sidebar.",
      additionalProperties: false,
      required: [
        "name",
        "badgeText",
        "headline",
        "location",
        "email",
        "linkedin",
        "availabilityText",
        "qrCodeLabel",
        "qrCodeUrl",
        "showQrCode",
      ],
      properties: {
        name: { type: "string", description: "Nom complet affiche en en-tete." },
        badgeText: { type: "string", description: "Initiales/badge (ex: T.D)." },
        headline: {
          type: "string",
          description: "Titre principal en haut de la colonne principale.",
        },
        location: { type: "string", description: "Localisation courte." },
        email: { type: "string", description: "Adresse email de contact." },
        linkedin: { type: "string", description: "Lien LinkedIn (sans https possible)." },
        availabilityText: {
          type: "string",
          description: "Texte de disponibilite affiche dans la sidebar.",
        },
        qrCodeLabel: { type: "string", description: "Libelle sous le QR code." },
        qrCodeUrl: { type: "string", description: "URL encodee dans le QR code." },
        showQrCode: { type: "boolean", description: "Active/desactive le QR code." },
      },
    },
    profileLabel: { type: "string", description: "Libelle de section (ex: Profil professionnel)." },
    profile: {
      type: "string",
      description: "Resume professionnel court.",
    },
    skillGroups: {
      type: "array",
      description:
        "Groupes de competences. Utilisez type='bars' pour niveaux (0-100) ou type='tags' pour tags.",
      items: {
        oneOf: [
          {
            type: "object",
            description: "Groupe de competences a barres de niveau.",
            additionalProperties: false,
            required: ["id", "title", "type", "items"],
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              type: { type: "string", enum: ["bars"] },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "label", "level"],
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    level: { type: "number", minimum: 0, maximum: 100 },
                  },
                },
              },
            },
          },
          {
            type: "object",
            description: "Groupe de competences en tags.",
            additionalProperties: false,
            required: ["id", "title", "type", "items"],
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              type: { type: "string", enum: ["tags"] },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "label"],
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                  },
                },
              },
            },
          },
        ],
      },
    },
    highlights: {
      type: "array",
      description: "Liste de points forts (sidebar).",
      items: { $ref: "#/$defs/textItem" },
    },
    certifications: {
      type: "array",
      description: "Cartes certifications (sidebar).",
      items: { $ref: "#/$defs/sidebarCard" },
    },
    formations: {
      type: "array",
      description: "Cartes formations (sidebar).",
      items: { $ref: "#/$defs/sidebarCard" },
    },
    languages: {
      type: "array",
      description: "Langues affichees dans la sidebar.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "subtitle"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          subtitle: { type: "string" },
        },
      },
    },
    experiences: {
      type: "array",
      description:
        "Experiences principales. IMPORTANT: le champ est experiences (pas experience). Chaque experience inclut bullets, techEnvironment et projects.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "company",
          "role",
          "period",
          "subtitle",
          "bullets",
          "techEnvironmentLabel",
          "techEnvironment",
          "projects",
        ],
        properties: {
          id: { type: "string" },
          company: { type: "string" },
          role: { type: "string" },
          period: { type: "string" },
          subtitle: { type: "string" },
          bullets: {
            type: "array",
            items: { $ref: "#/$defs/textItem" },
          },
          techEnvironmentLabel: { type: "string" },
          techEnvironment: { type: "string" },
          projects: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "id",
                "title",
                "period",
                "bullets",
                "techEnvironmentLabel",
                "techEnvironment",
              ],
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                period: { type: "string" },
                bullets: {
                  type: "array",
                  items: { $ref: "#/$defs/textItem" },
                },
                techEnvironmentLabel: { type: "string" },
                techEnvironment: { type: "string" },
              },
            },
          },
        },
      },
    },
    mainEducation: {
      type: "object",
      description: "Bloc education principal en bas de colonne droite.",
      additionalProperties: false,
      required: ["enabled", "title", "summary"],
      properties: {
        enabled: { type: "boolean" },
        title: { type: "string" },
        summary: { type: "string" },
      },
    },
    render: {
      type: "object",
      description: "Options de rendu visuel du template.",
      additionalProperties: false,
      required: ["mode", "maxPages", "theme", "sidebarPosition"],
      properties: {
        mode: { type: "string", enum: ["edit", "preview"] },
        maxPages: {
          oneOf: [{ type: "null" }, { type: "integer", enum: [1, 2, 3] }],
        },
        theme: { type: "string", enum: [...CV_THEME_VALUES] },
        sidebarPosition: { type: "string", enum: [...SIDEBAR_POSITION_VALUES] },
      },
    },
  },
  $defs: {
    textItem: {
      type: "object",
      description: "Element texte avec identifiant stable.",
      additionalProperties: false,
      required: ["id", "text"],
      properties: {
        id: { type: "string" },
        text: { type: "string" },
      },
    },
    sidebarCard: {
      type: "object",
      description: "Carte de sidebar (certification ou formation).",
      additionalProperties: false,
      required: ["id", "icon", "title", "subtitle"],
      properties: {
        id: { type: "string" },
        icon: { type: "string", enum: [...CARD_ICON_VALUES] },
        title: { type: "string" },
        subtitle: { type: "string" },
        meta: { type: "string" },
      },
    },
  },
} as const;

export type CvDataJsonSchema = typeof cvDataJsonSchema;

export const getCvDataJsonSchema = (): CvDataJsonSchema => cvDataJsonSchema;
