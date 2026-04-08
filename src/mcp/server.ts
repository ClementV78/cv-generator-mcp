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
const UPLOAD_SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_ACTIVE_UPLOAD_SESSIONS = 64;

const cvDataInputSchema = z.object({
  cv_data: z.unknown(),
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
    headline: "ARCHITECTE CLOUD SENIOR | AWS | AZURE | KUBERNETES",
    location: "Paris, France",
    email: "thomas.dubois@email.com",
    linkedin: "linkedin.com/in/thomas-dubois-cloud",
  },
  profileLabel: "Profil professionnel",
  profile:
    "Architecte Cloud senior avec experience en plateformes scalables, migration cloud et optimisation des couts.",
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

const createSingleCallSizeError = (format: OutputFormat, receivedChars: number) =>
  createErrorResponse(
    `Le payload cv_data depasse ${MAX_SINGLE_CALL_CV_DATA_CHARS} caracteres pour generate_cv_${format}. Utilisez le workflow chunked MCP.`,
    "cv_data_too_large_for_single_call",
    {
      max_chars: MAX_SINGLE_CALL_CV_DATA_CHARS,
      received_chars: receivedChars,
      recommended_workflow: [
        "1) start_cv_chunked_generation",
        "2) append_cv_generation_chunk (chunk_index 0..total_chunks-1, 5000 chars max par chunk)",
        `3) auto-finalisation et generation ${format} au dernier chunk`,
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
      return createErrorResponse("Le rendu depasse la limite de pages fixee.", "page_limit_exceeded", {
        page_count: validation.pageCount,
        page_limit_exceeded: true,
        issues: validation.issues,
        structure_messages: validation.structureMessages,
      });
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
    return createErrorResponse(
      getErrorMessage(error, "Impossible de generer le CV HTML."),
      getErrorCode(error),
    );
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
      return createErrorResponse("Le rendu depasse la limite de pages fixee.", "page_limit_exceeded", {
        page_count: validation.pageCount,
        page_limit_exceeded: true,
        issues: validation.issues,
        structure_messages: validation.structureMessages,
      });
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
    return createErrorResponse(
      getErrorMessage(error, "Impossible de generer le CV PDF."),
      getErrorCode(error),
    );
  }
};

export const createCvMcpServer = (): McpServer => {
  const server = new McpServer({
    name: "cv-generator-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "generate_cv_html",
    {
      title: "Generate CV HTML",
      description:
        "Genere un CV HTML propre a partir d'un CvData JSON (max 5000 caracteres en appel direct). Au-dela, utiliser start_cv_chunked_generation + append_cv_generation_chunk.",
      inputSchema: cvDataInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ cv_data, browser_executable_path }) => {
      const serializedLength = getSerializedLength(cv_data);
      if (serializedLength === null) {
        return createErrorResponse(
          "Impossible de serialiser cv_data en JSON.",
          "invalid_cv_data_payload",
        );
      }
      if (serializedLength > MAX_SINGLE_CALL_CV_DATA_CHARS) {
        return createSingleCallSizeError("html", serializedLength);
      }

      return generateHtmlFromCvData(cv_data, browser_executable_path);
    },
  );

  server.registerTool(
    "generate_cv_pdf",
    {
      title: "Generate CV PDF",
      description:
        "Genere un CV PDF headless a partir d'un CvData JSON (max 5000 caracteres en appel direct). Au-dela, utiliser start_cv_chunked_generation + append_cv_generation_chunk. Le resultat inclut file_path: toujours le relayer explicitement a l'utilisateur.",
      inputSchema: pdfToolInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
      },
    },
    async ({ cv_data, pdf_mode, browser_executable_path }) => {
      const serializedLength = getSerializedLength(cv_data);
      if (serializedLength === null) {
        return createErrorResponse(
          "Impossible de serialiser cv_data en JSON.",
          "invalid_cv_data_payload",
        );
      }
      if (serializedLength > MAX_SINGLE_CALL_CV_DATA_CHARS) {
        return createSingleCallSizeError("pdf", serializedLength);
      }

      return generatePdfFromCvData(cv_data, pdf_mode ?? "paginated", browser_executable_path);
    },
  );

  server.registerTool(
    "validate_cv",
    {
      title: "Validate CV",
      description: "Valide un CvData et mesure sa pagination rendue.",
      inputSchema: cvDataInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ cv_data, browser_executable_path }) => {
      try {
        const validation = await validateCvInput(cv_data, {
          measureRender: true,
          browserExecutablePath: browser_executable_path,
        });

        return createSuccessResponse("Validation du CV terminee.", {
          page_count: validation.pageCount,
          page_limit_exceeded: validation.pageLimitExceeded,
          issues: validation.issues,
          structure_messages: validation.structureMessages,
          normalized_cv_data: validation.cvData,
        });
      } catch (error) {
        return createErrorResponse(
          getErrorMessage(error, "Impossible de valider le CV."),
          getErrorCode(error),
        );
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
        "Retourne le JSON Schema du contrat CvData avec un exemple et des hints de workflow (schema -> validate_cv -> generate_cv_pdf/html).",
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
        "Au-dela: workflow chunked start_cv_chunked_generation -> append_cv_generation_chunk.",
      ].join("\n");

      return createSuccessResponse(schemaText, {
        schema,
        hints: {
          workflow: [
            "1) get_cv_schema",
            "2) construire cv_data conforme",
            "3) validate_cv",
            "4) generate_cv_pdf ou generate_cv_html",
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
