import test from "node:test";
import assert from "node:assert/strict";
import minimalFixture from "./fixtures/cv-minimal.json";
import { sampleCv } from "../src/data/sampleCv";
import { normalizeCvData } from "../src/model";
import { renderCvPdf, resolvePdfOptions } from "../src/engine/renderPdf";
import { measureCvLayout } from "../src/engine/pdfLayout";

test("resolvePdfOptions applique les valeurs par defaut", () => {
  const options = resolvePdfOptions();

  assert.equal(options.mode, "paginated");
  assert.equal(options.format, "A4");
  assert.equal(options.printBackground, true);
  assert.equal(options.preferCSSPageSize, true);
  assert.equal(options.margin.top, "8mm");
  assert.equal(options.timeoutMs, 120_000);
});

test("renderCvPdf genere un PDF non vide pour un CV minimal sans navigateur", async () => {
  const pdf = await renderCvPdf(normalizeCvData(minimalFixture));

  assert.ok(pdf.byteLength > 1000);
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString("utf8"), "%PDF");
});

test("renderCvPdf genere un PDF non vide pour un preset realiste sans navigateur", async () => {
  const pdf = await renderCvPdf(sampleCv);

  assert.ok(pdf.byteLength > 1000);
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString("utf8"), "%PDF");
});

test("renderCvPdf genere un PDF continu non vide sans navigateur", async () => {
  const pdf = await renderCvPdf(sampleCv, {
    mode: "continuous",
  });

  assert.ok(pdf.byteLength > 1000);
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString("utf8"), "%PDF");
});

test("measureCvLayout retourne une pagination exploitable sans navigateur", async () => {
  const metrics = await measureCvLayout(sampleCv, "paginated");

  assert.ok(metrics.pageCount >= 1);
  assert.equal(Array.isArray(metrics.issues), true);
});
