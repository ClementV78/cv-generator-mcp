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

export const cvDataJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://cv-generator.local/schema/cv-data.json",
  title: "CvData",
  type: "object",
  additionalProperties: false,
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
        name: { type: "string" },
        badgeText: { type: "string" },
        headline: { type: "string" },
        location: { type: "string" },
        email: { type: "string" },
        linkedin: { type: "string" },
        availabilityText: { type: "string" },
        qrCodeLabel: { type: "string" },
        qrCodeUrl: { type: "string" },
        showQrCode: { type: "boolean" },
      },
    },
    profileLabel: { type: "string" },
    profile: { type: "string" },
    skillGroups: {
      type: "array",
      items: {
        oneOf: [
          {
            type: "object",
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
      items: { $ref: "#/$defs/textItem" },
    },
    certifications: {
      type: "array",
      items: { $ref: "#/$defs/sidebarCard" },
    },
    formations: {
      type: "array",
      items: { $ref: "#/$defs/sidebarCard" },
    },
    languages: {
      type: "array",
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
      additionalProperties: false,
      required: ["id", "text"],
      properties: {
        id: { type: "string" },
        text: { type: "string" },
      },
    },
    sidebarCard: {
      type: "object",
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
