/**
 * Writes a report as a PDF or a Word file. A report is three lines of text and two tables, so both files are
 * written directly: no library, and nothing the report does not already hold. Excel is written from the same
 * report by the caller (reportSheets), so the three files cannot drift apart.
 * Pure: no DOM, no node imports, safe for node --test.
 */
import type { AnalyticsReport, ReportTable } from "./analytics.ts";

const utf8 = new TextEncoder();

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- zip

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Raw DEFLATE, when the caller has one (the server passes node's). Without it every file is stored as is. */
export type Deflate = (data: Uint8Array) => Uint8Array;

/** A zip file. A Word file is a zip of a few small XML parts. */
export function zipStore(files: { name: string; data: Uint8Array }[], deflate?: Deflate): Uint8Array {
  const body: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = utf8.encode(f.name);
    const crc = crc32(f.data);
    const squeezed = deflate ? deflate(f.data) : null;
    const packed = squeezed && squeezed.length < f.data.length ? squeezed : f.data;
    const method = packed === f.data ? 0 : 8;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // names are UTF-8
    local.setUint16(8, method, true);
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x0021, true); // 1980-01-01, so the same report always makes the same file
    local.setUint32(14, crc, true);
    local.setUint32(18, packed.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    body.push(new Uint8Array(local.buffer), name, packed);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, method, true);
    dir.setUint16(12, 0, true);
    dir.setUint16(14, 0x0021, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, packed.length, true);
    dir.setUint32(24, f.data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + packed.length;
  }
  const dirSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  return concat([...body, ...central, new Uint8Array(end.buffer)]);
}

// ---------------------------------------------------------------------------------------------- Word

function xml(v: string): string {
  return v
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FONT = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>';

function run(text: string, halfPoints: number, bold = false): string {
  return `<w:r><w:rPr>${FONT}${bold ? "<w:b/>" : ""}<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function para(text: string, halfPoints: number, bold = false, after = 60): string {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="${after}"/></w:pPr>${text ? run(text, halfPoints, bold) : ""}</w:p>`;
}

/** Ten inches of table on a landscape letter page with half-inch margins. */
const TABLE_TWIPS = 14400;

function gridWidths(weights: number[], total: number): number[] {
  const sum = weights.reduce((n, w) => n + w, 0) || 1;
  const out = weights.map((w) => Math.floor((w / sum) * total));
  out[out.length - 1]! += total - out.reduce((n, w) => n + w, 0);
  return out;
}

function wordTable(t: ReportTable): string {
  const widths = gridWidths(t.weights.length === t.columns.length ? t.weights : t.columns.map(() => 1), TABLE_TWIPS);
  const edge = (side: string) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="A8A29A"/>`;
  const cell = (text: string, i: number, head: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E8E1D3"/>' : ""}</w:tcPr>${para(text, 16, head, 0)}</w:tc>`;
  const row = (cells: string[], head: boolean) =>
    `<w:tr>${head ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${t.columns.map((_, i) => cell(cells[i] ?? "", i, head)).join("")}</w:tr>`;
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${TABLE_TWIPS}" w:type="dxa"/>` +
    `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(edge).join("")}</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>` +
    row(t.columns, true) +
    t.rows.map((r) => row(r, false)).join("") +
    `</w:tbl>`
  );
}

/** The report as a Word (.docx) file: the same lines and the same two tables as the PDF and the Excel file. */
export function reportDocx(report: AnalyticsReport, deflate?: Deflate): Uint8Array {
  const body =
    para(report.title, 32, true, 80) +
    para(report.generated, 18) +
    para(report.scope, 18, false, 200) +
    para(report.summary.title, 24, true, 80) +
    wordTable(report.summary) +
    para("", 18, false, 200) +
    para(report.records.title, 24, true, 80) +
    wordTable(report.records) +
    para("", 18);
  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}` +
    `<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>` +
    `<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>` +
    `</w:body></w:document>`;
  const types =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;
  return zipStore(
    [
      { name: "[Content_Types].xml", data: utf8.encode(types) },
      { name: "_rels/.rels", data: utf8.encode(rels) },
      { name: "word/document.xml", data: utf8.encode(document) },
    ],
    deflate,
  );
}

// ---------------------------------------------------------------------------------------------- PDF

const PAGE_W = 792;
const PAGE_H = 612;
const MARGIN = 36;
const FOOT = 30;

// Helvetica advance widths for characters 32 to 126, in thousandths of the font size.
// prettier-ignore
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  334, 260, 334, 584,
];

// Characters outside Latin-1 that the standard PDF encoding (WinAnsi) still has.
const WIN_ANSI: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/** One byte per character, as the PDF's built-in fonts read them. Anything they cannot draw becomes "?". */
function winAnsi(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code === 9 || code === 10 || code === 13) out.push(32);
    else if (code >= 32 && code <= 126) out.push(code);
    else if (code >= 160 && code <= 255) out.push(code);
    else if (WIN_ANSI[code] != null) out.push(WIN_ANSI[code]!);
    else if (code > 126) out.push(63);
  }
  return out;
}

function widthOf(bytes: number[], size: number, bold: boolean): number {
  let w = 0;
  for (const b of bytes) w += b >= 32 && b <= 126 ? HELVETICA[b - 32]! : 556;
  // The bold face runs a little wider than the regular one these widths describe.
  return (w / 1000) * size * (bold ? 1.08 : 1);
}

function literal(bytes: number[]): string {
  let s = "(";
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += `\\${String.fromCharCode(b)}`;
    else if (b < 32 || b > 126) s += `\\${b.toString(8).padStart(3, "0")}`;
    else s += String.fromCharCode(b);
  }
  return `${s})`;
}

/** Break text into lines no wider than the cell. A word longer than the cell is split, never cut off. */
function wrap(text: string, max: number, size: number, bold: boolean): number[][] {
  const lines: number[][] = [];
  let line: number[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = winAnsi(word);
    const withSpace = line.length ? [...line, 32, ...w] : w;
    if (widthOf(withSpace, size, bold) <= max) {
      line = withSpace;
      continue;
    }
    if (line.length) lines.push(line);
    line = [];
    while (widthOf(w, size, bold) > max && w.length > 1) {
      let n = 1;
      while (n < w.length && widthOf(w.slice(0, n + 1), size, bold) <= max) n++;
      lines.push(w.slice(0, n));
      w = w.slice(n);
    }
    line = w;
  }
  if (line.length) lines.push(line);
  return lines.length ? lines : [[]];
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();

/** The report as a PDF: landscape letter pages, the header row repeated on each, long cells wrapped in full. */
export function reportPdf(report: AnalyticsReport): Uint8Array {
  const pages: string[][] = [[]];
  let y = PAGE_H - MARGIN;
  const ops = () => pages[pages.length - 1]!;
  const newPage = () => {
    pages.push([]);
    y = PAGE_H - MARGIN;
  };
  const text = (x: number, at: number, bytes: number[], size: number, bold = false) => {
    if (bytes.length) ops().push(`BT /${bold ? "F2" : "F1"} ${num(size)} Tf ${num(x)} ${num(at)} Td ${literal(bytes)} Tj ET`);
  };
  const line = (s: string, size: number, bold: boolean, gap: number) => {
    for (const l of wrap(s, PAGE_W - 2 * MARGIN, size, bold)) {
      if (y - size < MARGIN + FOOT) newPage();
      y -= size;
      text(MARGIN, y, l, size, bold);
      y -= gap;
    }
  };

  line(report.title, 15, true, 5);
  line(report.generated, 9, false, 3);
  line(report.scope, 9, false, 3);

  const SIZE = 8;
  const LEAD = 9.6;
  const PAD = 3;
  const table = (t: ReportTable) => {
    const usable = PAGE_W - 2 * MARGIN;
    const weights = t.weights.length === t.columns.length ? t.weights : t.columns.map(() => 1);
    const sum = weights.reduce((n, w) => n + w, 0) || 1;
    const widths = weights.map((w) => (w / sum) * usable);
    const xs = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((n, w) => n + w, 0));

    const drawRow = (cells: string[], head: boolean) => {
      const wrapped = t.columns.map((_, i) => wrap(cells[i] ?? "", widths[i]! - 2 * PAD, SIZE, head));
      const height = Math.max(...wrapped.map((w) => w.length)) * LEAD + 2 * PAD;
      if (head) ops().push(`0.91 0.88 0.83 rg ${num(MARGIN)} ${num(y - height)} ${num(usable)} ${num(height)} re f 0 g`);
      wrapped.forEach((lines, i) => lines.forEach((l, n) => text(xs[i]! + PAD, y - PAD - SIZE + 1 - n * LEAD, l, SIZE, head)));
      y -= height;
      ops().push(`0.75 G 0.4 w ${num(MARGIN)} ${num(y)} m ${num(MARGIN + usable)} ${num(y)} l S 0 G`);
      return height;
    };
    const rowHeight = (cells: string[], head: boolean) =>
      Math.max(...t.columns.map((_, i) => wrap(cells[i] ?? "", widths[i]! - 2 * PAD, SIZE, head).length)) * LEAD + 2 * PAD;

    // The heading stays with its header row and at least one line of the table.
    if (y - (16 + rowHeight(t.columns, true) + LEAD + 2 * PAD) < MARGIN + FOOT) newPage();
    y -= 16;
    text(MARGIN, y, winAnsi(t.title), 11, true);
    y -= 6;
    drawRow(t.columns, true);
    for (const r of t.rows) {
      if (y - rowHeight(r, false) < MARGIN + FOOT) {
        newPage();
        drawRow(t.columns, true);
      }
      drawRow(r, false);
    }
    if (!t.rows.length) {
      y -= LEAD + PAD;
      text(MARGIN + PAD, y, winAnsi("No records."), SIZE);
    }
    y -= 8;
  };
  table(report.summary);
  table(report.records);

  pages.forEach((p, i) => {
    const foot = winAnsi(`${report.title} · Page ${i + 1} of ${pages.length}`);
    p.push(`0.45 g BT /F1 7.5 Tf ${num(MARGIN)} ${num(MARGIN - 14)} Td ${literal(foot)} Tj ET 0 g`);
  });

  // Objects 1 to 4 are the catalog, the page list and the two fonts; each page then takes two (page, content).
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  pages.forEach((p, i) => {
    const stream = p.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });
  const info = objects.length + 1;
  objects.push(`<< /Title ${literal(winAnsi(report.title))} /Producer (Katz Desk) >>`);

  // Every character written here is one byte, so string offsets are file offsets.
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
