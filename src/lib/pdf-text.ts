/**
 * Browser-only: pull the text out of a PDF with pdf.js. The file never leaves the browser —
 * only the text goes to the server. Loaded on demand so pdf.js stays out of the main bundle.
 */
import { classifyImage, MIN_SIDE, pickImages, pixelStats, type ImageCandidate, type TitleAnchor } from "@/lib/ops/spec-image-pick";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type PdfText = {
  text: string;
  pages: number;
  /** The machine photo (primary image). */
  image: string | null;
  /** A dimension drawing (front/side views with measurements), shown second under "Dimensions". */
  dimsImage: string | null;
  /** Why there is no machine photo, when there isn't one. */
  imageNote: string | null;
};

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
    const pics = await sheetImages(pdfjs, doc).catch(() => ({ image: null, dimsImage: null, imageNote: null }));
    return { text: out.join("\n\n").trim(), pages: doc.numPages, ...pics };
  } finally {
    void doc.destroy();
  }
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDoc = Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>;
type PdfImage = { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray | Uint8Array; kind?: number };

/** Draw a pdf.js image object onto a canvas (bitmap or raw pixel data). */
function toCanvas(img: PdfImage): HTMLCanvasElement | null {
  const src = document.createElement("canvas");
  src.width = img.width;
  src.height = img.height;
  const ctx = src.getContext("2d");
  if (!ctx) return null;
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
    return src;
  }
  if (!img.data) return null;
  const px = img.width * img.height;
  const d = img.data;
  const rgba = new Uint8ClampedArray(px * 4);
  if (d.length === px * 4) rgba.set(d);
  else if (d.length === px * 3) {
    for (let p = 0; p < px; p++) {
      rgba[p * 4] = d[p * 3]!;
      rgba[p * 4 + 1] = d[p * 3 + 1]!;
      rgba[p * 4 + 2] = d[p * 3 + 2]!;
      rgba[p * 4 + 3] = 255;
    }
  } else if (d.length === px) {
    for (let p = 0; p < px; p++) {
      rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = d[p]!;
      rgba[p * 4 + 3] = 255;
    }
  } else return null;
  ctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
  return src;
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
/** m applied after n (PDF "cm" concatenation). */
function concat(m: Matrix, n: Matrix): Matrix {
  return [
    n[0] * m[0] + n[1] * m[2],
    n[0] * m[1] + n[1] * m[3],
    n[2] * m[0] + n[3] * m[2],
    n[2] * m[1] + n[3] * m[3],
    n[4] * m[0] + n[5] * m[2] + m[4],
    n[4] * m[1] + n[5] * m[3] + m[5],
  ];
}

function statsOf(canvas: HTMLCanvasElement) {
  const small = document.createElement("canvas");
  small.width = 96;
  small.height = 96;
  const ctx = small.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 96, 96);
  ctx.drawImage(canvas, 0, 0, 96, 96);
  return pixelStats(ctx.getImageData(0, 0, 96, 96).data);
}

/** How many of the first pages to search for the machine photo. */
const IMAGE_PAGES = 3;

/**
 * Every embedded image on the first pages, classified (icon / diagram / photo) with its size,
 * page position and how many pages it repeats on — then the picker chooses. The primary is the
 * machine photo or nothing; warning symbols, logos, barcodes and drawings can never be primary.
 */
async function sheetImages(pdfjs: PdfJs, doc: PdfDoc): Promise<{ image: string | null; dimsImage: string | null; imageNote: string | null }> {
  const found = new Map<string, { cand: ImageCandidate; canvas: HTMLCanvasElement; seenPages: Set<number> }>();
  let title: TitleAnchor | null = null;
  const pages = Math.min(IMAGE_PAGES, doc.numPages);
  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    if (n === 1) {
      // The model name / title: the tallest text on page 1.
      const text = await page.getTextContent();
      let best = 0;
      for (const item of text.items) {
        if (!("str" in item) || item.str.trim().length < 3) continue;
        const h = Math.abs(item.height || item.transform[3] || 0);
        if (h > best) {
          best = h;
          title = { page: 1, x: item.transform[4], y: item.transform[5] };
        }
      }
    }
    const ops = await page.getOperatorList();
    let ctm: Matrix = IDENTITY;
    const stack: Matrix[] = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i] as unknown[] | undefined;
      if (fn === pdfjs.OPS.save) stack.push(ctm);
      else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? IDENTITY;
      else if (fn === pdfjs.OPS.transform && args && args.length >= 6) ctm = concat(ctm, args as unknown as Matrix);
      else if (fn === pdfjs.OPS.paintFormXObjectBegin) {
        stack.push(ctm);
        const m = args?.[0] as Matrix | undefined;
        if (Array.isArray(m) && m.length >= 6) ctm = concat(ctm, m);
      } else if (fn === pdfjs.OPS.paintFormXObjectEnd) ctm = stack.pop() ?? IDENTITY;

      const isObject = fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintImageXObjectRepeat;
      const isInline = fn === pdfjs.OPS.paintInlineImageXObject;
      if (!isObject && !isInline) continue;

      let key: string;
      let img: PdfImage | null;
      if (isInline) {
        img = (args?.[0] as PdfImage) ?? null;
        key = `inline-${n}-${i}`;
      } else {
        const name = args?.[0] as string | undefined;
        if (!name) continue;
        key = name;
        const known = found.get(key);
        if (known) {
          known.seenPages.add(n);
          continue;
        }
        img = await new Promise<PdfImage | null>((resolve) => {
          const timer = setTimeout(() => resolve(null), 3000);
          const objs = name.startsWith("g_") ? page.commonObjs : page.objs;
          objs.get(name, (v: unknown) => {
            clearTimeout(timer);
            resolve((v as PdfImage) ?? null);
          });
        });
      }
      if (!img?.width || !img.height) continue;
      // Too small to be the machine: skip before decoding (bullets, glyphs, small logos).
      if (Math.min(img.width, img.height) < MIN_SIDE) continue;
      const canvas = toCanvas(img);
      if (!canvas) continue;
      const stats = statsOf(canvas);
      if (!stats) continue;
      // Same picture embedded separately on each page (logos, footers) counts as one repeating image.
      const sig = `${img.width}x${img.height}:${stats.bins}:${stats.top3.toFixed(3)}:${stats.white.toFixed(3)}:${stats.dark.toFixed(3)}`;
      const twin = [...found.values()].find((f) => f.cand.id.endsWith(sig) && !f.seenPages.has(n));
      if (twin) {
        twin.seenPages.add(n);
        continue;
      }
      found.set(key, {
        canvas,
        seenPages: new Set([n]),
        cand: {
          id: `${key}|${sig}`,
          page: n,
          width: img.width,
          height: img.height,
          kind: classifyImage(img.width, img.height, stats),
          pages: 1,
          // The image fills the unit square under the current transform; its centre is (0.5, 0.5).
          cx: ctm[0] * 0.5 + ctm[2] * 0.5 + ctm[4],
          cy: ctm[1] * 0.5 + ctm[3] * 0.5 + ctm[5],
        },
      });
    }
  }
  const all = [...found.values()];
  for (const f of all) f.cand.pages = f.seenPages.size;
  const pick = pickImages(all.map((f) => f.cand), title);
  const canvasOf = (c: ImageCandidate | null) => (c ? all.find((f) => f.cand === c)?.canvas ?? null : null);
  const primary = canvasOf(pick.primary);
  const diagram = canvasOf(pick.diagram);
  return {
    image: primary ? shrinkCanvas(primary) : null,
    dimsImage: diagram ? shrinkCanvas(diagram, 1400) : null,
    imageNote: primary
      ? null
      : all.length
        ? "No machine photo found in this PDF (only symbols, logos or drawings). Use Add Image to set one."
        : "This PDF has no embedded pictures. Use Add Image to set the machine photo.",
  };
}

/** Just the pictures from a spec sheet PDF — for re-reading the image of a sheet that's already saved. */
export async function pdfImages(file: File): Promise<{ image: string | null; dimsImage: string | null; imageNote: string | null }> {
  if (file.size > MAX_PDF_BYTES) throw new Error("That PDF is over 10 MB.");
  if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) throw new Error("Pick the spec sheet PDF.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("That file isn't a readable PDF.");
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  try {
    return await sheetImages(pdfjs, doc);
  } finally {
    void doc.destroy();
  }
}

/** White background (JPEG has no alpha), longest side 1200 px — large enough to enlarge. */
export function shrinkCanvas(src: HTMLCanvasElement | HTMLImageElement, max = 1200): string | null {
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
export async function imageFileToDataUrl(file: File, max = 1200): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is over 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const out = shrinkCanvas(img, max);
    if (!out) throw new Error("Couldn't read that image.");
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
