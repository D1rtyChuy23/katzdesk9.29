/**
 * Server-only: the text of a stored PDF, page by page. Images are ignored. Loaded on demand.
 *
 * Built on unpdf's serverless pdf.js, which needs no worker file and no canvas, so it runs inside the bundled server.
 * The reader before it (pdfjs-dist's legacy build) needed pdf.worker.mjs from node_modules and @napi-rs/canvas for
 * DOMMatrix at run time; neither ships in the Vercel function, so every file failed to open in production (10/28).
 */

/** The text of each page, in order (a page with no text is ""), and how many pages the file has. */
export type PdfText = { totalPages: number; pages: string[] };

/** True when the bytes start like a PDF ("%PDF-"). */
export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!, bytes[4]!) === "%PDF-";
}

type TextItem = { str?: string; hasEOL?: boolean; transform?: number[]; width?: number; height?: number };

/**
 * One page's text items as lines: pdf.js marks the end of a line (hasEOL), and an item that starts lower or higher on
 * the page than the one before it starts a new line too. On one line, a gap wider than a fraction of the font size
 * (a table's next column) gets a space. Spaces and tabs are collapsed, line breaks kept.
 */
export function pageText(items: TextItem[]): string {
  let out = "";
  let prev: TextItem | null = null;
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    if (prev && !prev.hasEOL && !out.endsWith("\n")) {
      const [y0, y1] = [prev.transform?.[5], item.transform?.[5]];
      const size = Math.max(prev.height ?? 0, item.height ?? 0, 1);
      if (y0 != null && y1 != null && Math.abs(y1 - y0) > size * 0.6) out += "\n";
      else {
        const [x0, x1] = [prev.transform?.[4], item.transform?.[4]];
        const gap = x0 != null && x1 != null && prev.width != null ? x1 - (x0 + prev.width) : 0;
        if (gap > size * 0.15 && !/\s$/.test(out) && !/^\s/.test(item.str)) out += " ";
      }
    }
    out += item.str;
    if (item.hasEOL) out += "\n";
    prev = item;
  }
  return out
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Every page's text, in order, with its line breaks. Throws when the file can't be opened as a PDF. */
export async function pdfPages(bytes: Uint8Array): Promise<PdfText> {
  if (!isPdf(bytes)) throw new Error("it is not a PDF file");
  const { getDocumentProxy } = await import("unpdf");
  // pdf.js may take over the buffer it is given: hand it a copy.
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      try {
        const content = await page.getTextContent();
        pages.push(pageText(content.items as TextItem[]));
      } finally {
        page.cleanup();
      }
    }
    return { totalPages: doc.numPages, pages };
  } finally {
    await doc.loadingTask.destroy();
  }
}

/**
 * A scanned PDF has no text layer. OCR could read it here and return its pages; it isn't built yet, so this returns
 * null. TODO(OCR): read scanned spec sheets and manuals (left out of the 10/28 fix on purpose).
 */
export async function ocrPdfPages(_bytes: Uint8Array): Promise<string[] | null> {
  return null;
}
