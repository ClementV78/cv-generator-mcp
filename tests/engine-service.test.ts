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

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test("getCvSchema exposes the expected render contract", () => {
  const schema = getCvSchema();

  assert.equal(schema.title, "CvData");
  assert.deepEqual(schema.properties.render.properties.sidebarPosition.enum, ["left", "right"]);
  assert(schema.properties.render.properties.theme.enum.includes("ocean"));
  assert.equal(schema.properties.render.properties.theme.enum.includes("zen-sunset"), false);
  assert.deepEqual(schema.properties.render.properties.language.enum, ["english", "french", "spanish"]);
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
