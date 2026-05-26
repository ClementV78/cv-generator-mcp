import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { generateCvArtifact, getCvSchema, validateCvInput } from "../engine/service";
import { writeBinaryArtifactToTempFile } from "../engine/output";
import { CvValidationError } from "../engine/validateNode";
import { PdfRenderError } from "../engine/renderPdf";

const MAX_SINGLE_CALL_CV_DATA_CHARS = 5000;
const MAX_CHUNK_CHARS = 5000;
const MAX_TOTAL_CHUNKED_CV_DATA_CHARS = 500_000;
const MAX_CV_DATA_FILE_BYTES = 1_000_000;
const UPLOAD_SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_ACTIVE_UPLOAD_SESSIONS = 64;
const ALLOWED_INPUT_DIR_ENV = "CV_GENERATOR_ALLOWED_INPUT_DIR";
const ALLOWED_ASSET_DIR_ENV = "CV_GENERATOR_ALLOWED_ASSET_DIR";
const OUTPUT_DIR_ENV = "CV_GENERATOR_OUTPUT_DIR";

const cvDataInputSchema = z.object({
  cv_data: z.unknown().optional(),
  cv_data_path: z.string().min(1).optional(),
  browser_executable_path: z.string().optional(),
});

const pdfToolInputSchema = cvDataInputSchema.extend({
  pdf_mode: z.enum(["paginated", "continuous"]).optional(),
});

const startChunkedGenerationInputSchema = z.object({
  upload_id: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/).optional(),
  output_format: z.enum(["pdf", "html"]).optional(),
  pdf_mode: z.enum(["paginated", "continuous"]).optional(),
  browser_executable_path: z.string().optional(),
});

const appendChunkInputSchema = z.object({
  upload_id: z.string().min(1),
  chunk_index: z.number().int().min(0),
  total_chunks: z.number().int().min(1),
  chunk: z.string().min(1).max(MAX_CHUNK_CHARS),
});

type OutputFormat = "pdf" | "html";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SKILL_DIR = path.join(PROJECT_ROOT, "skills", "cv-generator");
const SKILL_FILE_PATH = path.join(SKILL_DIR, "SKILL.md");
const SKILL_CONTRACT_PATH = path.join(SKILL_DIR, "references", "cv-contract.md");
const SKILL_AGENT_CONFIG_PATH = path.join(SKILL_DIR, "agents", "openai.yaml");

const SKILL_RESOURCE_URI = "cv-generator://skills/cv-generator/SKILL.md";
const SKILL_CONTRACT_RESOURCE_URI = "cv-generator://skills/cv-generator/references/cv-contract.md";
const SKILL_AGENT_CONFIG_RESOURCE_URI = "cv-generator://skills/cv-generator/agents/openai.yaml";

interface ChunkUploadSession {
  id: string;
  outputFormat: OutputFormat;
  pdfMode: "paginated" | "continuous";
  browserExecutablePath?: string;
  totalChunks?: number;
  chunks: Map<number, string>;
  createdAt: number;
  updatedAt: number;
}

const chunkUploadSessions = new Map<string, ChunkUploadSession>();

const compactCvDataExample = {
  header: {
    name: "Thomas Dubois",
    badgeText: "T.D",
    photoUrl: "",
    photoPath: "",
    showPhoto: false,
    photoZoom: 100,
    headline: "ARCHITECTE CLOUD SENIOR | AWS | AZURE | KUBERNETES",
    residence: "Paris, France",
    nationality: "FR 🇫🇷",
    location: "Paris, France",
    email: "thomas.dubois@email.com",
    phone: "+33 6 12 34 56 78",
    linkedin: "linkedin.com/in/thomas-dubois-cloud",
    github: "github.com/thomas-dubois",
    availabilityText: "Disponible pour des missions d'architecture cloud et de plateforme.",
    qrCodeLabel: "Version web",
    qrCodeUrl: "https://example.com/cv/thomas-dubois",
    showQrCode: false,
  },
  profileLabel: "Profil professionnel",
  profile:
    "Architecte Cloud senior avec experience en plateformes scalables, migration cloud et optimisation des couts.",
  skillGroups: [
    {
      title: "Cloud & Architecture",
      type: "bars",
      items: [
        { label: "AWS", level: 92 },
        { label: "Kubernetes", level: 84 },
        { label: "Terraform", level: 88 },
        { label: "CI/CD", level: 81 },
      ],
    },
  ],
  highlights: [{ text: "Architecture cloud, migration et plateforme." }],
  certifications: [],
  formations: [],
  languages: [],
  experiences: [
    {
      company: "CloudScale Solutions",
      role: "Lead Cloud Architect",
      period: "2021 - Present",
      subtitle: "Architecture cloud enterprise",
      bullets: [
        { text: "Conception d'architectures AWS/Azure hautement disponibles." },
      ],
      techEnvironmentLabel: "Environnement technique",
      techEnvironment: "AWS, Azure, Kubernetes, Terraform",
      projects: [],
    },
    {
      company: "TechNova Paris",
      role: "Cloud Architect",
      period: "2018 - 2021",
      subtitle: "Architecture multi-cloud finance",
      bullets: [{ text: "Optimisation des couts cloud et fiabilite des deployments." }],
      techEnvironmentLabel: "Environnement technique",
      techEnvironment: "AWS, Docker, Terraform, CI/CD",
      projects: [],
    },
    {
      company: "StartupFin Paris",
      role: "Cloud Engineer",
      period: "2015 - 2018",
      subtitle: "Migration vers Kubernetes",
      bullets: [{ text: "Migration legacy vers EKS et automatisation des pipelines." }],
      techEnvironmentLabel: "Environnement technique",
      techEnvironment: "Kubernetes, Terraform, Jenkins, AWS",
      projects: [],
    },
  ],
  render: {
    mode: "preview",
    maxPages: 2,
    theme: "ocean",
    sidebarPosition: "left",
    language: "french",
    templateStyle: "compact",
    showSkillLevels: false,
  },
} as const;

const createSuccessResponse = <T extends Record<string, unknown>>(text: string, data: T) => ({
  content: [
    {
      type: "text" as const,
      text,
    },
  ],
  structuredContent: {
    success: true,
    ...data,
  },
});

const createErrorResponse = (message: string, errorCode: string, details: Record<string, unknown> = {}) => ({
  content: [
    {
      type: "text" as const,
      text: message,
    },
  ],
  structuredContent: {
    success: false,
    error_code: errorCode,
    message,
    ...details,
  },
  isError: true,
});

const getErrorCode = (error: unknown): string => {
  if (error instanceof CvValidationError || error instanceof PdfRenderError) {
    return error.code;
  }

  return "internal_error";
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const pruneExpiredUploadSessions = (): void => {
  const now = Date.now();
  for (const [uploadId, session] of chunkUploadSessions.entries()) {
    if (now - session.updatedAt > UPLOAD_SESSION_TTL_MS) {
      chunkUploadSessions.delete(uploadId);
    }
  }
};

const getFirstMissingChunkIndex = (session: ChunkUploadSession): number | null => {
  if (!session.totalChunks) {
    return null;
  }

  for (let index = 0; index < session.totalChunks; index += 1) {
    if (!session.chunks.has(index)) {
      return index;
    }
  }

  return null;
};

const getSerializedLength = (value: unknown): number | null => {
  try {
    return JSON.stringify(value).length;
  } catch {
    return null;
  }
};

type CvDataSource =
  | {
      cvData: unknown;
      source: "inline";
      serializedLength: number;
    }
  | {
      cvData: unknown;
      source: "file";
      resolvedPath: string;
      fileSizeBytes: number;
    };

const isPathInsideDirectory = (candidatePath: string, directoryPath: string): boolean => {
  const relativePath = path.relative(directoryPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
};

const getAllowedInputDirectory = async (): Promise<string> => {
  const configuredDirectory = process.env[ALLOWED_INPUT_DIR_ENV] ?? process.cwd();
  return realpath(path.resolve(configuredDirectory));
};

const loadCvDataFromPath = async (cvDataPath: string): Promise<CvDataSource> => {
  const allowedDirectory = await getAllowedInputDirectory();
  const resolvedInputPath = path.resolve(cvDataPath);
  const resolvedFilePath = await realpath(resolvedInputPath);

  if (!isPathInsideDirectory(resolvedFilePath, allowedDirectory)) {
    throw Object.assign(
      new Error(
        `cv_data_path doit pointer vers un fichier situe dans ${ALLOWED_INPUT_DIR_ENV} ou le repertoire de travail du serveur MCP.`,
      ),
      {
        code: "cv_data_path_outside_allowed_directory",
        details: {
          cv_data_path: cvDataPath,
          resolved_cv_data_path: resolvedFilePath,
          allowed_input_dir: allowedDirectory,
        },
      },
    );
  }

  if (path.extname(resolvedFilePath).toLowerCase() !== ".json") {
    throw Object.assign(new Error("cv_data_path doit pointer vers un fichier .json."), {
      code: "invalid_cv_data_path_extension",
      details: {
        cv_data_path: cvDataPath,
        resolved_cv_data_path: resolvedFilePath,
      },
    });
  }

  const fileStat = await stat(resolvedFilePath);
  if (!fileStat.isFile()) {
    throw Object.assign(new Error("cv_data_path doit pointer vers un fichier JSON."), {
      code: "cv_data_path_not_file",
      details: {
        cv_data_path: cvDataPath,
        resolved_cv_data_path: resolvedFilePath,
      },
    });
  }

  if (fileStat.size > MAX_CV_DATA_FILE_BYTES) {
    throw Object.assign(
      new Error(`Fichier cv_data trop volumineux: maximum ${MAX_CV_DATA_FILE_BYTES} octets.`),
      {
        code: "cv_data_file_too_large",
        details: {
          cv_data_path: cvDataPath,
          resolved_cv_data_path: resolvedFilePath,
          max_file_bytes: MAX_CV_DATA_FILE_BYTES,
          received_file_bytes: fileStat.size,
        },
      },
    );
  }

  const fileText = await readFile(resolvedFilePath, "utf-8");
  try {
    return {
      cvData: JSON.parse(fileText) as unknown,
      source: "file",
      resolvedPath: resolvedFilePath,
      fileSizeBytes: fileStat.size,
    };
  } catch (error) {
    throw Object.assign(new Error(getErrorMessage(error, "Le fichier cv_data_path contient un JSON invalide.")), {
      code: "invalid_cv_data_file_json",
      details: {
        cv_data_path: cvDataPath,
        resolved_cv_data_path: resolvedFilePath,
      },
    });
  }
};

const resolveCvDataSource = async (
  cvData: unknown,
  cvDataPath: string | undefined,
): Promise<CvDataSource> => {
  const hasInlineCvData = cvData !== undefined;
  const hasCvDataPath = cvDataPath !== undefined;

  if (hasInlineCvData && hasCvDataPath) {
    throw Object.assign(new Error("Fournissez soit cv_data, soit cv_data_path, mais pas les deux."), {
      code: "ambiguous_cv_data_input",
      details: {
        accepted_inputs: ["cv_data", "cv_data_path"],
      },
    });
  }

  if (!hasInlineCvData && !hasCvDataPath) {
    throw Object.assign(new Error("Option manquante: fournissez cv_data ou cv_data_path."), {
      code: "missing_cv_data_input",
      details: {
        accepted_inputs: ["cv_data", "cv_data_path"],
      },
    });
  }

  if (hasCvDataPath) {
    return loadCvDataFromPath(cvDataPath);
  }

  const serializedLength = getSerializedLength(cvData);
  if (serializedLength === null) {
    throw Object.assign(new Error("Impossible de serialiser cv_data en JSON."), {
      code: "invalid_cv_data_payload",
    });
  }

  return {
    cvData,
    source: "inline",
    serializedLength,
  };
};

const createCvDataSourceError = (error: unknown) => {
  const maybeStructuredError = error as { code?: unknown; details?: unknown };
  return createErrorResponse(
    getErrorMessage(error, "Impossible de charger cv_data."),
    typeof maybeStructuredError.code === "string" ? maybeStructuredError.code : "invalid_cv_data_input",
    maybeStructuredError.details &&
      typeof maybeStructuredError.details === "object" &&
      !Array.isArray(maybeStructuredError.details)
      ? (maybeStructuredError.details as Record<string, unknown>)
      : {},
  );
};

const createStructuredErrorResponse = (error: unknown, fallbackMessage: string) => {
  const maybeStructuredError = error as { code?: unknown; details?: unknown };
  const details =
    maybeStructuredError.details &&
    typeof maybeStructuredError.details === "object" &&
    !Array.isArray(maybeStructuredError.details)
      ? (maybeStructuredError.details as Record<string, unknown>)
      : {};

  return createErrorResponse(
    getErrorMessage(error, fallbackMessage),
    typeof maybeStructuredError.code === "string" ? maybeStructuredError.code : getErrorCode(error),
    details,
  );
};

const createPageLimitExceededResponse = (
  pageCount: number,
  issues: unknown[],
  structureMessages: string[],
  format: OutputFormat,
) =>
  createErrorResponse(
    "Le rendu depasse la limite de pages fixee dans cv_data.render.maxPages.",
    "page_limit_exceeded",
    {
      page_count: pageCount,
      page_limit_exceeded: true,
      issues,
      structure_messages: structureMessages,
      max_pages_source: "cv_data.render.maxPages",
      next_actions:
        format === "pdf"
          ? [
              "reduire le contenu ou passer render.templateStyle a compact ou ultra-compact",
              "augmenter ou retirer cv_data.render.maxPages",
              "generer avec pdf_mode=continuous si vous voulez ignorer la limite pour le PDF",
            ]
          : [
              "reduire le contenu ou passer render.templateStyle a compact ou ultra-compact",
              "augmenter ou retirer cv_data.render.maxPages",
              "pour inspecter le HTML malgre tout, retirez temporairement render.maxPages",
            ],
    },
  );

const createSingleCallSizeError = (format: OutputFormat, receivedChars: number) =>
  createErrorResponse(
    `Le payload cv_data depasse ${MAX_SINGLE_CALL_CV_DATA_CHARS} caracteres pour generate_cv_${format}. Utilisez cv_data_path pour un fichier local, ou le workflow chunked MCP en fallback.`,
    "cv_data_too_large_for_single_call",
    {
      max_chars: MAX_SINGLE_CALL_CV_DATA_CHARS,
      received_chars: receivedChars,
      recommended_workflow: [
        "1) ecrire le JSON dans un fichier local accessible au serveur MCP",
        `2) appeler generate_cv_${format} avec cv_data_path`,
        "3) fallback: start_cv_chunked_generation + append_cv_generation_chunk",
      ],
    },
  );

const withUploadMetadata = (
  response: ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>,
  metadata: Record<string, unknown>,
) => ({
  ...response,
  structuredContent: {
    ...response.structuredContent,
    ...metadata,
  },
});

const generateHtmlFromCvData = async (
  cvData: unknown,
  browserExecutablePath?: string,
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> => {
  try {
    const validation = await validateCvInput(cvData, {
      measureRender: true,
      browserExecutablePath,
    });

    if (validation.pageLimitExceeded) {
      return createPageLimitExceededResponse(
        validation.pageCount,
        validation.issues,
        validation.structureMessages,
        "html",
      );
    }

    const artifact = await generateCvArtifact(validation.cvData, { format: "html" });

    if (artifact.format !== "html") {
      return createErrorResponse(
        "Le moteur a retourne un format HTML inattendu.",
        "unexpected_artifact_format",
      );
    }

    return createSuccessResponse("CV HTML genere avec succes.", {
      format: "html",
      file_name: artifact.fileName,
      mime_type: artifact.mimeType,
      content: artifact.content,
      page_count: validation.pageCount,
      page_limit_exceeded: validation.pageLimitExceeded,
      issues: validation.issues,
      structure_messages: validation.structureMessages,
    });
  } catch (error) {
    return createStructuredErrorResponse(error, "Impossible de generer le CV HTML.");
  }
};

const generatePdfFromCvData = async (
  cvData: unknown,
  pdfMode: "paginated" | "continuous",
  browserExecutablePath?: string,
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> => {
  try {
    const validation = await validateCvInput(cvData, {
      measureRender: true,
      pdfMode,
      browserExecutablePath,
    });

    if (pdfMode === "paginated" && validation.pageLimitExceeded) {
      return createPageLimitExceededResponse(
        validation.pageCount,
        validation.issues,
        validation.structureMessages,
        "pdf",
      );
    }

    const artifact = await generateCvArtifact(validation.cvData, {
      format: "pdf",
      pdfOptions: {
        mode: pdfMode,
        browserExecutablePath,
      },
    });

    if (artifact.format !== "pdf") {
      return createErrorResponse(
        "Le moteur a retourne un format PDF inattendu.",
        "unexpected_artifact_format",
      );
    }

    const filePath = await writeBinaryArtifactToTempFile(artifact.fileName, artifact.binaryContent);

    return createSuccessResponse(
      `CV PDF genere avec succes.\nChemin du fichier PDF : ${filePath}\nMode : ${pdfMode}`,
      {
        format: "pdf",
        pdf_mode: pdfMode,
        file_name: artifact.fileName,
        mime_type: artifact.mimeType,
        file_path: filePath,
        page_count: validation.pageCount,
        page_limit_exceeded: validation.pageLimitExceeded,
        issues: validation.issues,
        structure_messages: validation.structureMessages,
      },
    );
  } catch (error) {
    return createStructuredErrorResponse(error, "Impossible de generer le CV PDF.");
  }
};

export const createCvMcpServer = (): McpServer => {
  const server = new McpServer({
    name: "cv-generator-mcp",
    version: "0.1.5",
  });

  server.registerResource(
    "cv-generator-skill",
    SKILL_RESOURCE_URI,
    {
      title: "CV Generator Skill",
      description:
        "Instructions agent pour utiliser correctement le serveur MCP cv-generator: cv_data_path, photoPath, validation et generation HTML/PDF.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: await readFile(SKILL_FILE_PATH, "utf-8"),
          mimeType: "text/markdown",
        },
      ],
    }),
  );

  server.registerResource(
    "cv-generator-contract-reference",
    SKILL_CONTRACT_RESOURCE_URI,
    {
      title: "CV Generator Contract Reference",
      description:
        "Reference agent du contrat CvData et des workflows MCP locaux, en complement du JSON Schema retourne par get_cv_schema.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: await readFile(SKILL_CONTRACT_PATH, "utf-8"),
          mimeType: "text/markdown",
        },
      ],
    }),
  );

  server.registerResource(
    "cv-generator-openai-agent-config",
    SKILL_AGENT_CONFIG_RESOURCE_URI,
    {
      title: "CV Generator OpenAI Agent Config",
      description: "Configuration indicative pour agents OpenAI consommant le MCP cv-generator.",
      mimeType: "text/yaml",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: await readFile(SKILL_AGENT_CONFIG_PATH, "utf-8"),
          mimeType: "text/yaml",
        },
      ],
    }),
  );

  server.registerPrompt(
    "cv_generator_workflow",
    {
      title: "CV Generator Workflow",
      description:
        "Guide court pour charger les resources de skill et utiliser le workflow MCP recommande.",
    },
    async () => ({
      description: "Workflow recommande pour le MCP cv-generator.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Utilise le MCP cv-generator avec ce workflow:",
              `1. Lis la resource ${SKILL_RESOURCE_URI} pour les instructions agent.`,
              `2. Lis ${SKILL_CONTRACT_RESOURCE_URI} si tu dois manipuler le contrat CvData.`,
              "3. Appelle get_cv_schema pour le JSON Schema machine-readable.",
              "4. Prefere cv_data_path pour les gros JSON locaux et header.photoPath pour les photos locales.",
              "5. Valide avec validate_cv avant generate_cv_html ou generate_cv_pdf.",
              "6. Quand generate_cv_pdf retourne file_path, relaie explicitement ce chemin a l'utilisateur.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerTool(
    "generate_cv_html",
    {
      title: "Generate CV HTML",
      description:
        "Genere un CV HTML propre a partir de cv_data ou cv_data_path. cv_data est limite a 5000 caracteres en appel direct; pour les gros CV locaux, preferer cv_data_path vers un fichier .json accessible au serveur MCP. Pour une photo locale, utiliser header.photoPath plutot que photoUrl; photoPath doit etre dans CV_GENERATOR_ALLOWED_ASSET_DIR ou dans le cwd serveur. Les options visuelles restent dans cv_data.render, y compris templateStyle (classic|compact|ultra-compact) et showSkillLevels.",
      inputSchema: cvDataInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ cv_data, cv_data_path, browser_executable_path }) => {
      let cvDataSource: CvDataSource;
      try {
        cvDataSource = await resolveCvDataSource(cv_data, cv_data_path);
      } catch (error) {
        return createCvDataSourceError(error);
      }

      if (
        cvDataSource.source === "inline" &&
        cvDataSource.serializedLength > MAX_SINGLE_CALL_CV_DATA_CHARS
      ) {
        return createSingleCallSizeError("html", cvDataSource.serializedLength);
      }

      return withUploadMetadata(await generateHtmlFromCvData(cvDataSource.cvData, browser_executable_path), {
        cv_data_source: cvDataSource.source,
        cv_data_path: cvDataSource.source === "file" ? cvDataSource.resolvedPath : undefined,
      });
    },
  );

  server.registerTool(
    "generate_cv_pdf",
    {
      title: "Generate CV PDF",
      description:
        "Genere un CV PDF headless a partir de cv_data ou cv_data_path. cv_data est limite a 5000 caracteres en appel direct; pour les gros CV locaux, preferer cv_data_path vers un fichier .json accessible au serveur MCP. Pour une photo locale, utiliser header.photoPath plutot que photoUrl; photoPath doit etre dans CV_GENERATOR_ALLOWED_ASSET_DIR ou dans le cwd serveur. Le PDF est ecrit dans CV_GENERATOR_OUTPUT_DIR si defini, sinon dans un dossier temporaire systeme. Les options visuelles restent dans cv_data.render, y compris templateStyle (classic|compact|ultra-compact) et showSkillLevels. Le resultat inclut file_path: toujours le relayer explicitement a l'utilisateur.",
      inputSchema: pdfToolInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
      },
    },
    async ({ cv_data, cv_data_path, pdf_mode, browser_executable_path }) => {
      let cvDataSource: CvDataSource;
      try {
        cvDataSource = await resolveCvDataSource(cv_data, cv_data_path);
      } catch (error) {
        return createCvDataSourceError(error);
      }

      if (
        cvDataSource.source === "inline" &&
        cvDataSource.serializedLength > MAX_SINGLE_CALL_CV_DATA_CHARS
      ) {
        return createSingleCallSizeError("pdf", cvDataSource.serializedLength);
      }

      return withUploadMetadata(
        await generatePdfFromCvData(cvDataSource.cvData, pdf_mode ?? "paginated", browser_executable_path),
        {
          cv_data_source: cvDataSource.source,
          cv_data_path: cvDataSource.source === "file" ? cvDataSource.resolvedPath : undefined,
        },
      );
    },
  );

  server.registerTool(
    "validate_cv",
    {
      title: "Validate CV",
      description:
        "Valide un CvData fourni via cv_data ou cv_data_path, mesure sa pagination rendue et retourne normalized_cv_data. Pour une photo locale, utiliser header.photoPath plutot que photoUrl; photoPath doit etre dans CV_GENERATOR_ALLOWED_ASSET_DIR ou dans le cwd serveur. Les champs render.templateStyle et render.showSkillLevels sont normalises avec le reste du contrat.",
      inputSchema: cvDataInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ cv_data, cv_data_path, browser_executable_path }) => {
      try {
        const cvDataSource = await resolveCvDataSource(cv_data, cv_data_path);
        const validation = await validateCvInput(cvDataSource.cvData, {
          measureRender: true,
          browserExecutablePath: browser_executable_path,
        });

        return createSuccessResponse("Validation du CV terminee.", {
          page_count: validation.pageCount,
          page_limit_exceeded: validation.pageLimitExceeded,
          issues: validation.issues,
          structure_messages: validation.structureMessages,
          normalized_cv_data: validation.cvData,
          cv_data_source: cvDataSource.source,
          cv_data_path: cvDataSource.source === "file" ? cvDataSource.resolvedPath : undefined,
        });
      } catch (error) {
        const errorCode = getErrorCode(error);
        return errorCode === "internal_error"
          ? createCvDataSourceError(error)
          : createErrorResponse(getErrorMessage(error, "Impossible de valider le CV."), errorCode);
      }
    },
  );

  server.registerTool(
    "start_cv_chunked_generation",
    {
      title: "Start CV Chunked Generation",
      description:
        "Demarre une session de generation chunked pour contourner la limite de 5000 caracteres par appel direct generate_cv_html/pdf.",
      inputSchema: startChunkedGenerationInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
      },
    },
    async ({ upload_id, output_format, pdf_mode, browser_executable_path }) => {
      pruneExpiredUploadSessions();

      const resolvedOutputFormat: OutputFormat = output_format ?? "pdf";
      const resolvedPdfMode = pdf_mode ?? "paginated";

      if (resolvedOutputFormat === "html" && pdf_mode) {
        return createErrorResponse(
          "Option invalide: pdf_mode ne s'applique que pour output_format=pdf.",
          "invalid_option_combination",
          {
            output_format: resolvedOutputFormat,
            received_pdf_mode: pdf_mode,
          },
        );
      }

      if (chunkUploadSessions.size >= MAX_ACTIVE_UPLOAD_SESSIONS) {
        return createErrorResponse(
          "Trop de sessions chunked actives. Reessayez dans quelques instants.",
          "too_many_active_upload_sessions",
          {
            max_active_sessions: MAX_ACTIVE_UPLOAD_SESSIONS,
          },
        );
      }

      const uploadId = upload_id ?? randomUUID();
      if (chunkUploadSessions.has(uploadId)) {
        return createErrorResponse(
          "upload_id deja utilise dans une session active.",
          "upload_id_already_exists",
          {
            upload_id: uploadId,
          },
        );
      }

      const now = Date.now();
      chunkUploadSessions.set(uploadId, {
        id: uploadId,
        outputFormat: resolvedOutputFormat,
        pdfMode: resolvedPdfMode,
        browserExecutablePath: browser_executable_path,
        chunks: new Map<number, string>(),
        createdAt: now,
        updatedAt: now,
      });

      return createSuccessResponse(
        [
          "Session chunked ouverte.",
          `upload_id: ${uploadId}`,
          "IMPORTANT: reutilisez exactement cet upload_id dans append_cv_generation_chunk.",
          "Envoyez les chunks via append_cv_generation_chunk.",
        ].join("\n"),
        {
          upload_id: uploadId,
          output_format: resolvedOutputFormat,
          pdf_mode: resolvedOutputFormat === "pdf" ? resolvedPdfMode : undefined,
          max_chunk_chars: MAX_CHUNK_CHARS,
          ttl_seconds: Math.floor(UPLOAD_SESSION_TTL_MS / 1000),
          next_tool: "append_cv_generation_chunk",
          next_arguments: {
            upload_id: uploadId,
            chunk_index: 0,
            total_chunks: 1,
            chunk: "{...}",
          },
        },
      );
    },
  );

  server.registerTool(
    "append_cv_generation_chunk",
    {
      title: "Append CV Generation Chunk",
      description:
        "Ajoute un chunk JSON (max 5000 chars) a une session upload. La generation est auto-declenchee au dernier chunk.",
      inputSchema: appendChunkInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
      },
    },
    async ({ upload_id, chunk_index, total_chunks, chunk }) => {
      pruneExpiredUploadSessions();

      let resolvedUploadId = upload_id;
      let session = chunkUploadSessions.get(upload_id);
      let uploadIdAutoResolved = false;
      if (!session) {
        if (chunkUploadSessions.size === 1) {
          const firstEntry = chunkUploadSessions.entries().next().value as
            | [string, ChunkUploadSession]
            | undefined;
          if (firstEntry) {
            resolvedUploadId = firstEntry[0];
            session = firstEntry[1];
            uploadIdAutoResolved = true;
          }
        }
      }

      if (!session) {
        return createErrorResponse(
          "Session upload introuvable ou expiree. Redemarrez avec start_cv_chunked_generation.",
          "upload_session_not_found",
          {
            upload_id,
            active_upload_ids: Array.from(chunkUploadSessions.keys()).slice(0, 5),
          },
        );
      }

      if (chunk.length > MAX_CHUNK_CHARS) {
        return createErrorResponse(
          `Chunk trop long: maximum ${MAX_CHUNK_CHARS} caracteres.`,
          "chunk_too_large",
          {
            upload_id: resolvedUploadId,
            max_chunk_chars: MAX_CHUNK_CHARS,
            received_chunk_chars: chunk.length,
          },
        );
      }

      if (session.totalChunks !== undefined && session.totalChunks !== total_chunks) {
        return createErrorResponse(
          "Valeur total_chunks incoherente avec les appels precedents.",
          "total_chunks_mismatch",
          {
            upload_id: resolvedUploadId,
            expected_total_chunks: session.totalChunks,
            received_total_chunks: total_chunks,
          },
        );
      }

      session.totalChunks = total_chunks;

      if (chunk_index >= total_chunks) {
        return createErrorResponse(
          "chunk_index hors limites pour total_chunks.",
          "invalid_chunk_index",
          {
            upload_id: resolvedUploadId,
            chunk_index,
            total_chunks,
          },
        );
      }

      const existingChunk = session.chunks.get(chunk_index);
      if (existingChunk !== undefined && existingChunk !== chunk) {
        return createErrorResponse(
          "chunk_index deja utilise avec un contenu different.",
          "chunk_index_conflict",
          {
            upload_id: resolvedUploadId,
            chunk_index,
          },
        );
      }

      session.chunks.set(chunk_index, chunk);
      session.updatedAt = Date.now();

      const receivedChunks = session.chunks.size;
      if (receivedChunks < total_chunks) {
        return createSuccessResponse(
          uploadIdAutoResolved
            ? `Chunk recu. upload_id resolu automatiquement vers ${resolvedUploadId}. Session en attente des chunks restants.`
            : "Chunk recu. Session en attente des chunks restants.",
          {
            upload_id: resolvedUploadId,
            upload_id_autocorrected: uploadIdAutoResolved,
            upload_completed: false,
            chunk_index,
            received_chunks: receivedChunks,
            total_chunks,
            remaining_chunks: total_chunks - receivedChunks,
            next_missing_chunk_index: getFirstMissingChunkIndex(session),
          },
        );
      }

      const orderedChunks: string[] = [];
      let totalChars = 0;
      for (let index = 0; index < total_chunks; index += 1) {
        const value = session.chunks.get(index);
        if (value === undefined) {
          return createErrorResponse(
            "Chunks incomplets: un index est manquant.",
            "missing_chunk",
            {
              upload_id: resolvedUploadId,
              missing_chunk_index: index,
              total_chunks,
            },
          );
        }

        totalChars += value.length;
        if (totalChars > MAX_TOTAL_CHUNKED_CV_DATA_CHARS) {
          chunkUploadSessions.delete(resolvedUploadId);
          return createErrorResponse(
            "Payload chunked trop volumineux.",
            "chunked_payload_too_large",
            {
              upload_id: resolvedUploadId,
              max_total_chars: MAX_TOTAL_CHUNKED_CV_DATA_CHARS,
              received_total_chars: totalChars,
            },
          );
        }

        orderedChunks.push(value);
      }

      const payloadText = orderedChunks.join("");
      let parsedCvData: unknown;
      try {
        parsedCvData = JSON.parse(payloadText) as unknown;
      } catch (error) {
        chunkUploadSessions.delete(resolvedUploadId);
        return createErrorResponse(
          getErrorMessage(error, "Le JSON reconstruit est invalide."),
          "invalid_chunked_json_payload",
          {
            upload_id: resolvedUploadId,
            total_chars: payloadText.length,
          },
        );
      }

      chunkUploadSessions.delete(resolvedUploadId);

      const generationResponse =
        session.outputFormat === "html"
          ? await generateHtmlFromCvData(parsedCvData, session.browserExecutablePath)
          : await generatePdfFromCvData(parsedCvData, session.pdfMode, session.browserExecutablePath);

      return withUploadMetadata(generationResponse, {
        upload_id: resolvedUploadId,
        upload_id_autocorrected: uploadIdAutoResolved,
        upload_completed: true,
        total_chunks,
        received_chunks: total_chunks,
        output_format: session.outputFormat,
      });
    },
  );

  server.registerTool(
    "get_cv_schema",
    {
      title: "Get CV Schema",
      description:
        "Retourne le JSON Schema du contrat CvData avec un exemple et des hints de workflow (schema -> validate_cv -> generate_cv_pdf/html), y compris les options render.templateStyle et render.showSkillLevels.",
      inputSchema: z.object({}).shape,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const schema = getCvSchema();
      const example =
        Array.isArray(schema.examples) && schema.examples.length > 0
          ? schema.examples[0]
          : null;

      const schemaText = [
        "JSON Schema CvData (machine-readable) :",
        "```json",
        JSON.stringify(schema, null, 2),
        "```",
        "",
        "Note client MCP: certains clients n'exposent pas structuredContent au modele.",
        "Le schema est donc duplique ici dans content.text pour compatibilite.",
        "",
        `Limite appels directs generate_cv_*: ${MAX_SINGLE_CALL_CV_DATA_CHARS} caracteres max pour cv_data (JSON stringify).`,
        "Au-dela: preferer cv_data_path vers un fichier JSON local accessible au serveur MCP.",
        `Par defaut, cv_data_path est limite au repertoire de travail du serveur MCP; configurez ${ALLOWED_INPUT_DIR_ENV} pour autoriser un autre repertoire.`,
        `Pour une photo locale, utiliser header.photoPath plutot que photoUrl; configurez ${ALLOWED_ASSET_DIR_ENV} si l'image n'est pas dans le cwd du serveur MCP.`,
        `Les PDF generes sont ecrits dans ${OUTPUT_DIR_ENV} si defini; sinon dans le dossier temporaire systeme.`,
      ].join("\n");

      return createSuccessResponse(schemaText, {
        schema,
        hints: {
          workflow: [
            "1) get_cv_schema",
            "2) construire cv_data conforme ou ecrire un fichier JSON local",
            "3) validate_cv avec cv_data ou cv_data_path",
            "4) generate_cv_pdf ou generate_cv_html avec la meme source",
          ],
          file_input_workflow: [
            `1) configurer ${ALLOWED_INPUT_DIR_ENV} si le fichier n'est pas dans le cwd du serveur MCP`,
            "2) ecrire cv_data dans un fichier .json local",
            "3) passer cv_data_path; le chemin doit etre valide depuis le process serveur MCP",
          ],
          local_photo_workflow: [
            `1) configurer ${ALLOWED_ASSET_DIR_ENV} si la photo n'est pas dans le cwd du serveur MCP`,
            "2) renseigner header.photoPath avec le chemin local de l'image, valide depuis le process serveur MCP",
            "3) laisser header.photoUrl vide sauf besoin d'une URL/data URL deja encodee",
            "4) garder header.showPhoto=true",
          ],
          output_workflow: [
            `1) configurer ${OUTPUT_DIR_ENV} pour choisir le dossier de sortie des PDF`,
            "2) lire file_path dans la reponse generate_cv_pdf",
          ],
          compact_cv_data_example: compactCvDataExample,
          chunked_workflow: [
            "1) start_cv_chunked_generation",
            "2) append_cv_generation_chunk (0..total_chunks-1, 5000 chars max/chunk)",
            "3) auto-finalisation au dernier chunk",
          ],
          limits: {
            max_single_call_cv_data_chars: MAX_SINGLE_CALL_CV_DATA_CHARS,
            max_chunk_chars: MAX_CHUNK_CHARS,
          },
          aliases_not_supported: {
            personalInfo: "header",
            summary: "profile",
            experience: "experiences",
            skills: "skillGroups",
            education: "mainEducation + formations",
          },
        },
      });
    },
  );

  return server;
};

export const startCvMcpServer = async (): Promise<void> => {
  const server = createCvMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

const isDirectExecution = (): boolean => {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  return fileURLToPath(import.meta.url) === entry;
};

if (isDirectExecution()) {
  startCvMcpServer().catch((error) => {
    console.error("Impossible de demarrer le serveur MCP CV.", error);
    process.exit(1);
  });
}
