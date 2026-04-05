import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCvArtifact, getCvSchema, validateCvInput } from "../src/engine/service";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const minimalFixturePath = path.join(__dirname, "fixtures", "cv-minimal.json");

const readMinimalFixture = async (): Promise<unknown> => {
  const raw = await readFile(minimalFixturePath, "utf-8");
  return JSON.parse(raw) as unknown;
};

test("getCvSchema exposes the expected render contract", () => {
  const schema = getCvSchema();

  assert.equal(schema.title, "CvData");
  assert.deepEqual(schema.properties.render.properties.sidebarPosition.enum, ["left", "right"]);
  assert(schema.properties.render.properties.theme.enum.includes("ocean"));
});

test("validateCvInput normalizes the fixture and returns structure messages", async () => {
  const fixture = await readMinimalFixture();
  const result = await validateCvInput(fixture, { measureRender: false });

  assert.equal(result.cvData.header.name.length > 0, true);
  assert.equal(Array.isArray(result.structureMessages), true);
  assert.equal(Array.isArray(result.issues), true);
  assert.equal(result.pageLimitExceeded, false);
});

test("generateCvArtifact renders HTML without editor chrome", async () => {
  const fixture = await readMinimalFixture();
  const result = await generateCvArtifact(fixture, { format: "html" });

  assert.equal(result.format, "html");
  assert.match(result.content, /<!doctype html>/i);
  assert.match(result.content, /cv-sheet/);
  assert.doesNotMatch(result.content, /Template Editor/i);
});
