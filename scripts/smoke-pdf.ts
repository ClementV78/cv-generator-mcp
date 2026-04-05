import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sampleCv } from "../src/data/sampleCv";
import { renderCvPdf } from "../src/engine/renderPdf";

const run = async (): Promise<void> => {
  const outputDir = join(tmpdir(), "cv-generator");
  const pdfMode = process.env.CV_PDF_MODE === "continuous" ? "continuous" : "paginated";
  const outputPath = join(outputDir, `cv-smoke-test-${pdfMode}.pdf`);

  await mkdir(outputDir, { recursive: true });

  const pdf = await renderCvPdf(sampleCv, {
    mode: pdfMode,
  });
  await writeFile(outputPath, pdf);

  console.log(`Mode PDF : ${pdfMode}`);
  console.log(`PDF genere : ${outputPath}`);
  console.log(`Taille : ${pdf.byteLength} octets`);
};

run().catch((error: unknown) => {
  console.error("Echec du smoke test PDF.");
  console.error(error);
  process.exitCode = 1;
});
