import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCvInput } from "../src/engine/service";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");
const exampleFiles = [
  "cv-cloud-architect.json",
  "cv-devops.json",
  "cv-java.json",
  "cv-minimal.json",
  "cv-sophro.json",
];

test("public examples validate against the CvData contract", async () => {
  for (const fileName of exampleFiles) {
    const raw = await readFile(path.join(examplesDir, fileName), "utf-8");
    const fixture = JSON.parse(raw) as unknown;
    const result = await validateCvInput(fixture, { measureRender: false });

    assert.equal(result.pageLimitExceeded, false, `${fileName}: page limit exceeded`);
    assert.equal(result.issues.length, 0, `${fileName}: ${JSON.stringify(result.issues)}`);
    assert.equal(result.cvData.header.name.length > 0, true, `${fileName}: empty name`);
  }
});
