import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import data from "../src/lib/ops/library-import-data.json" with { type: "json" };
import {
  alreadyStored,
  cameoHasReplacement,
  duplicateMarkedName,
  nameOnChip,
  pdfRejectReason,
  planDuplicateMark,
  planMpn,
  uploadDestinations,
  uploadSlice,
} from "../src/lib/ops/library-import-rules.ts";

if (process.env.DATABASE_URL?.trim()) {
  throw new Error("Refusing Library import tests: DATABASE_URL is set. These tests use an in-memory database only.");
}

const axiom = { id: 1, title: "BUNN AXIOM", manufacturer: "BUNN", mpn: null };
const axiomDv = { id: 4, title: "BUNN AXIOM-DV-APS", manufacturer: "BUNN", mpn: null };
const cwtf = { id: 39, title: "BUNN CWTF15-3 (3 Lower)", manufacturer: "BUNN", mpn: null };
const cbs1 = { id: 69, title: "FETCO CBS-1231 Plus", manufacturer: "FETCO", mpn: null };
const cbs2 = { id: 70, title: "FETCO CBS-1232 Plus", manufacturer: "FETCO", mpn: null };
const cameo = { id: 20, title: "Eversys Cameo", manufacturer: "Eversys", mpn: null };
const books = [axiom, axiomDv, cwtf, cbs1, cbs2, cameo];

test("the vendor list is the checked-in import file", () => {
  assert.deepEqual(data.markAsDuplicate, [27, 37, 50]);
  assert.equal(data.uploads.length, 386);
  assert.equal(data.mpns.length, 135);
  assert.equal(data.mpns.filter((row) => row.mpn).length, 57);
  assert.equal(data.mpns.filter((row) => !row.mpn && !row.productPage).length, 78);
});

test("duplicate marker is inserted before the extension and not twice", () => {
  assert.equal(duplicateMarkedName("Old Manual.pdf"), "Old Manual - Duplicate To Delete.pdf");
  assert.equal(duplicateMarkedName("Old Manual - Duplicate To Delete.pdf"), "Old Manual - Duplicate To Delete.pdf");
  assert.equal(duplicateMarkedName("NoExtension"), "NoExtension - Duplicate To Delete");
});

test("file 50 waits for a different Cameo file named with 5700105620", () => {
  const file50 = { id: 50, name: "Cameo service.pdf", bookId: 20 };
  assert.equal(cameoHasReplacement(books, [file50, { id: 50, name: "Cameo 5700105620.pdf", bookId: 20 }], 50), false);
  assert.equal(cameoHasReplacement(books, [file50, { id: 80, name: "Other 5700105620.pdf", bookId: 1 }], 50), false);
  assert.equal(cameoHasReplacement(books, [file50, { id: 80, name: "Cameo parts 5700105620.pdf", originalName: null, bookId: 20 }], 50), true);
  assert.equal(planDuplicateMark(50, file50, books, [file50]).action, "SKIP");
  assert.equal(planDuplicateMark(27, { id: 27, name: "Old.pdf", bookId: 1 }, books, []).action, "OK");
  assert.match(planDuplicateMark(27, { id: 27, name: "Old.pdf", bookId: 1 }, books, []).reason, /Old - Duplicate To Delete\.pdf/);
  assert.equal(planDuplicateMark(37, undefined, books, []).action, "FAIL");
});

test("manuals and parts go to the main chip; spec sheets stay on the target book", () => {
  const manual = uploadDestinations("41154.0000.pdf", [
    { bookId: 4, section: "manuals", docType: "Programming Manual", name: "BUNN AXIOM-DV-APS - Programming 41154.0000" },
  ], books);
  assert.equal(manual.length, 1);
  assert.equal(manual[0].kind, "store");
  assert.equal(manual[0].bookId, 1);
  assert.equal(manual[0].createMain, null);
  assert.equal(manual[0].name, "BUNN AXIOM - Programming 41154.0000.pdf");

  const parts = uploadDestinations("40566.0000.pdf", [
    { bookId: 39, section: "parts", docType: null, name: "BUNN CWTF15-3 (3 Lower) - Parts Catalog 40566.0000" },
  ], books);
  assert.equal(parts[0].createMain?.title, "BUNN CWTF15");
  assert.equal(parts[0].name, "BUNN CWTF15 - Parts Catalog 40566.0000.pdf");

  const spec = uploadDestinations("Sellsheet.pdf", [
    { bookId: 69, section: "spec", docType: null, name: "FETCO CBS-1231 Plus - Spec Sheet Rev6" },
    { bookId: 70, section: "spec", docType: null, name: "FETCO CBS-1232 Plus - Spec Sheet Rev6" },
  ], books);
  assert.deepEqual(spec.map((d) => d.bookId), [69, 70]);
  assert.ok(spec.every((d) => d.kind === "store" && d.createMain == null));

  const missing = uploadDestinations("gone.pdf", [{ bookId: 999, section: "manuals", docType: "User Manual", name: "Missing" }], books);
  assert.equal(missing[0].kind, "conflict");

  const split = uploadDestinations("54141.0000.pdf", [
    { bookId: 15, section: "manuals", docType: "Operating / Installation Manual", name: "BUNN ITB Dual Dilution - Installation and Operating 54141.0000" },
    { bookId: 13, section: "manuals", docType: "Operating / Installation Manual", name: "BUNN ITCB-DV - Installation and Operating 54141.0000" },
  ], [
    ...books,
    { id: 15, title: "BUNN ITB Dual Dilution", manufacturer: "BUNN", mpn: null },
    { id: 13, title: "BUNN ITCB-DV", manufacturer: "BUNN", mpn: null },
  ]);
  assert.deepEqual(split.map((d) => d.kind === "store" && d.createMain?.title), ["BUNN ITB", "BUNN ITCB"]);
});

test("a shared name keeps the chip title and the file extension", () => {
  assert.equal(
    nameOnChip("BUNN AXIOM", "BUNN AXIOM-DV-APS", "BUNN AXIOM-DV-APS - Programming 41154.0000", "41154.0000.pdf"),
    "BUNN AXIOM - Programming 41154.0000.pdf",
  );
});

test("already stored matches the source URL, or the same size and vendor name, inside the family", () => {
  const stored = [
    { id: 12, name: "BUNN AXIOM - Programming 41154.0000.pdf", originalName: "41154.0000.pdf", size: 100, section: "manuals", bookId: 4, sourceUrl: null },
    { id: 13, name: "Spec.pdf", originalName: "sheet.pdf", size: 50, section: "spec", bookId: 69, sourceUrl: "https://vendor.example/sheet.pdf" },
  ];
  assert.equal(alreadyStored("https://vendor.example/41154.0000.pdf", "41154.0000.pdf", { bookId: 1, section: "manuals" }, 100, books, stored)?.id, 12);
  assert.equal(alreadyStored("https://vendor.example/41154.0000.pdf", "41154.0000.pdf", { bookId: 1, section: "manuals" }, 101, books, stored), null);
  assert.equal(alreadyStored("https://vendor.example/sheet.pdf", "sheet.pdf", { bookId: 70, section: "spec" }, null, books, stored), null);
  assert.equal(alreadyStored("https://vendor.example/sheet.pdf", "sheet.pdf", { bookId: 69, section: "spec" }, null, books, stored)?.id, 13);
});

test("a download that is not a small PDF is refused", () => {
  assert.equal(pdfRejectReason(20 * 1024 * 1024 + 1, "%PDF-"), "File is over 20 MB.");
  assert.equal(pdfRejectReason(8, "<html>"), "File does not start with %PDF-.");
  assert.equal(pdfRejectReason(8, "%PDF-1.4"), null);
});

test("later batches move past files already logged, and retry failures after new URLs", () => {
  const uploads = [{ url: "https://a" }, { url: "https://b" }, { url: "https://c" }];
  const logged = [
    { url: "https://a", action: "OK" },
    { url: "https://b", action: "FAIL" },
  ];
  assert.deepEqual(uploadSlice(uploads, logged, 1).map((u) => u.url), ["https://c"]);
  assert.deepEqual(uploadSlice(uploads, logged, 5).map((u) => u.url), ["https://c", "https://b"]);
  assert.deepEqual(uploadSlice(uploads, [{ url: "https://b", action: "SKIP" }], 5).map((u) => u.url), ["https://a", "https://c"]);
});

test("a blank MPN is left blank; a different title or a taken MPN conflicts", () => {
  assert.equal(planMpn({ bookId: 1, title: "BUNN AXIOM", mpn: null }, axiom, books, new Set()).action, "SKIP");
  const set = planMpn({ bookId: 4, title: "bunn  axiom-dv-aps", mpn: "38700.0010" }, axiomDv, books, new Set());
  assert.equal(set.action, "OK");
  assert.equal(set.mpn, "38700.0010");
  assert.equal(planMpn({ bookId: 4, title: "BUNN OTHER", mpn: "38700.0010" }, axiomDv, books, new Set()).action, "CONFLICT");
  const taken = planMpn({ bookId: 1, title: "BUNN AXIOM", mpn: "38700.0010" }, axiom, [{ ...axiomDv, mpn: "38700.0010" }, axiom], new Set());
  assert.equal(taken.action, "CONFLICT");
  assert.match(taken.reason, /already on BUNN AXIOM-DV-APS/);
  const filled = planMpn({ bookId: 4, title: "BUNN AXIOM-DV-APS", mpn: "111" }, { ...axiomDv, mpn: "222" }, books, new Set([4]));
  assert.equal(filled.action, "CONFLICT");
  assert.match(filled.reason, /tied/);
  assert.equal(planMpn({ bookId: 9, title: "Missing", mpn: "1" }, undefined, books, new Set()).action, "FAIL");
});

test("import batch on an in-memory database", { timeout: 120_000 }, async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { runLibraryImport } = await import("../src/lib/ops/library-import-run.ts");
  const pg = new PGlite();
  const files = (await readdir("migrations")).filter((name) => name.endsWith(".sql")).sort();
  assert.ok(files.includes("0081_library_import_log.sql"));
  for (const name of files) await pg.exec(await readFile(`migrations/${name}`, "utf8"));
  const sql = {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
  };
  const columns = await sql.query("select column_name from information_schema.columns where table_name = 'library_import_log' order by column_name");
  assert.deepEqual(columns.map((c) => c.column_name), ["action", "book_id", "file_id", "id", "reason", "run_at", "url"]);

  async function book(title, manufacturer) {
    const rows = await sql.query("insert into library_books (title, manufacturer, per_variation) values ($1, $2, true) returning id", [title, manufacturer]);
    return Number(rows[0].id);
  }
  const axiomId = await book("BUNN AXIOM", "BUNN");
  const dvId = await book("BUNN AXIOM-DV-APS", "BUNN");
  const cameoId = await book("Eversys Cameo", "Eversys");
  const cwtfId = await book("BUNN CWTF15-3 (3 Lower)", "BUNN");
  const fetcoId = await book("FETCO CBS-1231 Plus", "FETCO");
  async function file(id, name, bookId) {
    await sql.query(
      `insert into library_files (id, section, name, mime, size, token, complete, book_id)
       values ($1, 'manuals', $2, 'application/pdf', 4, $3, true, $4)`,
      [id, name, `token-${id}`, bookId],
    );
  }
  await file(27, "Old Axiom.pdf", axiomId);
  await file(37, "Old Variation.pdf", dvId);
  await file(50, "Cameo service.pdf", cameoId);
  await sql.query("select setval('library_files_id_seq', (select max(id) from library_files))");

  const pdf = new TextEncoder().encode("%PDF-1.4\nhello\n");
  let fetches = 0;
  const fetchImpl = async (url) => {
    fetches += 1;
    if (String(url).includes("not-a-pdf")) return new Response("<html>nope</html>", { status: 200 });
    if (String(url).includes("missing")) return new Response("nope", { status: 404 });
    return new Response(pdf, { status: 200 });
  };
  const batch = {
    markAsDuplicate: [27, 37, 50],
    uploads: [
      {
        url: "https://vendor.example/41154.0000.pdf",
        fileName: "41154.0000.pdf",
        targets: [{ bookId: dvId, section: "manuals", docType: "Programming Manual", name: "BUNN AXIOM-DV-APS - Programming 41154.0000" }],
      },
    ],
    mpns: [
      { bookId: dvId, title: "BUNN AXIOM-DV-APS", mpn: "38700.0010", productPage: "https://commercial.bunn.com/38700.0010" },
      { bookId: axiomId, title: "BUNN AXIOM", mpn: null, productPage: null },
      { bookId: 9999, title: "Missing", mpn: "111", productPage: null },
    ],
  };
  const user = { userId: "admin-1", userName: "Admin" };
  const beforeBooks = await sql.query("select id from library_books");
  const preview = await runLibraryImport(sql, { ...user, apply: false, limit: 1, data: batch, fetch: fetchImpl });
  assert.equal(preview.applied, false);
  assert.equal(preview.rows.find((r) => r.fileId === 27)?.action, "OK");
  assert.equal(preview.rows.find((r) => r.fileId === 50)?.action, "SKIP");
  assert.equal(preview.rows.find((r) => r.kind === "upload")?.action, "OK");
  assert.equal(preview.rows.find((r) => r.reason.includes("38700.0010"))?.action, "OK");
  assert.equal((await sql.query("select id from library_import_log")).length, 0);
  assert.equal((await sql.query("select id from library_books")).length, beforeBooks.length);
  assert.equal((await sql.query("select name from library_files where id = 27"))[0].name, "Old Axiom.pdf");
  assert.equal((await sql.query("select mpn from library_books where id = $1", [dvId]))[0].mpn, null);

  const applied = await runLibraryImport(sql, { ...user, apply: true, limit: 1, data: batch, fetch: fetchImpl });
  assert.equal(applied.counts.FAIL, 1);
  assert.equal((await sql.query("select name from library_files where id = 27"))[0].name, "Old Axiom - Duplicate To Delete.pdf");
  assert.equal((await sql.query("select name from library_files where id = 37"))[0].name, "Old Variation - Duplicate To Delete.pdf");
  assert.equal((await sql.query("select name from library_files where id = 50"))[0].name, "Cameo service.pdf");
  const stored = await sql.query("select id, book_id, section, doc_type, original_name, source_url, name, complete from library_files where source_url = $1", ["https://vendor.example/41154.0000.pdf"]);
  assert.equal(stored.length, 1);
  assert.equal(Number(stored[0].book_id), axiomId);
  assert.equal(stored[0].doc_type, "Programming Manual");
  assert.equal(stored[0].original_name, "41154.0000.pdf");
  assert.equal(stored[0].name, "BUNN AXIOM - Programming 41154.0000.pdf");
  assert.equal(stored[0].complete, true);
  const chunks = await sql.query("select encode(data, 'base64') as b64 from library_file_chunks where file_id = $1 order by seq", [stored[0].id]);
  assert.equal(Buffer.concat(chunks.map((c) => Buffer.from(c.b64, "base64"))).toString(), Buffer.from(pdf).toString());
  assert.equal((await sql.query("select mpn from library_books where id = $1", [dvId]))[0].mpn, "38700.0010");
  assert.equal((await sql.query("select mpn from library_books where id = $1", [axiomId]))[0].mpn, null);
  assert.equal((await sql.query("select id from library_import_log")).length, applied.rows.length);

  const again = await runLibraryImport(sql, { ...user, apply: true, limit: 1, data: batch, fetch: fetchImpl });
  assert.equal(again.rows.filter((r) => r.kind === "upload").length, 0);
  assert.equal((await sql.query("select id from library_files where source_url = $1", ["https://vendor.example/41154.0000.pdf"])).length, 1);

  const fetchesBefore = fetches;
  await sql.query(
    `insert into library_files (section, name, mime, size, token, complete, book_id)
     values ('parts', 'Cameo 5700105620.pdf', 'application/pdf', 4, 'token-repl', true, $1)`,
    [cameoId],
  );
  const marked = await runLibraryImport(sql, { ...user, apply: true, limit: 0, data: batch, fetch: fetchImpl });
  assert.equal(fetches, fetchesBefore);
  assert.equal(marked.rows.find((r) => r.fileId === 50)?.action, "OK");
  assert.match((await sql.query("select name from library_files where id = 50"))[0].name, /Duplicate To Delete/);

  const more = {
    markAsDuplicate: [],
    uploads: [
      { url: "https://vendor.example/not-a-pdf.pdf", fileName: "page.pdf", targets: [{ bookId: dvId, section: "manuals", docType: "User Manual", name: "BUNN AXIOM-DV-APS - User page" }] },
      { url: "https://vendor.example/missing.pdf", fileName: "missing.pdf", targets: [{ bookId: dvId, section: "manuals", docType: "User Manual", name: "BUNN AXIOM-DV-APS - User missing" }] },
      { url: "https://vendor.example/spec.pdf", fileName: "Sellsheet.pdf", targets: [{ bookId: fetcoId, section: "spec", docType: null, name: "FETCO CBS-1231 Plus - Spec Sheet" }] },
      { url: "https://vendor.example/parts.pdf", fileName: "40566.0000.pdf", targets: [{ bookId: cwtfId, section: "parts", docType: null, name: "BUNN CWTF15-3 (3 Lower) - Parts Catalog 40566.0000" }] },
      { url: "https://vendor.example/gone.pdf", fileName: "gone.pdf", targets: [{ bookId: 4242, section: "manuals", docType: "User Manual", name: "Missing model" }] },
    ],
    mpns: [],
  };
  const rest = await runLibraryImport(sql, { ...user, apply: true, limit: 10, data: more, fetch: fetchImpl });
  assert.equal(rest.rows.find((r) => r.url?.includes("not-a-pdf"))?.action, "FAIL");
  assert.equal(rest.rows.find((r) => r.url?.includes("missing.pdf"))?.action, "FAIL");
  assert.equal((await sql.query("select id from library_files where source_url like '%not-a-pdf%' or source_url like '%missing.pdf%'")).length, 0);
  const spec = await sql.query("select book_id from library_files where source_url = 'https://vendor.example/spec.pdf'");
  assert.equal(Number(spec[0].book_id), fetcoId);
  const chip = await sql.query("select id from library_books where title = 'BUNN CWTF15'");
  assert.equal(chip.length, 1);
  const partsFile = await sql.query("select book_id, name from library_files where source_url = 'https://vendor.example/parts.pdf'");
  assert.equal(Number(partsFile[0].book_id), Number(chip[0].id));
  assert.equal(partsFile[0].name, "BUNN CWTF15 - Parts Catalog 40566.0000.pdf");
  assert.equal(rest.rows.find((r) => r.url?.includes("gone.pdf"))?.action, "CONFLICT");
  await pg.close();
});
