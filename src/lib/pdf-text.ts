/**
 * Browser-only: pull the text out of a PDF with pdf.js. The file never leaves the browser —
 * only the text goes to the server. Loaded on demand so pdf.js stays out of the main bundle.
 */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type PdfText = { text: string; pages: number };

export async function pdfToText(file: File): Promise<PdfText> {
  if (file.size > MAX_PDF_BYTES) throw new Error("That PDF is over 10 MB.");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) throw new Error("Only PDF files can be imported.");
  // The legacy build runs on older Safari/iPad too.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = new TextDecoder().decode(bytes.slice(0, 5));
  if (head !== "%PDF-") throw new Error("That file isn't a readable PDF.");
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const out: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let line = "";
      const lines: string[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        } else if (item.str && !item.str.endsWith(" ")) {
          line += " ";
        }
      }
      if (line.trim()) lines.push(line);
      out.push(lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n"));
      page.cleanup();
    }
    return { text: out.join("\n\n").trim(), pages: doc.numPages };
  } finally {
    void doc.destroy();
  }
}
