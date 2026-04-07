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
    assert(toolNames.includes("start_cv_chunked_generation"));
    assert(toolNames.includes("append_cv_generation_chunk"));

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

test("MCP server enforces 5000-char direct limit and supports chunked PDF generation", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCliPath, mcpServerPath],
    cwd: projectRoot,
    stderr: "pipe",
  });

  const client = new Client({
    name: "cv-generator-test-client-chunked",
    version: "0.1.0",
  });

  try {
    await client.connect(transport);

    const baseFixture = await readMinimalFixture();
    const largeFixture = JSON.parse(JSON.stringify(baseFixture)) as Record<string, unknown>;
    largeFixture.profile = "A".repeat(6_200);

    const oversizedResult = await client.callTool({
      name: "generate_cv_pdf",
      arguments: {
        cv_data: largeFixture,
        pdf_mode: "continuous",
      },
    });

    assert.equal((oversizedResult as { isError?: boolean }).isError ?? false, true);
    assert.equal(
      (oversizedResult.structuredContent as { error_code?: string }).error_code,
      "cv_data_too_large_for_single_call",
    );

    const startUploadResult = await client.callTool({
      name: "start_cv_chunked_generation",
      arguments: {
        output_format: "pdf",
        pdf_mode: "continuous",
      },
    });

    assert.equal((startUploadResult as { isError?: boolean }).isError ?? false, false);
    const startPayload = startUploadResult.structuredContent as {
      success: boolean;
      upload_id: string;
      max_chunk_chars: number;
    };
    const startText = ((startUploadResult.content ?? [])[0] as { text?: string } | undefined)?.text ?? "";
    assert.equal(startPayload.success, true);
    assert.equal(startPayload.max_chunk_chars, 5000);
    assert.equal(startPayload.upload_id.length > 0, true);
    assert.match(startText, new RegExp(`upload_id: ${startPayload.upload_id}`));

    const serializedFixture = JSON.stringify(baseFixture);
    const chunkSize = 1200;
    const totalChunks = Math.ceil(serializedFixture.length / chunkSize);

    let finalChunkPayload:
      | {
          success: boolean;
          upload_completed: boolean;
          format: string;
          pdf_mode: string;
          file_path: string;
          total_chunks: number;
          received_chunks: number;
        }
      | null = null;

    for (let index = 0; index < totalChunks; index += 1) {
      const chunk = serializedFixture.slice(index * chunkSize, (index + 1) * chunkSize);
      const appendResult = await client.callTool({
        name: "append_cv_generation_chunk",
        arguments: {
          upload_id: startPayload.upload_id,
          chunk_index: index,
          total_chunks: totalChunks,
          chunk,
        },
      });

      assert.equal((appendResult as { isError?: boolean }).isError ?? false, false);
      const appendPayload = appendResult.structuredContent as {
        success: boolean;
        upload_completed: boolean;
      };
      assert.equal(appendPayload.success, true);

      if (index < totalChunks - 1) {
        assert.equal(appendPayload.upload_completed, false);
      } else {
        const finalPayload = appendResult.structuredContent as {
          success: boolean;
          upload_completed: boolean;
          format: string;
          pdf_mode: string;
          file_path: string;
          total_chunks: number;
          received_chunks: number;
        };
        finalChunkPayload = finalPayload;
      }
    }

    assert.notEqual(finalChunkPayload, null);
    assert.equal(finalChunkPayload?.success, true);
    assert.equal(finalChunkPayload?.upload_completed, true);
    assert.equal(finalChunkPayload?.format, "pdf");
    assert.equal(finalChunkPayload?.pdf_mode, "continuous");
    assert.match(finalChunkPayload?.file_path ?? "", /cv-template-.*\.pdf$/);
    assert.equal(finalChunkPayload?.total_chunks, totalChunks);
    assert.equal(finalChunkPayload?.received_chunks, totalChunks);
  } finally {
    await client.close();
  }
});

test("MCP chunk append can auto-resolve upload_id when exactly one session is active", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCliPath, mcpServerPath],
    cwd: projectRoot,
    stderr: "pipe",
  });

  const client = new Client({
    name: "cv-generator-test-client-upload-autoresolve",
    version: "0.1.0",
  });

  try {
    await client.connect(transport);

    const fixture = await readMinimalFixture();
    const serializedFixture = JSON.stringify(fixture);

    const startUploadResult = await client.callTool({
      name: "start_cv_chunked_generation",
      arguments: {
        output_format: "html",
      },
    });
    assert.equal((startUploadResult as { isError?: boolean }).isError ?? false, false);

    const appendResult = await client.callTool({
      name: "append_cv_generation_chunk",
      arguments: {
        upload_id: "wrong-upload-id",
        chunk_index: 0,
        total_chunks: 1,
        chunk: serializedFixture,
      },
    });

    assert.equal((appendResult as { isError?: boolean }).isError ?? false, false);
    const payload = appendResult.structuredContent as {
      success: boolean;
      upload_completed: boolean;
      upload_id_autocorrected: boolean;
      format: string;
      content: string;
    };
    assert.equal(payload.success, true);
    assert.equal(payload.upload_completed, true);
    assert.equal(payload.upload_id_autocorrected, true);
    assert.equal(payload.format, "html");
    assert.match(payload.content, /cv-sheet/);
  } finally {
    await client.close();
  }
});
