import test from "node:test";
import assert from "node:assert/strict";
import minimalFixture from "./fixtures/cv-minimal.json";
import { sampleCv } from "../src/data/sampleCv";
import { normalizeCvData } from "../src/model";
import {
  PdfRenderError,
  renderCvPdf,
  resolveBrowserExecutablePath,
  resolvePdfOptions,
} from "../src/engine/renderPdf";

test("resolvePdfOptions applique les valeurs par defaut", () => {
  const options = resolvePdfOptions();

  assert.equal(options.mode, "paginated");
  assert.equal(options.format, "A4");
  assert.equal(options.printBackground, true);
  assert.equal(options.preferCSSPageSize, true);
  assert.equal(options.margin.top, "8mm");
  assert.equal(options.timeoutMs, 15_000);
});

test("renderCvPdf genere un PDF non vide pour un CV minimal si un navigateur est disponible", async (t) => {
  const browserPath = await resolveBrowserExecutablePath();

  if (!browserPath) {
    t.skip("Aucun navigateur Chromium/Chrome disponible sur cette machine.");
    return;
  }

  const pdf = await renderCvPdf(normalizeCvData(minimalFixture), {
    browserExecutablePath: browserPath,
  });

  assert.ok(pdf.byteLength > 1000);
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString("utf8"), "%PDF");
});

test("renderCvPdf genere un PDF non vide pour un preset realiste si un navigateur est disponible", async (t) => {
  const browserPath = await resolveBrowserExecutablePath();

  if (!browserPath) {
    t.skip("Aucun navigateur Chromium/Chrome disponible sur cette machine.");
    return;
  }

  const pdf = await renderCvPdf(sampleCv, {
    browserExecutablePath: browserPath,
  });

  assert.ok(pdf.byteLength > 1000);
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString("utf8"), "%PDF");
});

test("renderCvPdf genere un PDF continu non vide si un navigateur est disponible", async (t) => {
  const browserPath = await resolveBrowserExecutablePath();

  if (!browserPath) {
    t.skip("Aucun navigateur Chromium/Chrome disponible sur cette machine.");
    return;
  }

  const pdf = await renderCvPdf(sampleCv, {
    browserExecutablePath: browserPath,
    mode: "continuous",
  });

  assert.ok(pdf.byteLength > 1000);
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString("utf8"), "%PDF");
});

test("renderCvPdf remonte une erreur structuree si le navigateur est introuvable", async () => {
  await assert.rejects(
    () =>
      renderCvPdf(sampleCv, {
        browserExecutablePath: "C:\\__introuvable__\\chrome.exe",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PdfRenderError);
      assert.equal(error.code, "browser_not_found");
      return true;
    },
  );
});
