import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const minimalFixturePath = path.join(__dirname, "fixtures", "cv-minimal.json");
const tsxCliPath = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
const mcpServerPath = path.join(projectRoot, "src", "mcp", "server.ts");

const readMinimalFixture = async (): Promise<unknown> => {
  const raw = await readFile(minimalFixturePath, "utf-8");
  return JSON.parse(raw) as unknown;
};

test("MCP server exposes the expected tools and serves schema/html generation", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCliPath, mcpServerPath],
    cwd: projectRoot,
    stderr: "pipe",
  });

  const client = new Client({
    name: "cv-generator-test-client",
    version: "0.1.0",
  });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);

    assert(toolNames.includes("generate_cv_html"));
    assert(toolNames.includes("generate_cv_pdf"));
    assert(toolNames.includes("validate_cv"));
    assert(toolNames.includes("get_cv_schema"));

    const schemaResult = await client.callTool({
      name: "get_cv_schema",
      arguments: {},
    });

    assert.equal((schemaResult as { isError?: boolean }).isError ?? false, false);
    assert.equal((schemaResult.structuredContent as { success: boolean }).success, true);

    const htmlResult = await client.callTool({
      name: "generate_cv_html",
      arguments: {
        cv_data: await readMinimalFixture(),
      },
    });

    assert.equal((htmlResult as { isError?: boolean }).isError ?? false, false);
    const structuredContent = htmlResult.structuredContent as {
      success: boolean;
      content: string;
      format: string;
    };
    assert.equal(structuredContent.success, true);
    assert.equal(structuredContent.format, "html");
    assert.match(structuredContent.content, /cv-sheet/);

    const pdfResult = await client.callTool({
      name: "generate_cv_pdf",
      arguments: {
        cv_data: await readMinimalFixture(),
        pdf_mode: "continuous",
      },
    });

    assert.equal((pdfResult as { isError?: boolean }).isError ?? false, false);
    const pdfStructuredContent = pdfResult.structuredContent as {
      success: boolean;
      format: string;
      pdf_mode: string;
      file_path: string;
    };
    assert.equal(pdfStructuredContent.success, true);
    assert.equal(pdfStructuredContent.format, "pdf");
    assert.equal(pdfStructuredContent.pdf_mode, "continuous");
    assert.match(pdfStructuredContent.file_path, /cv-template-.*\.pdf$/);
  } finally {
    await client.close();
  }
});
