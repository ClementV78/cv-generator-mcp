import { fileURLToPath } from "node:url";
import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { generateCvArtifact, getCvSchema, validateCvInput } from "../engine/service";
import { writeBinaryArtifactToTempFile } from "../engine/output";
import { CvValidationError } from "../engine/validateNode";
import { PdfRenderError } from "../engine/renderPdf";

const cvDataInputSchema = z.object({
  cv_data: z.unknown(),
  browser_executable_path: z.string().optional(),
});

const pdfToolInputSchema = cvDataInputSchema.extend({
  pdf_mode: z.enum(["paginated", "continuous"]).optional(),
});

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

export const createCvMcpServer = (): McpServer => {
  const server = new McpServer({
    name: "cv-generator-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "generate_cv_html",
    {
      title: "Generate CV HTML",
      description: "Genere un CV HTML propre a partir d'un CvData JSON.",
      inputSchema: cvDataInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ cv_data, browser_executable_path }) => {
      try {
        const validation = await validateCvInput(cv_data, {
          browserExecutablePath: browser_executable_path,
          measureRender: true,
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
    },
  );

  server.registerTool(
    "generate_cv_pdf",
    {
      title: "Generate CV PDF",
      description: "Genere un CV PDF headless a partir d'un CvData JSON.",
      inputSchema: pdfToolInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
      },
    },
    async ({ cv_data, browser_executable_path, pdf_mode }) => {
      try {
        const resolvedPdfMode = pdf_mode ?? "paginated";
        const validation = await validateCvInput(cv_data, {
          browserExecutablePath: browser_executable_path,
          measureRender: true,
        });

        if (resolvedPdfMode === "paginated" && validation.pageLimitExceeded) {
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
            browserExecutablePath: browser_executable_path,
            mode: resolvedPdfMode,
          },
        });

        if (artifact.format !== "pdf") {
          return createErrorResponse(
            "Le moteur a retourne un format PDF inattendu.",
            "unexpected_artifact_format",
          );
        }

        const filePath = await writeBinaryArtifactToTempFile(artifact.fileName, artifact.binaryContent);

        return createSuccessResponse("CV PDF genere avec succes.", {
          format: "pdf",
          pdf_mode: resolvedPdfMode,
          file_name: artifact.fileName,
          mime_type: artifact.mimeType,
          file_path: filePath,
          page_count: validation.pageCount,
          page_limit_exceeded: validation.pageLimitExceeded,
          issues: validation.issues,
          structure_messages: validation.structureMessages,
        });
      } catch (error) {
        return createErrorResponse(
          getErrorMessage(error, "Impossible de generer le CV PDF."),
          getErrorCode(error),
        );
      }
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
          browserExecutablePath: browser_executable_path,
          measureRender: true,
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
    "get_cv_schema",
    {
      title: "Get CV Schema",
      description: "Retourne le JSON Schema du contrat CvData.",
      inputSchema: z.object({}).shape,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      createSuccessResponse("Schema CvData retourne.", {
        schema: getCvSchema(),
      }),
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
