import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const skillRoot = path.join(projectRoot, "skills", "cv-generator");
const installSkillScript = path.join(projectRoot, "scripts", "install-skill.sh");
const printConfigScript = path.join(projectRoot, "scripts", "print-mcp-config.sh");

test("repo-shipped skill bundle is complete", async () => {
  await access(path.join(skillRoot, "SKILL.md"));
  await access(path.join(skillRoot, "references", "cv-contract.md"));
  await access(path.join(skillRoot, "agents", "openai.yaml"));

  const openAiYaml = await readFile(path.join(skillRoot, "agents", "openai.yaml"), "utf8");
  assert.match(openAiYaml, /display_name: "CV Generator"/);
  assert.match(openAiYaml, /default_prompt: "Use \$cv-generator/);
  assert.match(openAiYaml, /allow_implicit_invocation: true/);
});

test("install-skill script installs the Hermes skill and prints MCP config", async () => {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "cv-generator-hermes-home-"));

  try {
    const result = spawnSync("sh", [installSkillScript, "hermes"], {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: tempHome,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    await access(path.join(tempHome, ".hermes", "skills", "cv-generator", "SKILL.md"));
    assert.match(result.stdout, /Installed cv-generator/);
    assert.match(result.stdout, /mcp_servers:/);
    assert.match(result.stdout, /@xclem\/cv-generator-mcp/);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("install-skill script installs the Claude Code skill", async () => {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "cv-generator-claude-home-"));

  try {
    const result = spawnSync("sh", [installSkillScript, "claude-code"], {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: tempHome,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    await access(path.join(tempHome, ".claude", "skills", "cv-generator", "SKILL.md"));
    assert.match(result.stdout, /claude mcp add cv-generator -- npx -y @xclem\/cv-generator-mcp/);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});

test("print-mcp-config script returns copy-paste snippets", () => {
  const hermes = spawnSync("sh", [printConfigScript, "hermes"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  const claude = spawnSync("sh", [printConfigScript, "claude-code"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.equal(hermes.status, 0, hermes.stderr);
  assert.equal(claude.status, 0, claude.stderr);
  assert.match(hermes.stdout, /mcp_servers:/);
  assert.match(hermes.stdout, /command: "npx"/);
  assert.match(claude.stdout, /claude mcp add cv-generator -- npx -y @xclem\/cv-generator-mcp/);
});
