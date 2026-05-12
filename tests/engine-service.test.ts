import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCvArtifact, getCvSchema, validateCvInput } from "../src/engine/service";
import { writeBinaryArtifactToTempFile } from "../src/engine/output";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const minimalFixturePath = path.join(__dirname, "fixtures", "cv-minimal.json");

const readMinimalFixture = async (): Promise<unknown> => {
  const raw = await readFile(minimalFixturePath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test("getCvSchema exposes the expected render contract", () => {
  const schema = getCvSchema();

  assert.equal(schema.title, "CvData");
  assert.equal(schema.properties.header.properties.photoPath.type, "string");
  assert.match(schema.properties.header.properties.photoPath.description, /photoPath/);
  assert.deepEqual(schema.properties.render.properties.sidebarPosition.enum, ["left", "right"]);
  assert(schema.properties.render.properties.theme.enum.includes("ocean"));
  assert.equal(schema.properties.render.properties.theme.enum.includes("zen-sunset"), false);
  assert.deepEqual(schema.properties.render.properties.language.enum, ["english", "french", "spanish"]);
  assert.deepEqual(schema.properties.render.properties.templateStyle.enum, [
    "classic",
    "compact",
    "ultra-compact",
  ]);
  assert.equal(schema.properties.render.properties.showSkillLevels.type, "boolean");
});

test("validateCvInput normalizes the fixture and returns structure messages", async () => {
  const fixture = await readMinimalFixture();
  const result = await validateCvInput(fixture, { measureRender: false });

  assert.equal(result.cvData.header.name.length > 0, true);
  assert.equal(Array.isArray(result.structureMessages), true);
  assert.equal(Array.isArray(result.issues), true);
  assert.equal(result.pageLimitExceeded, false);
  assert.equal(result.cvData.render.templateStyle, "classic");
  assert.equal(result.cvData.render.showSkillLevels, true);
});

test("validateCvInput resolves local header.photoPath into a data URL", async () => {
  const fixture = cloneJson((await readMinimalFixture()) as Record<string, unknown>);
  const assetDir = await mkdtemp(path.join(os.tmpdir(), "cv-generator-assets-"));
  const photoPath = path.join(assetDir, "photo.png");
  const previousAllowedAssetDir = process.env.CV_GENERATOR_ALLOWED_ASSET_DIR;

  await writeFile(
    photoPath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  );

  process.env.CV_GENERATOR_ALLOWED_ASSET_DIR = assetDir;
  (fixture.header as Record<string, unknown>).photoPath = photoPath;
  (fixture.header as Record<string, unknown>).photoUrl = "";
  (fixture.header as Record<string, unknown>).showPhoto = true;

  try {
    const result = await validateCvInput(fixture, { measureRender: false });

    assert.equal(result.cvData.header.photoPath, photoPath);
    assert.match(result.cvData.header.photoUrl, /^data:image\/png;base64,/);
  } finally {
    if (previousAllowedAssetDir === undefined) {
      delete process.env.CV_GENERATOR_ALLOWED_ASSET_DIR;
    } else {
      process.env.CV_GENERATOR_ALLOWED_ASSET_DIR = previousAllowedAssetDir;
    }
  }
});

test("validateCvInput keeps missing experience subtitles hidden", async () => {
  const fixture = cloneJson((await readMinimalFixture()) as Record<string, unknown>);
  fixture.experiences = [
    {
      company: "Example Corp",
      role: "Cloud Engineer",
      period: "2025",
      bullets: [{ text: "Built cloud automation." }],
      techEnvironmentLabel: "Environment",
      techEnvironment: "AWS, Terraform",
      projects: [],
    },
  ];

  const result = await validateCvInput(fixture, { measureRender: false });

  assert.equal(result.cvData.experiences[0]?.subtitle, "");
});

test("generateCvArtifact renders HTML without editor chrome", async () => {
  const fixture = await readMinimalFixture();
  const result = await generateCvArtifact(fixture, { format: "html" });

  assert.equal(result.format, "html");
  assert.match(result.content, /<!doctype html>/i);
  assert.match(result.content, /cv-sheet/);
  assert.doesNotMatch(result.content, /Template Editor/i);
});

test("writeBinaryArtifactToTempFile honors CV_GENERATOR_OUTPUT_DIR", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "cv-generator-output-"));
  const previousOutputDir = process.env.CV_GENERATOR_OUTPUT_DIR;

  process.env.CV_GENERATOR_OUTPUT_DIR = outputDir;

  try {
    const filePath = await writeBinaryArtifactToTempFile("cv-template.pdf", new Uint8Array([1, 2, 3]));

    assert.equal(path.dirname(filePath), outputDir);
    assert.match(path.basename(filePath), /^cv-template-\d+\.pdf$/);
    await access(filePath);
  } finally {
    if (previousOutputDir === undefined) {
      delete process.env.CV_GENERATOR_OUTPUT_DIR;
    } else {
      process.env.CV_GENERATOR_OUTPUT_DIR = previousOutputDir;
    }
  }
});

test("generateCvArtifact localizes HTML chrome for english and spanish CVs", async () => {
  const fixture = cloneJson((await readMinimalFixture()) as Record<string, unknown>);

  const english = cloneJson(fixture);
  (english.header as Record<string, unknown>).name = "Alex Carter";
  (english.header as Record<string, unknown>).headline = "DEVOPS ENGINEER | CLOUD PLATFORM | AUTOMATION";
  (english.header as Record<string, unknown>).availabilityText = "Available for DevOps and platform engineering roles.";
  (english.header as Record<string, unknown>).qrCodeLabel = "Web version";
  english.profileLabel = "Professional profile";
  english.profile = "DevOps engineer with experience in cloud automation, CI/CD, and platform reliability.";
  (english.mainEducation as Record<string, unknown>).title = "Education";
  (english.mainEducation as Record<string, unknown>).summary = "Computer science degree and continuous training in cloud and automation.";
  (english.render as Record<string, unknown>).language = "english";

  const englishResult = await generateCvArtifact(english, { format: "html" });
  assert.match(englishResult.content, /<html lang="en">/);
  assert.match(englishResult.content, /Professional Experience and Projects/);
  assert.match(englishResult.content, />Skills</);
  assert.doesNotMatch(englishResult.content, /Expériences professionnelles et projets/);
  assert.doesNotMatch(englishResult.content, />Compétences</);

  const spanish = cloneJson(fixture);
  (spanish.header as Record<string, unknown>).name = "Lucia Ortega";
  (spanish.header as Record<string, unknown>).headline = "INGENIERA DEVOPS | PLATAFORMA CLOUD | AUTOMATIZACIÓN";
  (spanish.header as Record<string, unknown>).availabilityText = "Disponible para puestos de DevOps y plataforma cloud.";
  (spanish.header as Record<string, unknown>).qrCodeLabel = "Versión web";
  spanish.profileLabel = "Perfil profesional";
  spanish.profile = "Ingeniera DevOps con experiencia en automatización cloud, CI/CD y fiabilidad de plataformas.";
  (spanish.mainEducation as Record<string, unknown>).title = "Formación";
  (spanish.mainEducation as Record<string, unknown>).summary = "Ingeniería informática y formación continua en cloud y automatización.";
  (spanish.render as Record<string, unknown>).language = "spanish";

  const spanishResult = await generateCvArtifact(spanish, { format: "html" });
  assert.match(spanishResult.content, /<html lang="es">/);
  assert.match(spanishResult.content, /Experiencia profesional y proyectos/);
  assert.match(spanishResult.content, />Competencias</);
  assert.doesNotMatch(spanishResult.content, /Expériences professionnelles et projets/);
  assert.doesNotMatch(spanishResult.content, />Compétences</);
});
