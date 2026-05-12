import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { CvData } from "../types";

const ALLOWED_ASSET_DIR_ENV = "CV_GENERATOR_ALLOWED_ASSET_DIR";
const MAX_PHOTO_FILE_BYTES = 5_000_000;

const PHOTO_MIME_TYPES = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
]);

const isPathInsideDirectory = (candidatePath: string, directoryPath: string): boolean => {
  const relativePath = path.relative(directoryPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
};

const getAllowedAssetDirectory = async (): Promise<string> => {
  const configuredDirectory = process.env[ALLOWED_ASSET_DIR_ENV] ?? process.cwd();
  return realpath(path.resolve(configuredDirectory));
};

const resolvePhotoPathToDataUrl = async (photoPath: string): Promise<string> => {
  const allowedDirectory = await getAllowedAssetDirectory();
  const resolvedPhotoPath = await realpath(path.resolve(photoPath));

  if (!isPathInsideDirectory(resolvedPhotoPath, allowedDirectory)) {
    throw Object.assign(
      new Error(
        `header.photoPath doit pointer vers un fichier situe dans ${ALLOWED_ASSET_DIR_ENV} ou le repertoire de travail du serveur MCP/CLI.`,
      ),
      {
        code: "photo_path_outside_allowed_directory",
        details: {
          photo_path: photoPath,
          resolved_photo_path: resolvedPhotoPath,
          allowed_asset_dir: allowedDirectory,
        },
      },
    );
  }

  const extension = path.extname(resolvedPhotoPath).toLowerCase();
  const mimeType = PHOTO_MIME_TYPES.get(extension);
  if (!mimeType) {
    throw Object.assign(new Error("header.photoPath doit pointer vers une image .jpg, .jpeg, .png, .webp ou .gif."), {
      code: "invalid_photo_path_extension",
      details: {
        photo_path: photoPath,
        resolved_photo_path: resolvedPhotoPath,
        allowed_extensions: [...PHOTO_MIME_TYPES.keys()],
      },
    });
  }

  const fileStat = await stat(resolvedPhotoPath);
  if (!fileStat.isFile()) {
    throw Object.assign(new Error("header.photoPath doit pointer vers un fichier image."), {
      code: "photo_path_not_file",
      details: {
        photo_path: photoPath,
        resolved_photo_path: resolvedPhotoPath,
      },
    });
  }

  if (fileStat.size > MAX_PHOTO_FILE_BYTES) {
    throw Object.assign(new Error(`Photo trop volumineuse: maximum ${MAX_PHOTO_FILE_BYTES} octets.`), {
      code: "photo_file_too_large",
      details: {
        photo_path: photoPath,
        resolved_photo_path: resolvedPhotoPath,
        max_file_bytes: MAX_PHOTO_FILE_BYTES,
        received_file_bytes: fileStat.size,
      },
    });
  }

  const content = await readFile(resolvedPhotoPath);
  return `data:${mimeType};base64,${content.toString("base64")}`;
};

export const resolveCvAssetPaths = async (cvData: CvData): Promise<CvData> => {
  const photoPath = cvData.header.photoPath.trim();
  if (!photoPath) {
    return cvData;
  }

  return {
    ...cvData,
    header: {
      ...cvData.header,
      photoUrl: await resolvePhotoPathToDataUrl(photoPath),
    },
  };
};

export const getAllowedAssetDirectoryEnvName = (): string => ALLOWED_ASSET_DIR_ENV;
