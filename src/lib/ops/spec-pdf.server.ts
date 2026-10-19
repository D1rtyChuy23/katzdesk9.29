/**
 * Server-only: pull text out of a stored spec PDF. Images are ignored.
 * Loaded on demand so pdf.js stays out of the browser bundle.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export async function pdfBytesToText(bytes: Uint8Array): Promise<string> {
  if (bytes.length < 5) return "";
  const head = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!, bytes[4]!);
  if (head !== "%PDF-") return "";
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const require = createRequire(import.meta.url);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const pages: string[] = [];
  try {
    const n = Math.min(doc.numPages, 12);
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      if (line.trim()) pages.push(line);
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages.join("\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 60_000);
}
