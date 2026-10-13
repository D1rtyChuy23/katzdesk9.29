import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  ANALYTICS_COLUMNS,
  DETAIL_MAX,
  NO_REP,
  buildReport,
  filterRows,
  monthCounts,
  repCounts,
  reportFileName,
  reportSheets,
  scopeLine,
  sortRows,
  summarize,
} from "../src/lib/ops/analytics.ts";
import { crc32, reportDocx, reportPdf, zipStore } from "../src/lib/ops/report-files.ts";

const row = (type, id, account, date, status, rep, extra = {}) => ({ type, id, account, accountNumber: "", date, status, rep, tech: "", ref: "", detail: "", ...extra });

const ROWS = [
  row("service", 1, "Coco Crepes", "2026-09-30", "Completed", "Dana", { tech: "Luis", ref: "WO-1182", detail: "Grinder (burrs) & hopper <jammed>" }),
  row("installs", 2, "Blue Door Café", "2026-10-05", "Ready", "Avi", { accountNumber: "10442", detail: "La Marzocco Linea PB · BUNN G9-2T HD" }),
  row("pms", 3, "Coco Crepes", "2026-10-01", "Scheduled", "Dana", { tech: "Luis" }),
  row("tlc", 4, "Night Owl", "2026-08-15", "Open", "", { detail: "TLC + Factor visit" }),
  row("rebuilds", 5, "Katz shop / stock", "2026-10-09", "In progress", "", { tech: "Marco", ref: "Rebuild 5", detail: "Linea PB rebuild" }),
  row("service", 6, "Night Owl", "2026-10-11", "Open", "Avi", { detail: "x".repeat(400) }),
];

test("the record columns include account, date, status and rep", () => {
  for (const c of ["Account", "Date", "Status", "Rep"]) assert.ok(ANALYTICS_COLUMNS.includes(c), c);
  assert.equal(ANALYTICS_COLUMNS[0], "Type");
});

test("filters: date range, type and rep", () => {
  assert.deepEqual(filterRows(ROWS, { from: "2026-10-01", to: "2026-10-31" }).map((r) => r.id), [2, 3, 5, 6]);
  assert.deepEqual(filterRows(ROWS, { types: ["service", "tlc"] }).map((r) => r.id), [1, 4, 6]);
  assert.deepEqual(filterRows(ROWS, { rep: "dana" }).map((r) => r.id), [1, 3]);
  assert.deepEqual(filterRows(ROWS, { rep: NO_REP }).map((r) => r.id), [4, 5]);
  assert.deepEqual(filterRows(ROWS, {}).length, 6);
  // The search box narrows the report too, so an export is what the page shows.
  assert.deepEqual(filterRows(ROWS, { q: "coco" }).map((r) => r.id), [1, 3]);
  assert.deepEqual(filterRows(ROWS, { q: "WO-1182" }).map((r) => r.id), [1]);
  assert.equal(scopeLine({ q: "coco" }, 2), 'All dates · Installs, Service, PMs, TLC, Rebuilds · All reps · Search "coco" · 2 records');
});

test("rows read installs, service, PMs, TLC, rebuilds; newest first inside each", () => {
  assert.deepEqual(sortRows(ROWS).map((r) => r.id), [2, 6, 1, 3, 4, 5]);
});

test("the summary lists all five types, even an empty one", () => {
  const s = summarize(filterRows(ROWS, { from: "2026-10-01" }));
  assert.deepEqual(s.map((x) => [x.label, x.total]), [["Installs", 1], ["Service", 1], ["PMs", 1], ["TLC", 0], ["Rebuilds", 1]]);
  assert.deepEqual(summarize(ROWS).find((x) => x.type === "service").statuses, [{ status: "Completed", count: 1 }, { status: "Open", count: 1 }]);
  assert.deepEqual(repCounts(ROWS), [{ rep: "Avi", count: 2 }, { rep: "Dana", count: 2 }, { rep: "No rep", count: 2 }]);
});

test("records per month, with the quiet month between still shown", () => {
  const m = monthCounts(ROWS);
  assert.deepEqual(m.map((x) => [x.label, x.total]), [["Aug 2026", 1], ["Sep 2026", 1], ["Oct 2026", 4]]);
  assert.equal(m[2].service, 1);
  assert.equal(m[2].installs, 1);
  assert.deepEqual(monthCounts([]), []);
});

test("the scope line says what the report covers", () => {
  assert.equal(scopeLine({ from: "2026-10-01", to: "2026-10-31", types: ["installs"], rep: "Avi" }, 1), "Oct 1, 2026 to Oct 31, 2026 · Installs · Avi · 1 record");
  assert.equal(scopeLine({}, 6), "All dates · Installs, Service, PMs, TLC, Rebuilds · All reps · 6 records");
  assert.equal(reportFileName("2026-10-12", "docx"), "KatzDesk-Analytics-2026-10-12.docx");
});

const report = buildReport(ROWS, {}, "Oct 12, 2026 9:00 AM");

test("a long description is cut the same for every format", () => {
  const cell = report.records.rows.find((r) => r[1] === "Night Owl" && r[0] === "Service")[8];
  assert.equal(cell.length, DETAIL_MAX);
  assert.ok(cell.endsWith("…"));
});

// ---- the three files hold the same data --------------------------------------------------------------------

const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50, "end of central directory");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014b50, "central directory entry");
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
    assert.equal(view.getUint32(local, true), 0x04034b50, "local header");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    assert.equal(crc32(data), crc, `crc of ${name}`);
    files[name] = new TextDecoder().decode(data);
    at += 46 + nameLen;
  }
  return files;
}

function docxTables(bytes) {
  const doc = unzip(bytes)["word/document.xml"];
  assert.ok(doc, "word/document.xml");
  const texts = (chunk) => [...chunk.matchAll(/<w:t [^>]*>([^<]*)<\/w:t>/g)].map((m) => unxml(m[1])).join("");
  const tables = [...doc.matchAll(/<w:tbl>(.*?)<\/w:tbl>/gs)].map((t) =>
    [...t[1].matchAll(/<w:tr>(.*?)<\/w:tr>/gs)].map((r) => [...r[1].matchAll(/<w:tc>(.*?)<\/w:tc>/gs)].map((c) => texts(c[1]))),
  );
  const outside = doc.replace(/<w:tbl>.*?<\/w:tbl>/gs, "");
  return { tables, lines: [...outside.matchAll(/<w:p>(.*?)<\/w:p>/gs)].map((p) => texts(p[1])).filter(Boolean) };
}

function pdfText(bytes) {
  const raw = Buffer.from(bytes).toString("latin1");
  const out = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\()])*)\) Tj/g)) {
    out.push(m[1].replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\(.)/g, "$1"));
  }
  return out;
}

test("Word: the same lines and the same two tables as the report", () => {
  const { tables, lines } = docxTables(reportDocx(report));
  assert.deepEqual(lines, [report.title, report.generated, report.scope, "Summary", "Records"]);
  assert.equal(tables.length, 2);
  assert.deepEqual(tables[0], [report.summary.columns, ...report.summary.rows]);
  assert.deepEqual(tables[1], [report.records.columns, ...report.records.rows]);
});

test("Excel: the same lines and the same two tables as the report", () => {
  const wb = XLSX.utils.book_new();
  for (const s of reportSheets(report)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.aoa), s.name);
  const back = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  assert.deepEqual(back.SheetNames, ["Summary", "Records"]);
  const aoa = (name) => XLSX.utils.sheet_to_json(back.Sheets[name], { header: 1, defval: "", raw: false });
  const records = aoa("Records");
  assert.deepEqual(records.slice(0, 3).map((r) => r[0]), [report.title, report.generated, report.scope]);
  assert.deepEqual(records.slice(4), [report.records.columns, ...report.records.rows]);
  assert.deepEqual(aoa("Summary").slice(4).map((r) => r.slice(0, 3)), [report.summary.columns, ...report.summary.rows]);
});

test("PDF: a well-formed file holding every line and every cell", () => {
  const bytes = reportPdf(report);
  const raw = Buffer.from(bytes).toString("latin1");
  assert.ok(raw.startsWith("%PDF-1.4"));
  assert.ok(raw.trimEnd().endsWith("%%EOF"));
  // Every cross-reference offset points at the object it names.
  const xrefAt = Number(/startxref\n(\d+)/.exec(raw)[1]);
  assert.ok(raw.startsWith("xref\n", xrefAt));
  const offsets = [...raw.slice(xrefAt).matchAll(/^(\d{10}) 00000 n /gm)].map((m) => Number(m[1]));
  assert.ok(offsets.length >= 7);
  offsets.forEach((o, i) => assert.ok(raw.startsWith(`${i + 1} 0 obj\n`, o), `object ${i + 1}`));
  // Stream lengths are exact.
  for (const m of raw.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = m.index + m[0].length;
    assert.equal(raw.slice(start + Number(m[1]), start + Number(m[1]) + 10), "\nendstream");
  }
  // Wrapped cells are split across lines, so compare with the spaces taken out. The PDF's fonts are Latin-1.
  const squash = (s) => s.replace(/\s+/g, "");
  const latin = (s) => s.replace(/…/g, "\x85");
  const all = squash(pdfText(bytes).join(" "));
  for (const line of [report.title, report.generated, report.scope]) assert.ok(all.includes(squash(latin(line))), line);
  for (const t of [report.summary, report.records]) {
    for (const cells of [t.columns, ...t.rows]) for (const c of cells) assert.ok(all.includes(squash(latin(c))), `missing: ${c}`);
  }
});

test("PDF: a long report runs onto more pages and repeats the header row", () => {
  const many = Array.from({ length: 150 }, (_, i) => row("service", i + 1, `Account ${i + 1}`, "2026-10-01", "Open", "Dana", { detail: "Leaking group head" }));
  const big = buildReport(many, {}, "Oct 12, 2026 9:00 AM");
  const raw = Buffer.from(reportPdf(big)).toString("latin1");
  const pages = Number(/\/Count (\d+)/.exec(raw)[1]);
  assert.ok(pages > 3, `pages: ${pages}`);
  assert.ok(raw.includes(`Page ${pages} of ${pages}`));
  // The Records header row is drawn once per page it runs onto.
  assert.ok([...raw.matchAll(/\(Tech \/ Owner\) Tj/g)].length >= pages - 1);
  assert.ok(raw.includes("(Account 150) Tj"));
});

test("zip: stored entries with correct checksums", () => {
  const files = unzip(zipStore([{ name: "a.txt", data: new TextEncoder().encode("hello") }, { name: "dir/b.txt", data: new TextEncoder().encode("café") }]));
  assert.deepEqual(files, { "a.txt": "hello", "dir/b.txt": "café" });
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("zip: a compressed entry reads back the same (the server passes node's deflate)", async () => {
  const { deflateRawSync, inflateRawSync } = await import("node:zlib");
  const data = new TextEncoder().encode("<w:t>same</w:t>".repeat(400));
  const bytes = zipStore([{ name: "word/document.xml", data }], (d) => new Uint8Array(deflateRawSync(d)));
  assert.ok(bytes.length < data.length / 4);
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint16(8, true), 8, "deflate method");
  const packedSize = view.getUint32(18, true);
  const start = 30 + view.getUint16(26, true);
  assert.deepEqual(new Uint8Array(inflateRawSync(bytes.subarray(start, start + packedSize))), data);
  assert.equal(view.getUint32(14, true), crc32(data));
  // Word still gets the same document either way.
  const packed = reportDocx(report, (d) => new Uint8Array(deflateRawSync(d)));
  assert.ok(packed.length < reportDocx(report).length);
});
