#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const mcpServerPath = path.join(projectRoot, "src", "mcp", "server.ts");

try {
  const mcpServerModule = await tsImport(pathToFileURL(mcpServerPath).href, {
    parentURL: import.meta.url,
  });
  await mcpServerModule.startCvMcpServer();
} catch (error) {
  console.error("Unable to launch cv-generator-mcp.", error);
  process.exit(1);
}
