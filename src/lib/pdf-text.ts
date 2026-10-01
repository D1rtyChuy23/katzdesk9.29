/**
 * Browser-only: pull the text out of a PDF with pdf.js. The file never leaves the browser —
 * only the text goes to the server. Loaded on demand so pdf.js stays out of the main bundle.
 */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type PdfText = { text: string; pages: number; image: string | null };

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
    const image = await largestImage(pdfjs, doc).catch(() => null);
    return { text: out.join("\n\n").trim(), pages: doc.numPages, image };
  } finally {
    void doc.destroy();
  }
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDoc = Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>;
type PdfImage = { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray | Uint8Array; kind?: number };

/**
 * The equipment picture from the sheet: the largest embedded image on the first two pages
 * (logos and icons are smaller). Resized to 640 px JPEG so it stores small. Null if none.
 */
async function largestImage(pdfjs: PdfJs, doc: PdfDoc): Promise<string | null> {
  let best: PdfImage | null = null;
  for (let n = 1; n <= Math.min(2, doc.numPages); n++) {
    const page = await doc.getPage(n);
    const ops = await page.getOperatorList();
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
      const name = ops.argsArray[i]?.[0] as string | undefined;
      if (!name) continue;
      const img = await new Promise<PdfImage | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 3000);
        const objs = name.startsWith("g_") ? page.commonObjs : page.objs;
        objs.get(name, (v: unknown) => {
          clearTimeout(timer);
          resolve((v as PdfImage) ?? null);
        });
      });
      if (!img?.width || !img.height || img.width < 160 || img.height < 160) continue;
      const ratio = img.width / img.height;
      if (ratio > 4 || ratio < 0.25) continue; // banners and strips
      if (!best || img.width * img.height > best.width * best.height) best = img;
    }
  }
  if (!best) return null;
  const src = document.createElement("canvas");
  src.width = best.width;
  src.height = best.height;
  const sctx = src.getContext("2d");
  if (!sctx) return null;
  if (best.bitmap) {
    sctx.drawImage(best.bitmap, 0, 0);
  } else if (best.data) {
    const rgba = new Uint8ClampedArray(best.width * best.height * 4);
    const d = best.data;
    const px = best.width * best.height;
    if (d.length === px * 4) rgba.set(d);
    else if (d.length === px * 3) for (let p = 0; p < px; p++) { rgba[p * 4] = d[p * 3]!; rgba[p * 4 + 1] = d[p * 3 + 1]!; rgba[p * 4 + 2] = d[p * 3 + 2]!; rgba[p * 4 + 3] = 255; }
    else if (d.length === px) for (let p = 0; p < px; p++) { rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = d[p]!; rgba[p * 4 + 3] = 255; }
    else return null;
    sctx.putImageData(new ImageData(rgba, best.width, best.height), 0, 0);
  } else return null;
  return shrinkCanvas(src);
}

/** White background (JPEG has no alpha), longest side 640 px. */
export function shrinkCanvas(src: HTMLCanvasElement | HTMLImageElement, max = 640): string | null {
  const w = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h = "naturalHeight" in src ? src.naturalHeight : src.height;
  if (!w || !h) return null;
  const scale = Math.min(1, max / Math.max(w, h));
  const out = document.createElement("canvas");
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.82);
}

/** A photo the user picks for the spec sheet (Admin/Sales), resized the same way. */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is over 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const out = shrinkCanvas(img);
    if (!out) throw new Error("Couldn't read that image.");
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
