import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { generateCvArtifact, getCvSchema, validateCvInput } from "../engine/service";
import { writeBinaryArtifactToTempFile } from "../engine/output";
import type { PdfMode } from "../engine/renderPdf";

type CommandName = "get-cv-schema" | "validate-cv" | "generate-cv-html" | "generate-cv-pdf";

interface ParsedArgs {
  command?: string;
  options: Map<string, string | boolean>;
}

const TEMP_OUTPUT_DIR = path.join(os.tmpdir(), "cv-generator");

process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") {
    process.exit(0);
  }
});

const HELP_TEXT = `
CV Generator CLI

Usage:
  npm run cli -- <command> [options]
  npm run cli -- <command> --help

Objectif:
  Interface locale du moteur CV. Meme logique que les tools MCP:
  schema -> validation -> generation HTML/PDF.

Workflow recommande:
  1) Recuperer le schema:
     npm run cli -- get-cv-schema > cv-schema.json
  2) Produire un cv_data conforme (ex: cv.json)
  3) Verifier la structure et la pagination:
     npm run cli -- validate-cv --cv-data cv.json
  4) Generer l'artefact final:
     npm run cli -- generate-cv-pdf --cv-data cv.json --pdf-mode paginated --output ./cv.pdf

Commandes:
  get-cv-schema
    Retourne le JSON Schema CvData dans la sortie JSON (champ schema).

  validate-cv --cv-data <file>
    Valide cv_data, calcule la pagination et renvoie les diagnostics.

  generate-cv-html --cv-data <file> [--output <file>]
    Genere un HTML. Si --output est absent, ecrit dans un fichier temporaire.

  generate-cv-pdf --cv-data <file> [--pdf-mode paginated|continuous] [--output <file>]
    Genere un PDF headless (backend Vivliostyle). Si --output est absent,
    ecrit dans un fichier temporaire.
    Par defaut: --pdf-mode paginated.

Options communes:
  --cv-data <file>      chemin du JSON d'entree (alias: --cv_data, --input)
  --output <file>       chemin de sortie explicite
  --browser-executable-path <path>
                        force un navigateur systeme (alias: --browser_executable_path)
  --help, -h            affiche l'aide globale ou l'aide d'une commande

Options specifiques PDF:
  --pdf-mode <mode>     paginated | continuous (alias: --pdf_mode)

Code de sortie:
  0: succes
  1: erreur (validation, page_limit_exceeded, option invalide, erreur interne, etc.)

Sortie JSON (stdout):
  success: true | false
  format: "html" | "pdf" (generation uniquement)
  file_path: chemin du fichier genere (generation)
  page_count, page_limit_exceeded, issues, structure_messages
  error_code, message (en cas d'erreur)

Exemples rapides:
  npm run cli -- get-cv-schema
  npm run cli -- validate-cv --cv-data ./examples/cv-minimal.json
  npm run cli -- generate-cv-html --cv-data ./examples/cv-minimal.json --output ./cv.html
  npm run cli -- generate-cv-pdf --cv-data ./examples/cv-minimal.json --pdf-mode continuous --output ./cv.pdf

Depannage LM Studio / petits LLM:
  - Si le modele echoue a envoyer un gros JSON (tool call tronque), utilisez ce workflow:
    1) get-cv-schema
    2) construire cv.json localement
    3) validate-cv --cv-data cv.json
    4) generate-cv-pdf --cv-data cv.json
  - L'option --cv-data evite d'envoyer tout le CV dans les arguments du tool call.
  - En sortie, utilisez toujours file_path pour recuperer le fichier genere.
`.trim();

const COMMAND_HELP: Record<CommandName, string> = {
  "get-cv-schema": `
Commande: get-cv-schema

Usage:
  npm run cli -- get-cv-schema

Description:
  Retourne le JSON Schema CvData dans:
  {
    "success": true,
    "schema": { ... }
  }
`.trim(),
  "validate-cv": `
Commande: validate-cv

Usage:
  npm run cli -- validate-cv --cv-data <file> [--browser-executable-path <path>]

Description:
  Valide cv_data, mesure le rendu, retourne:
  - page_count
  - page_limit_exceeded
  - issues
  - structure_messages
  - normalized_cv_data
`.trim(),
  "generate-cv-html": `
Commande: generate-cv-html

Usage:
  npm run cli -- generate-cv-html --cv-data <file> [--output <file>] [--browser-executable-path <path>]

Description:
  Genere un HTML depuis cv_data.
  Si --output est absent, le fichier est ecrit dans le dossier temporaire systeme.
`.trim(),
  "generate-cv-pdf": `
Commande: generate-cv-pdf

Usage:
  npm run cli -- generate-cv-pdf --cv-data <file> [--pdf-mode paginated|continuous] [--output <file>] [--browser-executable-path <path>]

Description:
  Genere un PDF depuis cv_data.
  - paginated: respecte maxPages et peut retourner page_limit_exceeded
  - continuous: ignore la limite de pages pour la generation
`.trim(),
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const options = new Map<string, string | boolean>();
  let command: string | undefined;

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]!;

    if (token.startsWith("--")) {
      const body = token.slice(2);
      const equalsIndex = body.indexOf("=");

      if (equalsIndex >= 0) {
        const key = body.slice(0, equalsIndex);
        const value = body.slice(equalsIndex + 1);
        options.set(key, value);
        continue;
      }

      const key = body;
      const next = argv[index + 1];
      if (next && !next.startsWith("-")) {
        options.set(key, next);
        index += 1;
      } else {
        options.set(key, true);
      }
      continue;
    }

    if (!command) {
      command = token;
    }
  }

  return { command, options };
};

const getOption = (args: ParsedArgs, names: string[]): string | undefined => {
  for (const name of names) {
    const value = args.options.get(name);
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
};

const hasFlag = (args: ParsedArgs, names: string[]): boolean =>
  names.some((name) => args.options.has(name));

const readJsonFile = async (filePath: string): Promise<unknown> => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw) as unknown;
};

const ensureOutputDir = async (): Promise<string> => {
  await mkdir(TEMP_OUTPUT_DIR, { recursive: true });
  return TEMP_OUTPUT_DIR;
};

const writeTextArtifact = async (
  content: string,
  fileName: string,
  explicitOutput?: string,
): Promise<string> => {
  const outputPath = explicitOutput
    ? path.isAbsolute(explicitOutput)
      ? explicitOutput
      : path.resolve(process.cwd(), explicitOutput)
    : path.join(await ensureOutputDir(), `${path.basename(fileName, path.extname(fileName))}-${Date.now()}${path.extname(fileName)}`);
  await writeFile(outputPath, content, "utf8");
  return outputPath;
};

const writePdfArtifact = async (
  content: Uint8Array,
  fileName: string,
  explicitOutput?: string,
): Promise<string> => {
  if (!explicitOutput) {
    return writeBinaryArtifactToTempFile(fileName, content);
  }

  const outputPath = path.isAbsolute(explicitOutput)
    ? explicitOutput
    : path.resolve(process.cwd(), explicitOutput);
  await writeFile(outputPath, content);
  return outputPath;
};

const printJson = (payload: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
};

const printError = (message: string, code = "cli_error", details: Record<string, unknown> = {}): never => {
  printJson({
    success: false,
    error_code: code,
    message,
    ...details,
  });
  process.exit(1);
  throw new Error("CLI exited");
};

const assertCommand = (command: string | undefined): CommandName => {
  if (!command) {
    printError("Aucune commande fournie. Utilisez --help.", "missing_command");
  }

  const supported: CommandName[] = ["get-cv-schema", "validate-cv", "generate-cv-html", "generate-cv-pdf"];
  if (!supported.includes(command as CommandName)) {
    printError(`Commande non supportee: ${command}`, "unsupported_command", {
      supported_commands: supported,
    });
  }

  return command as CommandName;
};

const parsePdfMode = (value: string | undefined): PdfMode => {
  if (!value) {
    return "paginated";
  }
  if (value === "paginated" || value === "continuous") {
    return value;
  }
  return printError(
    "Valeur invalide pour pdf_mode. Valeurs attendues: paginated | continuous.",
    "invalid_pdf_mode",
    {
      received: value,
    },
  );
};

const getCvDataPath = (args: ParsedArgs): string =>
  getOption(args, ["cv-data", "cv_data", "input"]) ??
  printError("Option manquante: --cv-data <file>.", "missing_cv_data_option");

const runGetCvSchema = async (): Promise<void> => {
  printJson({
    success: true,
    schema: getCvSchema(),
  });
};

const runValidateCv = async (args: ParsedArgs): Promise<void> => {
  const cvDataPath = getCvDataPath(args);
  const browserExecutablePath = getOption(args, [
    "browser-executable-path",
    "browser_executable_path",
  ]);
  const validation = await validateCvInput(await readJsonFile(cvDataPath), {
    measureRender: true,
    browserExecutablePath,
  });

  printJson({
    success: true,
    page_count: validation.pageCount,
    page_limit_exceeded: validation.pageLimitExceeded,
    issues: validation.issues,
    structure_messages: validation.structureMessages,
    normalized_cv_data: validation.cvData,
  });
};

const runGenerateCvHtml = async (args: ParsedArgs): Promise<void> => {
  const cvDataPath = getCvDataPath(args);
  const output = getOption(args, ["output"]);
  const browserExecutablePath = getOption(args, [
    "browser-executable-path",
    "browser_executable_path",
  ]);
  const validation = await validateCvInput(await readJsonFile(cvDataPath), {
    measureRender: true,
    browserExecutablePath,
  });

  if (validation.pageLimitExceeded) {
    printError("Le rendu depasse la limite de pages fixee.", "page_limit_exceeded", {
      page_count: validation.pageCount,
      page_limit_exceeded: true,
      issues: validation.issues,
      structure_messages: validation.structureMessages,
    });
  }

  const artifact = await generateCvArtifact(validation.cvData, { format: "html" });
  if (artifact.format !== "html") {
    return printError("Le moteur a retourne un format HTML inattendu.", "unexpected_artifact_format");
  }

  const filePath = await writeTextArtifact(artifact.content, artifact.fileName, output);

  printJson({
    success: true,
    format: "html",
    file_name: artifact.fileName,
    mime_type: artifact.mimeType,
    file_path: filePath,
    page_count: validation.pageCount,
    page_limit_exceeded: validation.pageLimitExceeded,
    issues: validation.issues,
    structure_messages: validation.structureMessages,
  });
};

const runGenerateCvPdf = async (args: ParsedArgs): Promise<void> => {
  const cvDataPath = getCvDataPath(args);
  const output = getOption(args, ["output"]);
  const browserExecutablePath = getOption(args, [
    "browser-executable-path",
    "browser_executable_path",
  ]);
  const pdfMode = parsePdfMode(getOption(args, ["pdf-mode", "pdf_mode"]));
  const validation = await validateCvInput(await readJsonFile(cvDataPath), {
    measureRender: true,
    pdfMode,
    browserExecutablePath,
  });

  if (pdfMode === "paginated" && validation.pageLimitExceeded) {
    printError("Le rendu depasse la limite de pages fixee.", "page_limit_exceeded", {
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
    return printError("Le moteur a retourne un format PDF inattendu.", "unexpected_artifact_format");
  }

  const filePath = await writePdfArtifact(artifact.binaryContent, artifact.fileName, output);

  printJson({
    success: true,
    format: "pdf",
    pdf_mode: pdfMode,
    file_name: artifact.fileName,
    mime_type: artifact.mimeType,
    file_path: filePath,
    page_count: validation.pageCount,
    page_limit_exceeded: validation.pageLimitExceeded,
    issues: validation.issues,
    structure_messages: validation.structureMessages,
  });
};

const run = async (): Promise<void> => {
  const args = parseArgs(process.argv);

  if (
    args.command &&
    (args.command === "get-cv-schema" ||
      args.command === "validate-cv" ||
      args.command === "generate-cv-html" ||
      args.command === "generate-cv-pdf") &&
    hasFlag(args, ["help", "h"])
  ) {
    process.stdout.write(`${COMMAND_HELP[args.command]}\n`);
    return;
  }

  if (hasFlag(args, ["help", "h"]) || args.command === "help") {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  const command = assertCommand(args.command);

  if (command === "get-cv-schema") {
    await runGetCvSchema();
    return;
  }

  if (command === "validate-cv") {
    await runValidateCv(args);
    return;
  }

  if (command === "generate-cv-html") {
    await runGenerateCvHtml(args);
    return;
  }

  await runGenerateCvPdf(args);
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Erreur interne CLI.";
  printError(message, "internal_error");
});
