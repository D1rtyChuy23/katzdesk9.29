// The Library's server PDF reader (10/28): every page's text with its line breaks, from unpdf's serverless pdf.js (no
// worker file, no canvas). The PDFs are made in memory by pdf-fixture.mjs; none is kept in git.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { makePdf } from "./pdf-fixture.mjs";

await register("./node-resolve-hook.mjs", import.meta.url);
const { isPdf, ocrPdfPages, pageText, pdfPages } = await import("../src/lib/ops/spec-pdf.server.ts");

test("every page's text, in order, with its line breaks; a page with no text is blank", async () => {
  const bytes = makePdf([
    ["ACME Brewer X1", "Installation Manual (rev. 2)"],
    ["Technical Data", "Voltage 120 V", "Amps 15 A", "Weight 40 lb"],
    [],
    ["Back cover"],
  ]);
  assert.equal(isPdf(bytes), true);
  const read = await pdfPages(bytes);
  assert.equal(read.totalPages, 4);
  assert.deepEqual(read.pages, ["ACME Brewer X1\nInstallation Manual (rev. 2)", "Technical Data\nVoltage 120 V\nAmps 15 A\nWeight 40 lb", "", "Back cover"]);
});

test("a long file is read to its last page", async () => {
  const read = await pdfPages(makePdf(Array.from({ length: 40 }, (_, i) => [`Page ${i + 1} of 40`])));
  assert.equal(read.pages.length, 40);
  assert.equal(read.pages[39], "Page 40 of 40");
});

test("a file that isn't a PDF, or a broken one, throws with the reason", async () => {
  assert.equal(isPdf(new Uint8Array([0x50, 0x4b, 3, 4, 0])), false);
  await assert.rejects(() => pdfPages(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])), /it is not a PDF file/);
  await assert.rejects(() => pdfPages(new TextEncoder().encode("%PDF-1.4 nothing else")), /Invalid PDF structure/);
});

test("lines: pdf.js's end-of-line marks, a jump up or down the page, a column gap, and spaces collapsed", () => {
  const at = (str, x, y, width, extra = {}) => ({ str, transform: [12, 0, 0, 12, x, y], width, height: 12, ...extra });
  assert.equal(
    pageText([at("Voltage", 72, 700, 40), at("  120 V ", 160, 700, 30, { hasEOL: true }), at("Amps", 72, 684, 28), at("15 A", 160, 684, 22)]),
    "Voltage 120 V\nAmps 15 A",
    "the next column on a line gets a space",
  );
  assert.equal(pageText([at("Specifi", 72, 700, 40), at("cations", 112.5, 700, 40)]), "Specifications", "a word split in two keeps together");
  assert.equal(pageText([at("Model", 72, 700, 30), at("X1", 72, 640, 12)]), "Model\nX1", "a new line without an end-of-line mark");
  assert.equal(pageText([{ str: "a" }, { hasEOL: true }, { str: "b" }]), "ab");
});

test("OCR is a hook for later: it reads nothing yet", async () => {
  assert.equal(await ocrPdfPages(makePdf([[]])), null);
});
