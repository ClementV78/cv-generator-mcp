import test from "node:test";
import assert from "node:assert/strict";
import { access, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const tsxCliPath = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
const cliPath = path.join(projectRoot, "src", "cli", "cvCli.ts");
const minimalFixturePath = path.join(__dirname, "fixtures", "cv-minimal.json");

interface CliExecutionResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

const runCli = (...args: string[]): CliExecutionResult => {
  const result = spawnSync(process.execPath, [tsxCliPath, cliPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

const parseCliJson = <T>(stdout: string): T => JSON.parse(stdout) as T;

test("CLI get-cv-schema returns a valid schema payload", () => {
  const result = runCli("get-cv-schema");
  assert.equal(result.status, 0, result.stderr);

  const payload = parseCliJson<{ success: boolean; schema: { title: string } }>(result.stdout);
  assert.equal(payload.success, true);
  assert.equal(payload.schema.title, "CvData");
});

test("CLI validate-cv returns diagnostics for a valid fixture", () => {
  const result = runCli("validate-cv", "--cv-data", minimalFixturePath);
  assert.equal(result.status, 0, result.stderr);

  const payload = parseCliJson<{
    success: boolean;
    page_count: number;
    normalized_cv_data: { header: { name: string } };
  }>(result.stdout);
  assert.equal(payload.success, true);
  assert.equal(payload.page_count >= 1, true);
  assert.equal(payload.normalized_cv_data.header.name.length > 0, true);
});

test("CLI generate-cv-html writes the artifact and returns file_path", async () => {
  const outputPath = path.join(projectRoot, ".tmp-cli-test-output.html");
  try {
    const result = runCli(
      "generate-cv-html",
      "--cv-data",
      minimalFixturePath,
      "--output",
      outputPath,
    );
    assert.equal(result.status, 0, result.stderr);

    const payload = parseCliJson<{
      success: boolean;
      format: string;
      file_path: string;
    }>(result.stdout);
    assert.equal(payload.success, true);
    assert.equal(payload.format, "html");
    assert.equal(payload.file_path, outputPath);
    await access(outputPath);
  } finally {
    await rm(outputPath, { force: true });
  }
});
