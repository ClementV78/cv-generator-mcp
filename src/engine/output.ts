import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TEMP_OUTPUT_DIR = path.join(os.tmpdir(), "cv-generator");

const ensureOutputDirectory = async (): Promise<string> => {
  await mkdir(TEMP_OUTPUT_DIR, { recursive: true });
  return TEMP_OUTPUT_DIR;
};

const sanitizeFileName = (fileName: string): string =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");

export const writeBinaryArtifactToTempFile = async (
  fileName: string,
  content: Uint8Array,
): Promise<string> => {
  const directory = await ensureOutputDirectory();
  const extension = path.extname(fileName) || ".bin";
  const baseName = sanitizeFileName(path.basename(fileName, extension)) || "artifact";
  const targetPath = path.join(directory, `${baseName}-${Date.now()}${extension}`);
  await writeFile(targetPath, content);
  return targetPath;
};

export const createTempWorkspace = async (prefix: string): Promise<string> => {
  const directory = await ensureOutputDirectory();
  const normalizedPrefix = sanitizeFileName(prefix) || "workspace";
  return mkdtemp(path.join(directory, `${normalizedPrefix}-`));
};

export const removeTempWorkspace = async (workspacePath: string): Promise<void> => {
  await rm(workspacePath, { recursive: true, force: true });
};
