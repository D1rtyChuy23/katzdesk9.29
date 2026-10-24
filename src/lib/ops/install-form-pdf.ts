/**
 * The Equipment Request Form as a fillable PDF, for the Download button on the form page. Same sections and order as the
 * printed form, with every value in a field that can be changed on a phone, tablet or computer, a Done box on each
 * checklist line, and a Tech notes box at the end of each section. Letter size, standard PDF fonts only (nothing to
 * embed), so the file stays small and opens in any PDF app.
 *
 * Pure apart from pdf-lib: the page builds it in the browser, and the tests build it in Node.
 */
import {
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString,
  StandardFonts,
  TextAlignment,
  rgb,
  setCharacterSpacing,
  type Color,
  type PDFField,
  type PDFFont,
  type PDFForm,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type { InstallFormPayload } from "./install-form-api";
import { formDate, type CheckNote, type FormRow } from "./install-form.ts";
import { entryKey, stampText } from "./install-form-entries.ts";

/** Letter, in points (72 to the inch). */
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;
/** Content stops above the footer. */
const BOTTOM = 54;
/** Room for content on a page after the first (the short band). */
const PAGE_ROOM = PAGE_H - 64 - 7 - 14 - BOTTOM;
/** A Tech notes box: the gap above it, its label, the box, the gap after it. */
const NOTES_H = 40;
const NOTES_BLOCK = 4 + 10 + NOTES_H + 12;
/** The equipment heading and the dark bar under it. */
const EQ_HEAD = 37;
/** Verified by / Date, or the Corrigo work order line under a checklist. */
const AFTER_H = 26;

const hex = (h: string): Color => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/** The printed form's colors. */
const C = {
  band: hex("#100f0d"),
  ink: hex("#1a1612"),
  gold: hex("#a8862a"),
  goldLight: hex("#f0e6a3"),
  cream: hex("#fbf6e4"),
  muted: hex("#5f584f"),
  line: hex("#cfc6b8"),
  bronze: hex("#8f6a22"),
  tag: hex("#fbf5e6"),
  field: hex("#fdfbf6"),
  fieldLine: hex("#b4aa9b"),
  soft: hex("#8a8174"),
  white: rgb(1, 1, 1),
};

/** Blank write-in rows after the machines, for extras. */
const BLANK_ROWS = 2;
/** A serial this short was likely cut off when it was typed. Same rule as the printed form. */
const SHORT_SERIAL = 4;
const FIELD_BORDER = 0.75;
/** A field sits this far inside the box drawn for it, so its text never touches the line. */
const INSET = 2.5;
/** The width a field's text gets in a box `w` wide: the inset, and the PDF app's own 1pt each side. */
const textWidth = (w: number) => w - 2 * INSET - 2;

type Fonts = { sans: PDFFont; bold: PDFFont; display: PDFFont; italic: PDFFont; mono: PDFFont };

type BandKind = "request" | "continued" | "checklist" | "checklist-continued";

const BANDS: Record<BandKind, { lead: string; title: string; motto?: boolean }> = {
  request: { lead: "Service Department · Install Request", title: "Equipment Request Form" },
  continued: { lead: "Service Department · Install Request", title: "Equipment to Install, Continued" },
  checklist: { lead: "Come and fix it.", title: "Install Checklist & Sign-Off", motto: true },
  "checklist-continued": { lead: "Come and fix it.", title: "Install Checklist & Sign-Off, Continued", motto: true },
};

type Layout = {
  doc: PDFDocument;
  form: PDFForm;
  fonts: Fonts;
  logo: PDFImage | null;
  data: InstallFormPayload;
  sheets: { page: PDFPage; kind: BandKind }[];
  page: PDFPage;
  /** Top of the next block on the current page. Blocks are laid out downwards from it. */
  y: number;
};

export type InstallFormPdfOptions = {
  /** The Katz Coffee mark as a PNG, drawn in the band. Left out, the band has the words only. */
  logoPng?: Uint8Array | ArrayBuffer | null;
  /** Stamped as the file's creation date (tests pass a fixed one). */
  now?: Date;
};

/** The Tech notes box at the end of each section, by field name: what a test, or a filled-in copy, reads back. */
export const TECH_NOTE_FIELDS = {
  account: "notes_account",
  equipment: "notes_equipment",
  pre: "notes_pre",
  tasks: "notes_tasks",
  corrigo: "notes_corrigo",
  signoff: "notes_signoff",
} as const;

const REPLACE: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "✓": "",
  "✔": "",
  "✗": "x",
  "✘": "x",
  "−": "-",
  "‐": "-",
  "‑": "-",
  "\u00a0": " ",
  "\u2007": " ",
  "\u2009": " ",
  "\u202f": " ",
  "\u200b": "",
  "\ufeff": "",
};

/**
 * Text the font can write: the standard PDF fonts cover Western European letters (é, ñ, “quotes”, —), and anything else
 * is spelled the closest way they can (→ as ->, accents dropped as a last resort) or becomes "?". Never throws.
 */
export function pdfSafeText(raw: string | null | undefined, font: PDFFont, multiline = false): string {
  const supported = charSet(font);
  const text = String(raw ?? "").normalize("NFC").replace(/\r\n?/g, "\n");
  let out = "";
  for (const ch of text) {
    if (ch === "\n") {
      out += multiline ? "\n" : " ";
      continue;
    }
    if (ch === "\t") {
      out += " ";
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (supported.has(code)) {
      out += ch;
      continue;
    }
    if (ch in REPLACE) {
      out += REPLACE[ch];
      continue;
    }
    const base = ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    out += base && [...base].every((b) => supported.has(b.codePointAt(0) ?? 0)) ? base : code < 32 ? "" : "?";
  }
  return multiline ? out.replace(/ {2,}/g, " ").replace(/ +\n/g, "\n").replace(/\n +/g, "\n").trim() : out.replace(/\s+/g, " ").trim();
}

const charSets = new WeakMap<PDFFont, Set<number>>();
function charSet(font: PDFFont): Set<number> {
  let set = charSets.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    charSets.set(font, set);
  }
  return set;
}

/** "Equipment Request Form - Install 135 - Bar By The Wayside.pdf": safe on every phone and computer. */
export function installFormPdfName(data: Pick<InstallFormPayload, "id" | "customer">): string {
  const customer = String(data.customer ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w .,&'()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return `Equipment Request Form - Install ${data.id}${customer ? ` - ${customer}` : ""}.pdf`;
}

/** Builds the file. */
export async function buildInstallFormPdf(data: InstallFormPayload, opts: InstallFormPdfOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const now = opts.now ?? new Date();
  const title = `Equipment Request Form · Install #${data.id}${data.customer ? ` · ${data.customer}` : ""}`;
  const fonts: Fonts = {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    display: await doc.embedFont(StandardFonts.TimesRomanBold),
    italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
  doc.setTitle(pdfSafeText(title, fonts.sans), { showInWindowTitleBar: true });
  doc.setAuthor("Katz Coffee");
  doc.setSubject("Install request: equipment, pre-installation checklist, installation tasks and sign-off");
  doc.setKeywords(["Katz Coffee", "Equipment Request Form", `Install ${data.id}`]);
  doc.setCreator("KatzDesk");
  doc.setProducer("KatzDesk");
  doc.setLanguage("en-US");
  doc.setCreationDate(now);
  doc.setModificationDate(now);

  let logo: PDFImage | null = null;
  if (opts.logoPng) {
    try {
      logo = await doc.embedPng(opts.logoPng);
    } catch {
      logo = null;
    }
  }
  const form = doc.getForm();
  const first = doc.addPage([PAGE_W, PAGE_H]);
  const L: Layout = { doc, form, fonts, logo, data, sheets: [{ page: first, kind: "request" }], page: first, y: 0 };
  L.y = drawBand(L, first, "request");

  accountSection(L);
  equipmentSection(L);
  newPage(L, "checklist");
  checkSection(L, {
    key: "pre",
    title: "Pre-installation checklist",
    role: "Sales rep · Pre-inspection",
    rows: data.pre,
    after: (l) =>
      inlineFields(l, [
        { label: "Verified by", name: "pre_verified_by", value: data.entries?.verifiedBy ?? data.inspector, width: 190 },
        { label: "Date", name: "pre_date", value: formDate(data.entries?.verifiedOn) || data.inspectedOn, width: 120 },
      ]),
  });
  checkSection(L, { key: "tasks", title: "Installation tasks", role: "Tech on site", rows: data.tasks });
  checkSection(L, {
    key: "corrigo",
    title: "Corrigo account update tasks",
    role: "Tech or office",
    rows: data.corrigo,
    after: (l) =>
      inlineFields(l, [
        {
          label: data.workOrders.length > 1 ? "Corrigo work orders" : "Corrigo work order #",
          name: "corrigo_work_orders",
          value: data.workOrders.join(", "),
          width: "rest",
        },
      ]),
  });
  signOff(L);
  finishPages(L);
  addFieldFonts(L);
  // Every field's look was drawn as it was made, in its own font; saving must not redraw them all in Helvetica.
  return doc.save({ updateFieldAppearances: false });
}

/* ------------------------------------------------------------------ pages */

function newPage(L: Layout, kind: BandKind) {
  const page = L.doc.addPage([PAGE_W, PAGE_H]);
  L.sheets.push({ page, kind });
  L.page = page;
  L.y = drawBand(L, page, kind);
}

/** Room for `height` more on this page; otherwise a new page of `kind`. True when a new page was started. */
function ensure(L: Layout, height: number, kind: BandKind): boolean {
  if (L.y - height >= BOTTOM) return false;
  newPage(L, kind);
  return true;
}

/** A section that fits on one page starts on the next page rather than being split. A longer one flows row by row. */
function keepTogether(L: Layout, height: number, kind: BandKind) {
  if (L.y - height < BOTTOM && height <= PAGE_ROOM) newPage(L, kind);
}

/** The dark band with the gold double rule under it. Returns where the content starts. Page numbers come at the end. */
function drawBand(L: Layout, page: PDFPage, kind: BandKind): number {
  const tall = kind === "request";
  const h = tall ? 92 : 64;
  const bottom = PAGE_H - h;
  page.drawRectangle({ x: 0, y: bottom, width: PAGE_W, height: h, color: C.band });
  let x = MARGIN;
  if (L.logo) {
    const lh = tall ? 60 : 42;
    const lw = (L.logo.width / L.logo.height) * lh;
    page.drawImage(L.logo, { x, y: bottom + (h - lh) / 2, width: lw, height: lh });
    x += lw + (tall ? 18 : 14);
  }
  const band = BANDS[kind];
  const { fonts } = L;
  if (band.motto) page.drawText(band.lead, { x, y: bottom + (tall ? 54 : 37), size: tall ? 11 : 10, font: fonts.italic, color: C.goldLight });
  else spaced(page, band.lead.toUpperCase(), { x, y: bottom + (tall ? 54 : 38), size: tall ? 7.5 : 6.8, font: fonts.bold, color: C.goldLight, spacing: 1.5 });
  page.drawText(band.title, { x, y: bottom + (tall ? 26 : 16), size: tall ? 24 : 18, font: fonts.display, color: C.cream });
  const right = PAGE_W - MARGIN;
  if (tall) spacedRight(page, "INSTALL", { right, y: bottom + 66, size: 7.5, font: fonts.bold, color: C.goldLight, spacing: 1.4 });
  const num = `#${L.data.id}`;
  const numSize = tall ? 30 : 22;
  page.drawText(num, { x: right - fonts.display.widthOfTextAtSize(num, numSize), y: bottom + (tall ? 34 : 28), size: numSize, font: fonts.display, color: C.goldLight });
  page.drawRectangle({ x: 0, y: bottom - 3, width: PAGE_W, height: 3, color: C.gold });
  page.drawRectangle({ x: 0, y: bottom - 3 - 2.25 - 1.5, width: PAGE_W, height: 1.5, color: C.gold });
  return bottom - 7 - (tall ? 16 : 14);
}

/** Page numbers in each band, and the footer on every page. */
function finishPages(L: Layout) {
  const total = L.sheets.length;
  const { fonts, data } = L;
  L.sheets.forEach(({ page, kind }, i) => {
    const tall = kind === "request";
    const bottom = PAGE_H - (tall ? 92 : 64);
    spacedRight(page, `PAGE ${i + 1} OF ${total}`, { right: PAGE_W - MARGIN, y: bottom + (tall ? 18 : 14), size: 7, font: fonts.bold, color: C.goldLight, spacing: 1.1 });
    page.drawRectangle({ x: MARGIN, y: 40, width: CONTENT_W, height: 0.75, color: C.gold });
    const size = 7.5;
    page.drawText("Katz Coffee · Service Department", { x: MARGIN, y: 28, size, font: fonts.sans, color: C.muted });
    const pageText = `Page ${i + 1} of ${total}`;
    const pw = fonts.sans.widthOfTextAtSize(pageText, size);
    page.drawText(pageText, { x: PAGE_W - MARGIN - pw, y: 28, size, font: fonts.sans, color: C.muted });
    const middle = clip(pdfSafeText(`Install #${data.id}${data.customer ? ` · ${data.customer}` : ""}`, fonts.sans), fonts.sans, size, 250);
    const mw = fonts.sans.widthOfTextAtSize(middle, size);
    page.drawText(middle, { x: (PAGE_W - mw) / 2, y: 28, size, font: fonts.sans, color: C.muted });
  });
}

/**
 * The fonts the fields are written in, listed on the form itself: a PDF app that redraws a field as someone types (iPhone
 * Files, Acrobat, Chrome) looks for the field's font there.
 */
function addFieldFonts(L: Layout) {
  const { doc, fonts } = L;
  const list = [fonts.sans, fonts.bold, fonts.italic, fonts.mono];
  const fontDict = doc.context.obj(Object.fromEntries(list.map((f) => [f.name, f.ref])));
  const acroForm = doc.catalog.getOrCreateAcroForm();
  acroForm.dict.set(PDFName.of("DR"), doc.context.obj({ Font: fontDict }));
  acroForm.dict.set(PDFName.of("DA"), PDFString.of(`/${fonts.sans.name} 0 Tf 0 g`));
}

/* ------------------------------------------------------------------ drawing helpers */

type TextOpts = { x: number; y: number; size: number; font: PDFFont; color: Color; spacing: number };

/** Letter-spaced capitals, like the printed form's labels. */
function spaced(page: PDFPage, text: string, o: TextOpts) {
  page.pushOperators(setCharacterSpacing(o.spacing));
  page.drawText(text, { x: o.x, y: o.y, size: o.size, font: o.font, color: o.color });
  page.pushOperators(setCharacterSpacing(0));
}

function spacedWidth(text: string, font: PDFFont, size: number, spacing: number) {
  return font.widthOfTextAtSize(text, size) + spacing * Math.max(0, [...text].length - 1);
}

function spacedRight(page: PDFPage, text: string, o: Omit<TextOpts, "x"> & { right: number }) {
  spaced(page, text, { ...o, x: o.right - spacedWidth(text, o.font, o.size, o.spacing) });
}

/** Cut to `width`, with an ellipsis. */
function clip(text: string, font: PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let t = text;
  while (t && font.widthOfTextAtSize(`${t}…`, size) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** The largest size from `max` down to `min` at which the text fits on one line. */
function fitSize(text: string, font: PDFFont, width: number, max: number, min: number): number {
  let size = max;
  while (size > min && font.widthOfTextAtSize(text, size) > width) size -= 0.25;
  return size;
}

/** Lines the text takes in a box `width` wide, broken the way the PDF app breaks a multi-line field. */
export function wrappedLines(text: string, font: PDFFont, size: number, width: number): number {
  if (!text) return 0;
  let count = 0;
  for (const para of text.split("\n")) {
    let rest: string = para;
    for (;;) {
      count += 1;
      let cut: number = rest.length;
      while (cut > 0 && font.widthOfTextAtSize(rest.slice(0, cut), size) >= width) {
        const space: number = rest.slice(0, cut).search(/\s\S*$/);
        cut = space > 0 ? space : 0;
      }
      // A word too long for the box stays whole on its line, as the PDF app leaves it.
      if (cut <= 0) break;
      rest = rest.slice(cut).trim();
      if (!rest) break;
    }
  }
  return count;
}

/** One line's height in a multi-line field, as the PDF app draws it. */
function lineHeight(font: PDFFont, size: number) {
  return font.heightAtSize(size) * 1.2;
}

function label(page: PDFPage, L: Layout, text: string, x: number, y: number, color: Color = C.muted, size = 6.8) {
  spaced(page, text.toUpperCase(), { x, y, size, font: L.fonts.bold, color, spacing: 0.9 });
}

function roundRect(page: PDFPage, x: number, top: number, w: number, h: number, r: number, o: { color?: Color; border?: Color; borderWidth?: number }) {
  const path = `M ${r},0 H ${w - r} A ${r},${r} 0 0 1 ${w},${r} V ${h - r} A ${r},${r} 0 0 1 ${w - r},${h} H ${r} A ${r},${r} 0 0 1 0,${h - r} V ${r} A ${r},${r} 0 0 1 ${r},0 Z`;
  page.drawSvgPath(path, { x, y: top, color: o.color, borderColor: o.border, borderWidth: o.borderWidth });
}

/** A pill: the printed form's "Sales rep" tag and the roles in the dark bars. Returns its width. */
function pill(page: PDFPage, L: Layout, text: string, x: number, top: number, o: { fill?: Color; border: Color; color: Color; size?: number }) {
  const size = o.size ?? 6.5;
  const t = text.toUpperCase();
  const w = spacedWidth(t, L.fonts.bold, size, 0.6) + 12;
  const h = size + 5;
  roundRect(page, x, top, w, h, h / 2, { color: o.fill, border: o.border, borderWidth: 0.75 });
  spaced(page, t, { x: x + 6, y: top - h + 3.4, size, font: L.fonts.bold, color: o.color, spacing: 0.6 });
  return w;
}

/* ------------------------------------------------------------------ fields */

type FieldOpts = {
  /** Read out by screen readers and shown by some PDF apps when the field is tapped. */
  tip: string;
  value?: string;
  x: number;
  /** Bottom edge. */
  y: number;
  w: number;
  h: number;
  size?: number;
  font?: PDFFont;
  multiline?: boolean;
  align?: TextAlignment;
  /** Shrink the text (down to this size) so it shows in full on one line. */
  minSize?: number;
};

/**
 * The field's spoken name. Acrobat reads it from the field; pdf.js (Firefox) and others from the box on the page, so it
 * goes on both. A radio button's box gets its own choice added ("Account type: Update").
 */
function tip(field: PDFField, text: string, perWidget?: string[]) {
  field.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(text));
  field.acroField.getWidgets().forEach((w, i) => w.dict.set(PDFName.of("TU"), PDFHexString.fromText(perWidget?.[i] ? `${text}: ${perWidget[i]}` : text)));
}

/** A text field, drawn in its own font with its value already in it. */
function textField(L: Layout, name: string, o: FieldOpts) {
  const font = o.font ?? L.fonts.sans;
  const value = pdfSafeText(o.value, font, o.multiline);
  let size = o.size ?? 10;
  if (!o.multiline && o.minSize && value) size = fitSize(value, font, textWidth(o.w) - 1, size, o.minSize);
  const field = L.form.createTextField(name);
  // The size is part of the field's default look (set before it is drawn: pdf-lib needs a look to change one).
  field.acroField.setDefaultAppearance(`/${font.name} ${size} Tf 0 g`);
  if (o.multiline) field.enableMultiline();
  if (o.align !== undefined) field.setAlignment(o.align);
  if (value) field.setText(value);
  // The box is part of the page, and the field sits just inside it: a PDF app's own highlight and the typed text stay
  // clear of the line. Nothing of the field's own is drawn but its text.
  L.page.drawRectangle({ x: o.x, y: o.y, width: o.w, height: o.h, color: C.field, borderColor: C.fieldLine, borderWidth: FIELD_BORDER });
  field.addToPage(L.page, {
    x: o.x + INSET,
    y: o.y + 1,
    width: o.w - 2 * INSET,
    height: o.h - 2,
    font,
    textColor: C.ink,
    backgroundColor: undefined,
    borderColor: undefined,
    borderWidth: 0,
  });
  tip(field, o.tip);
  return field;
}

function checkBox(L: Layout, name: string, tipText: string, x: number, y: number, size = 10.5, checked = false) {
  const box = L.form.createCheckBox(name);
  box.addToPage(L.page, { x, y, width: size, height: size, textColor: C.ink, backgroundColor: C.white, borderColor: C.ink, borderWidth: 1 });
  if (checked) box.check();
  tip(box, tipText);
  return box;
}

type ShapeOpts = Omit<FieldOpts, "y" | "tip"> & {
  /** Too long for one line even at `minSize`: take as many lines as it needs instead of being cut off. */
  wrap?: boolean;
};

/** How big a field is drawn: one line (shrunk to fit), or as many lines as its text takes. Never cuts a value off. */
function shapeField(L: Layout, o: ShapeOpts): { multiline: boolean; size: number; h: number } {
  const font = o.font ?? L.fonts.sans;
  const base = o.size ?? 10;
  if (o.multiline) {
    const lines = wrappedLines(pdfSafeText(o.value, font, true), font, base, textWidth(o.w));
    return { multiline: true, size: base, h: Math.max(o.h, 6 + lines * lineHeight(font, base)) };
  }
  const value = pdfSafeText(o.value, font);
  if (!o.wrap || !value || font.widthOfTextAtSize(value, o.minSize ?? base) <= textWidth(o.w) - 1) return { multiline: false, size: base, h: o.h };
  const size = Math.min(base, 9.5);
  const lines = Math.max(2, wrappedLines(value, font, size, textWidth(o.w)));
  return { multiline: true, size, h: Math.max(o.h, 6 + lines * lineHeight(font, size)) };
}

/** Label above a field: the printed form's field look. Returns the height used. */
function labeledField(L: Layout, name: string, text: string, top: number, o: ShapeOpts & { tip?: string }) {
  label(L.page, L, text, o.x, top - 7);
  const shape = shapeField(L, o);
  textField(L, name, { ...o, ...shape, tip: o.tip ?? text, y: top - 10 - shape.h });
  return 10 + shape.h;
}

/** Fields side by side with their labels on the left (Verified by, Date; Corrigo work order #). */
function inlineFields(L: Layout, items: { label: string; name: string; value: string; width: number | "rest" }[]) {
  const h = 16;
  const top = L.y - 6;
  let x = MARGIN + 8;
  for (const item of items) {
    const text = item.label.toUpperCase();
    label(L.page, L, text, x, top - 11);
    x += spacedWidth(text, L.fonts.bold, 6.8, 0.9) + 8;
    // "rest": out to the right edge, for a list that can run long (every Corrigo WO on the install).
    const w = item.width === "rest" ? MARGIN + CONTENT_W - 8 - x : item.width;
    textField(L, item.name, { tip: item.label, value: item.value, x, y: top - h, w, h, size: 9.5, minSize: 6 });
    x += w + 22;
  }
  L.y = top - h - 4;
}

/** The Tech notes box at the end of a section: an empty multi-line field across the page. */
function techNotes(L: Layout, key: keyof typeof TECH_NOTE_FIELDS, section: string, kind: BandKind) {
  const h = NOTES_H;
  ensure(L, NOTES_BLOCK, kind);
  const top = L.y - 4;
  const page = L.page;
  label(page, L, "Tech notes", MARGIN, top - 7, C.bronze);
  const after = spacedWidth("TECH NOTES", L.fonts.bold, 6.8, 0.9);
  page.drawText(pdfSafeText(`· ${section}`, L.fonts.sans), { x: MARGIN + after + 5, y: top - 7, size: 7, font: L.fonts.sans, color: C.muted });
  textField(L, TECH_NOTE_FIELDS[key], {
    tip: `Tech notes: ${section}`,
    value: L.data.entries?.techNotes[key] ?? "",
    x: MARGIN,
    y: top - 10 - h,
    w: CONTENT_W,
    h,
    size: 9.5,
    multiline: true,
  });
  L.y = top - 10 - h - 12;
}

/* ------------------------------------------------------------------ sections */

function accountSection(L: Layout) {
  const { page, fonts, data } = L;
  const top = L.y;
  spaced(page, "ACCOUNT & INSTALL", { x: MARGIN, y: top - 9, size: 8, font: fonts.bold, color: C.ink, spacing: 1.3 });
  const tagW = spacedWidth("SALES REP", fonts.bold, 6.5, 0.6) + 12;
  pill(page, L, "Sales rep", PAGE_W - MARGIN - tagW, top - 1, { fill: C.tag, border: C.gold, color: C.bronze });
  const colW = (CONTENT_W - 22) / 2;
  const x1 = MARGIN;
  const x2 = MARGIN + colW + 22;
  let y = top - 18;
  const row = (left: (t: number) => number, right: (t: number) => number) => {
    const used = Math.max(left(y), right(y));
    y -= used + 8;
  };
  row(
    (t) => labeledField(L, "customer", "Customer", t, { value: data.customer, x: x1, w: colW, h: 19, size: 11, font: fonts.bold, minSize: 8, wrap: true }),
    (t) => labeledField(L, "install_date", "Install date", t, { value: data.installDate, x: x2, w: colW, h: 19, size: 11, font: fonts.bold, minSize: 8 }),
  );
  row(
    (t) => labeledField(L, "site_contact", "Site contact", t, { value: data.siteContact, x: x1, w: colW, h: 17, minSize: 7.5, wrap: true }),
    (t) => labeledField(L, "contact_phone", "Contact phone", t, { value: data.contactPhone, x: x2, w: colW, h: 17, minSize: 7.5, wrap: true }),
  );
  row(
    (t) => labeledField(L, "install_address", "Install address", t, { value: data.address, x: x1, w: colW, h: 29, size: 9.5, multiline: true }),
    (t) => labeledField(L, "account_rep", "Account rep", t, { value: data.accountRep, x: x2, w: colW, h: 17, minSize: 7.5, wrap: true }),
  );
  row(
    (t) => {
      label(page, L, "Account type", x1, t - 7);
      const group = L.form.createRadioGroup("account_type");
      let x = x1;
      for (const [option, text] of [
        ["New account", "New account"],
        ["Update", "Update"],
      ] as const) {
        group.addOptionToPage(option, page, { x, y: t - 24, width: 11, height: 11, textColor: C.ink, backgroundColor: C.white, borderColor: C.ink, borderWidth: 1 });
        page.drawText(text, { x: x + 16, y: t - 22.5, size: 10, font: fonts.sans, color: C.ink });
        x += 16 + fonts.sans.widthOfTextAtSize(text, 10) + 24;
      }
      group.select(data.accountType === "new" ? "New account" : "Update");
      tip(group, "Account type", ["New account", "Update"]);
      return 27;
    },
    (t) => labeledField(L, "technician", "Technician", t, { value: data.technician, x: x2, w: colW, h: 17, minSize: 7.5, wrap: true }),
  );
  L.y = y + 2;
  techNotes(L, "account", "Account & install", "continued");
}

const EQ = (() => {
  const pad = 8;
  const right = MARGIN + CONTENT_W - pad;
  const terms = 62;
  const qty = 28;
  const serial = 132;
  const gap = 8;
  const xNum = MARGIN + pad;
  const xEquip = xNum + 20 + gap;
  const xTerms = right - terms;
  const xQty = xTerms - gap - qty;
  const xSerial = xQty - gap - serial;
  return { pad, right, xNum, xEquip, wEquip: xSerial - gap - xEquip, xSerial, wSerial: serial, xQty, wQty: qty, xTerms, wTerms: terms };
})();

function equipmentHead(L: Layout, continued: boolean) {
  const { page, fonts, data } = L;
  const top = L.y;
  page.drawText(continued ? "Equipment to install, continued" : "Equipment to install", { x: MARGIN, y: top - 14, size: 15, font: fonts.display, color: C.ink });
  const units = data.rows.reduce((n, r) => n + r.qty, 0);
  const count = `${units} ${units === 1 ? "unit" : "units"} · write in any extras`.toUpperCase();
  spacedRight(page, count, { right: PAGE_W - MARGIN, y: top - 13, size: 6.8, font: fonts.bold, color: C.muted, spacing: 1 });
  const barTop = top - 22;
  page.drawRectangle({ x: MARGIN, y: barTop - 15, width: CONTENT_W, height: 15, color: C.band });
  const y = barTop - 10.5;
  const bar = (text: string, x: number) => spaced(page, text, { x, y, size: 6.8, font: fonts.bold, color: C.goldLight, spacing: 1 });
  bar("NO.", EQ.xNum);
  bar("EQUIPMENT", EQ.xEquip);
  bar("SERIAL", EQ.xSerial);
  bar("QTY", EQ.xQty + EQ.wQty / 2 - spacedWidth("QTY", fonts.bold, 6.8, 1) / 2);
  bar("TERMS", EQ.xTerms);
  L.y = barTop - 15;
}

type EqRow = { num: number; row: FormRow | null };

/** The notes a machine prints with: the pre-inspection note, then its recipe, one per line. */
function rowNotes(row: FormRow | null): string {
  if (!row) return "";
  return row.notes.map((n) => [n.title, n.text].filter(Boolean).join(" — ")).join("\n");
}

function equipmentRowHeight(L: Layout, r: EqRow) {
  return equipmentRowParts(L, r).height;
}

function equipmentRowParts(L: Layout, { row }: EqRow) {
  const { fonts } = L;
  const units = row ? Math.max(1, row.qty, row.serials.length) : 1;
  const serialLines = units;
  const line1 = serialLines > 1 ? 4 + serialLines * lineHeight(fonts.mono, 9) + 2 : 16;
  const outletLabelW = spacedWidth("OUTLET", fonts.bold, 6.5, 0.9) + 6;
  const notesLabelW = spacedWidth("NOTES", fonts.bold, 6.5, 0.9) + 6;
  const xOutlet = EQ.xEquip + outletLabelW;
  const wOutlet = 132;
  const xNotesLabel = xOutlet + wOutlet + 12;
  const xNotes = xNotesLabel + notesLabelW;
  const wNotes = EQ.right - xNotes;
  const notes = pdfSafeText(rowNotes(row), fonts.sans, true);
  const lines = Math.max(1, wrappedLines(notes, fonts.sans, 8.5, textWidth(wNotes)));
  const notesH = lines > 1 ? 6 + lines * lineHeight(fonts.sans, 8.5) : 15;
  // Two outlets on one row ("208/240V · 30A · L6-30P / 120V · 5-15P") take two lines rather than being cut off.
  const outlet = pdfSafeText(row?.outlet, fonts.sans);
  const outletWraps = !!outlet && fonts.sans.widthOfTextAtSize(outlet, 6.5) > textWidth(wOutlet) - 1;
  const outletH = outletWraps ? 6 + Math.max(2, wrappedLines(outlet, fonts.sans, 8, textWidth(wOutlet))) * lineHeight(fonts.sans, 8) : 15;
  const line2 = Math.max(notesH, outletH);
  return { units, line1, line2, notesH, outletH, outletWraps, xOutlet, wOutlet, xNotesLabel, xNotes, wNotes, notes, height: 6 + line1 + 5 + line2 + 6 };
}

function equipmentRow(L: Layout, r: EqRow) {
  const { page, fonts } = L;
  const p = equipmentRowParts(L, r);
  const top = L.y;
  const bottom = top - p.height;
  page.drawRectangle({ x: MARGIN, y: bottom, width: CONTENT_W, height: p.height, borderColor: C.line, borderWidth: 0.75 });
  const row = r.row;
  const n = String(r.num).padStart(2, "0");
  const t1 = top - 6;
  page.drawText(n, { x: EQ.xNum, y: t1 - 12, size: 11, font: fonts.display, color: C.bronze });
  const what = row ? `Equipment ${r.num}` : `Extra equipment ${r.num}`;
  textField(L, `eq_${r.num}_equipment`, { tip: `${what}: model`, value: row?.equipment, x: EQ.xEquip, y: t1 - 16, w: EQ.wEquip, h: 16, size: 9, font: fonts.bold, minSize: 6.5 });
  const short = !!row && row.serials.some((s) => s.length < SHORT_SERIAL);
  const verifyW = short ? spacedWidth("VERIFY", fonts.bold, 6, 0.6) + 5 : 0;
  const serials = row ? [...row.serials, ...Array.from({ length: Math.max(0, p.units - row.serials.length) }, () => "")] : [""];
  textField(L, `eq_${r.num}_serial`, {
    tip: `${what}: serial${p.units > 1 ? "s, one per line" : ""}`,
    value: serials.join("\n").replace(/\n+$/, ""),
    x: EQ.xSerial,
    y: t1 - p.line1,
    w: EQ.wSerial - verifyW,
    h: p.line1,
    size: 9,
    font: fonts.mono,
    multiline: p.units > 1,
    minSize: 6.5,
  });
  if (short) spaced(page, "VERIFY", { x: EQ.xSerial + EQ.wSerial - verifyW + 4, y: t1 - 11, size: 6, font: fonts.bold, color: C.bronze, spacing: 0.6 });
  textField(L, `eq_${r.num}_qty`, { tip: `${what}: quantity`, value: row ? String(row.qty) : "", x: EQ.xQty, y: t1 - 16, w: EQ.wQty, h: 16, size: 10, font: fonts.bold, align: TextAlignment.Center });
  textField(L, `eq_${r.num}_terms`, { tip: `${what}: terms (Sold, Loan or Lease)`, value: row?.terms, x: EQ.xTerms, y: t1 - 16, w: EQ.wTerms, h: 16, size: 9.5, minSize: 7 });
  const t2 = t1 - p.line1 - 5;
  label(page, L, "Outlet", EQ.xEquip, t2 - 10.5, C.muted, 6.5);
  textField(L, `eq_${r.num}_outlet`, {
    tip: `${what}: outlet (voltage, amps, plug)`,
    value: row?.outlet,
    x: p.xOutlet,
    y: t2 - p.outletH,
    w: p.wOutlet,
    h: p.outletH,
    size: p.outletWraps ? 8 : 8.5,
    multiline: p.outletWraps,
    minSize: 6.5,
  });
  label(page, L, "Notes", p.xNotesLabel, t2 - 10.5, C.muted, 6.5);
  textField(L, `eq_${r.num}_notes`, { tip: `${what}: notes`, value: p.notes, x: p.xNotes, y: t2 - p.notesH, w: p.wNotes, h: p.notesH, size: 8.5, multiline: true });
  L.y = bottom;
}

function equipmentSection(L: Layout) {
  const machines: EqRow[] = L.data.rows.map((row, i) => ({ num: i + 1, row }));
  const blankH = equipmentRowHeight(L, { num: 0, row: null });
  const machinesH = machines.reduce((n, r) => n + equipmentRowHeight(L, r), 0);
  const fixed = 6 + EQ_HEAD + 8 + NOTES_BLOCK;
  const room = L.y - BOTTOM;
  // As on the printed form, blank write-in rows drop first, so the machines and their Tech notes stay on this page.
  let blanks = BLANK_ROWS;
  while (blanks > 0 && fixed + machinesH + blanks * blankH > room && fixed + machinesH <= room) blanks -= 1;
  const rows: EqRow[] = [...machines, ...Array.from({ length: blanks }, (_, i) => ({ num: machines.length + i + 1, row: null }))];
  L.y -= 6;
  // The heading never sits alone at the foot of a page: it moves over with its first row.
  ensure(L, EQ_HEAD + equipmentRowHeight(L, rows[0]!), "continued");
  equipmentHead(L, false);
  for (const r of rows) {
    if (ensure(L, equipmentRowHeight(L, r), "continued")) equipmentHead(L, true);
    equipmentRow(L, r);
  }
  L.y -= 8;
  techNotes(L, "equipment", "Equipment to install", "continued");
}

type CheckSpec = { key: "pre" | "tasks" | "corrigo"; title: string; role: string; rows: CheckNote[]; after?: (l: Layout) => void };

const CK = (() => {
  const pad = 8;
  const right = MARGIN + CONTENT_W - pad;
  const done = 40;
  const notes = 180;
  const xDone = right - done;
  const xNotes = xDone - 10 - notes;
  return { pad, xLabel: MARGIN + pad, xNotes, wNotes: notes, xDone, wDone: done, rowH: 19, barH: 18 };
})();

function checkBar(L: Layout, spec: CheckSpec, continued: boolean) {
  const { page, fonts } = L;
  const top = L.y;
  page.drawRectangle({ x: MARGIN, y: top - CK.barH, width: CONTENT_W, height: CK.barH, color: C.band });
  const title = continued ? `${spec.title}, continued` : spec.title;
  page.drawText(title, { x: CK.xLabel, y: top - 12.8, size: 11, font: fonts.display, color: C.goldLight });
  pill(page, L, spec.role, CK.xLabel + fonts.display.widthOfTextAtSize(title, 11) + 9, top - 3.8, { border: C.goldLight, color: C.goldLight, size: 6.2 });
  spaced(page, "NOTES", { x: CK.xNotes, y: top - 12, size: 6.8, font: fonts.bold, color: C.goldLight, spacing: 1 });
  const dw = spacedWidth("DONE", fonts.bold, 6.8, 1);
  spaced(page, "DONE", { x: CK.xDone + CK.wDone / 2 - dw / 2, y: top - 12, size: 6.8, font: fonts.bold, color: C.goldLight, spacing: 1 });
  L.y = top - CK.barH;
}

/** A checklist value as words: YES prints as Yes. A name or anything else stays as it is. */
function checkValue(value: string): string {
  if (value === "YES") return "Yes";
  if (value === "NO") return "No";
  if (value === "PENDING") return "Pending";
  return value;
}

function checkSection(L: Layout, spec: CheckSpec) {
  const kind: BandKind = "checklist-continued";
  keepTogether(L, 4 + CK.barH + spec.rows.length * CK.rowH + (spec.after ? AFTER_H : 0) + NOTES_BLOCK, kind);
  L.y -= 4;
  ensure(L, CK.barH + CK.rowH, kind);
  checkBar(L, spec, false);
  spec.rows.forEach((row, i) => {
    if (ensure(L, CK.rowH, kind)) checkBar(L, spec, true);
    const { page, fonts } = L;
    const top = L.y;
    const bottom = top - CK.rowH;
    page.drawRectangle({ x: MARGIN, y: bottom, width: CONTENT_W, height: CK.rowH, borderColor: C.line, borderWidth: 0.75 });
    const text = clip(pdfSafeText(row.label, fonts.sans), fonts.sans, 8.8, CK.xNotes - CK.xLabel - 10);
    page.drawText(text, { x: CK.xLabel, y: bottom + 6.2, size: 8.8, font: fonts.sans, color: C.ink });
    const n = i + 1;
    const key = entryKey(spec.key, row.label);
    const note = L.data.entries?.notes[key] ?? checkValue(row.notes);
    textField(L, `${spec.key}_${n}_notes`, { tip: `${row.label}: notes`, value: note, x: CK.xNotes, y: bottom + 3, w: CK.wNotes, h: 13, size: 8.5, minSize: 6 });
    checkBox(L, `${spec.key}_${n}_done`, `${row.label}: done`, CK.xDone + CK.wDone / 2 - 5.25, bottom + 4.25, 10.5, !!L.data.entries?.done[key]);
    L.y = bottom;
  });
  if (spec.after) {
    ensure(L, AFTER_H, kind);
    spec.after(L);
  }
  techNotes(L, spec.key, spec.title, kind);
}

function signOff(L: Layout) {
  const kind: BandKind = "checklist-continued";
  const cellH = 118;
  const barH = 18;
  keepTogether(L, 4 + barH + cellH + 8 + NOTES_BLOCK, kind);
  L.y -= 4;
  ensure(L, barH + cellH, kind);
  const { page, fonts, data } = L;
  const entries = data.entries;
  const top = L.y;
  page.drawRectangle({ x: MARGIN, y: top - barH, width: CONTENT_W, height: barH, color: C.band });
  page.drawText("Sign-off", { x: MARGIN + 10, y: top - 13, size: 11.5, font: fonts.display, color: C.goldLight });
  spacedRight(page, "TYPE YOUR NAME TO SIGN", { right: PAGE_W - MARGIN - 10, y: top - 12, size: 6.5, font: fonts.bold, color: C.goldLight, spacing: 1 });
  const bodyTop = top - barH;
  page.drawRectangle({ x: MARGIN, y: bodyTop - cellH, width: CONTENT_W, height: cellH + barH, borderColor: C.band, borderWidth: 1.2 });
  const half = CONTENT_W / 2;
  page.drawLine({ start: { x: MARGIN + half, y: bodyTop }, end: { x: MARGIN + half, y: bodyTop - cellH }, thickness: 0.75, color: C.line });
  const cell = (x: number, heading: string, fields: { name: string; label: string; value: string; signature?: boolean; tip: string }[]) => {
    const w = half - 24;
    label(page, L, heading, x, bodyTop - 14, C.muted);
    let t = bodyTop - 20;
    for (const f of fields) {
      const h = f.signature ? 20 : 16;
      label(page, L, f.label, x, t - 7, C.soft, 6);
      textField(L, f.name, {
        tip: f.tip,
        value: f.value,
        x,
        y: t - 10 - h,
        w,
        h,
        size: f.signature ? 13 : 10,
        font: f.signature ? fonts.italic : f.name.endsWith("_name") ? fonts.bold : fonts.sans,
        minSize: 7,
      });
      t -= 10 + h + 4;
    }
  };
  cell(MARGIN + 12, "Technician · Complete & sign", [
    { name: "tech_name", label: "Name", value: entries?.techName ?? data.technician, tip: "Technician name" },
    {
      name: "tech_signature",
      label: "Signature (type your name)",
      value: entries?.signed ? stampText(entries.signed) : "",
      signature: true,
      tip: "Technician signature: type your name",
    },
    { name: "date_completed", label: "Date completed", value: formDate(entries?.completedOn) || data.completedOn, tip: "Date completed" },
  ]);
  cell(MARGIN + half + 12, "Final approval · Owner", [
    { name: "owner_name", label: "Name", value: "Chuy", tip: "Owner name" },
    {
      name: "owner_signature",
      label: "Signature (type your name)",
      value: entries?.approved ? stampText(entries.approved) : "",
      signature: true,
      tip: "Owner approval: type your name",
    },
    { name: "date_approved", label: "Date approved", value: formDate(entries?.approvedOn), tip: "Date approved" },
  ]);
  L.y = bodyTop - cellH - 8;
  techNotes(L, "signoff", "Sign-off", kind);
}
