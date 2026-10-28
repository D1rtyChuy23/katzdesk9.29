import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { keepOneCopy, queueFiles, queuedSheets, queueRereads, rereadCounts, tieAndQueue } = await import("../src/lib/ops/spec-read-api.ts");
const { copiedManuals } = await import("../src/lib/ops/library-file-rules.ts");

async function freshDb() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  return { query: async (text, params) => (await pg.query(text, params)).rows };
}

async function book(sql, title, manufacturer) {
  return (await sql.query("insert into library_books (title, manufacturer) values ($1, $2) returning id", [title, manufacturer]))[0].id;
}

async function file(sql, bookId, section, name, size = 5000, originalName = null) {
  return (
    await sql.query(
      "insert into library_files (section, name, original_name, mime, size, token, complete, book_id) values ($1, $2, $3, 'application/pdf', $4, gen_random_uuid()::text, true, $5) returning id",
      [section, name, originalName, size, bookId],
    )
  )[0].id;
}

async function specFiles(sql, count) {
  const bookId = await book(sql, "BUNN Test", "BUNN");
  const ids = [];
  for (let i = 1; i <= count; i++) ids.push(await file(sql, bookId, "spec", `Sheet ${i}.pdf`, 10));
  return ids;
}

async function statusOf(sql, ids) {
  const rows = await sql.query("select file_id, status from spec_reads where file_id = any($1::int[]) order by file_id", [ids]);
  return rows.map((r) => r.status);
}

const queuedIds = async (sql, fileIds) => (await queuedSheets(sql, fileIds)).map((r) => Number(r.file_id));

test("Read next 15 does not put unreadable sheets back in the queue, so the rest get read", async () => {
  const sql = await freshDb();
  const ids = await specFiles(sql, 20);
  await queueFiles(sql, null, false);
  // The first batch found 15 scanned sheets.
  await sql.query("update spec_reads set status = 'unreadable', error = 'Scanned' where file_id = any($1::int[])", [ids.slice(0, 15)]);
  await queueFiles(sql, null, false);
  assert.deepEqual(await statusOf(sql, ids.slice(0, 15)), Array(15).fill("unreadable"));
  assert.deepEqual(await queuedIds(sql, null), ids.slice(15));
  // Reading one sheet on purpose still retries it.
  await queueFiles(sql, [ids[0]], true);
  assert.deepEqual(await statusOf(sql, [ids[0]]), ["queued"]);
});

test("a per-file read reads only the sheets asked for, not the lowest one in the queue", async () => {
  const sql = await freshDb();
  const ids = await specFiles(sql, 5);
  await queueFiles(sql, null, false);
  const asked = ids[4];
  await queueFiles(sql, [asked], true);
  assert.deepEqual(await queuedIds(sql, [asked]), [asked]);
  assert.deepEqual(await queuedIds(sql, null), ids);
});

test("keep one refuses when no copy is on the main chip, and works when the variations take manuals from it", async () => {
  const sql = await freshDb();
  const h120 = await book(sql, "BUNN H5X 120V", "BUNN");
  const h240 = await book(sql, "BUNN H5X 240V", "BUNN");
  const a = await file(sql, h120, "manuals", "BUNN H5X 120V - Installation 43599.0000.pdf", 5000, "43599.0000.pdf");
  const b = await file(sql, h240, "manuals", "BUNN H5X 240V - Installation 43599.0000.pdf", 5000, "43599.0000.pdf");
  await assert.rejects(() => keepOneCopy(sql, a, [a, b]), /Store this file once on the main chip first, so the other models keep it\./);
  assert.equal((await sql.query("select id from library_files where id = any($1::int[])", [[a, b]])).length, 2);

  const main = await book(sql, "BUNN ICB", "BUNN");
  const dv = await book(sql, "BUNN ICB-DV", "BUNN");
  const keep = await file(sql, main, "manuals", "BUNN ICB - Installation 39343.0000.pdf", 7000, "39343.0000.pdf");
  const extra = await file(sql, dv, "manuals", "BUNN ICB-DV - Installation 39343.0000.pdf", 7000, "39343.0000.pdf");
  // A copy on a model outside the family is refused, and nothing is deleted.
  await assert.rejects(() => keepOneCopy(sql, keep, [keep, extra, b]), /Store this file once on the main chip first/);
  assert.equal((await sql.query("select id from library_files where id = any($1::int[])", [[keep, extra, b]])).length, 3);

  assert.deepEqual(await keepOneCopy(sql, keep, [keep, extra]), { removed: 1 });
  const books = (await sql.query("select id, title, manufacturer from library_books")).map((r) => ({ id: r.id, title: r.title, manufacturer: r.manufacturer }));
  const files = (await sql.query("select id, section, book_id, mpn from library_files")).map((r) => ({ id: r.id, section: r.section, bookId: r.book_id, mpn: r.mpn }));
  assert.equal(files.some((f) => f.id === extra), false);
  assert.deepEqual(
    copiedManuals(books.find((x) => x.id === dv), books, files, []).map((f) => f.id),
    [keep],
  );
});

test("keep one shows the kept copy again on a variation that had hidden it", async () => {
  const sql = await freshDb();
  const main = await book(sql, "BUNN AXIOM", "BUNN");
  const twin = await book(sql, "BUNN AXIOM Twin", "BUNN");
  const keep = await file(sql, main, "manuals", "BUNN AXIOM - Installation 44000.0000.pdf", 6000, "44000.0000.pdf");
  const own = await file(sql, twin, "manuals", "BUNN AXIOM Twin - Installation 44000.0000.pdf", 6000, "44000.0000.pdf");
  // The variation hid the main chip's copy because it showed twice.
  await sql.query("insert into library_file_hidden (file_id, book_id) values ($1, $2)", [keep, twin]);
  assert.deepEqual(await keepOneCopy(sql, keep, [keep, own]), { removed: 1 });
  assert.equal((await sql.query("select 1 from library_file_hidden where file_id = $1 and book_id = $2", [keep, twin])).length, 0);
});

/* ------------------------------------------------------------------ 10/28: manuals are read too */

async function fileOf(sql, bookId, section, name, mime = "application/pdf") {
  return (
    await sql.query(
      "insert into library_files (section, name, mime, size, token, complete, book_id) values ($1, $2, $3, 10, gen_random_uuid()::text, true, $4) returning id",
      [section, name, mime, bookId],
    )
  )[0].id;
}

test("the queue takes spec sheets and PDF manuals, not Word manuals or parts books", async () => {
  const sql = await freshDb();
  const bookId = await book(sql, "BUNN ICB", "BUNN");
  const spec = await fileOf(sql, bookId, "spec", "Spec.pdf");
  const manual = await fileOf(sql, bookId, "manuals", "Installation.pdf");
  const word = await fileOf(sql, bookId, "manuals", "Notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const parts = await fileOf(sql, bookId, "parts", "Parts.pdf");
  await queueFiles(sql, null, false);
  assert.deepEqual(await queuedIds(sql, null), [spec, manual]);
  await queueFiles(sql, [word, parts], true);
  assert.deepEqual(await queuedIds(sql, null), [spec, manual], "asking for them by id doesn't queue them either");
});

test("tie and read: a spec sheet takes the model's MPN; a manual is only queued, so it stays shared with the variations", async () => {
  const sql = await freshDb();
  const bookId = (await sql.query("insert into library_books (title, manufacturer, mpn) values ('BUNN ICB', 'BUNN', '39343.0000') returning id"))[0].id;
  const spec = await fileOf(sql, bookId, "spec", "Spec.pdf");
  const manual = await fileOf(sql, bookId, "manuals", "Installation.pdf");
  const word = await fileOf(sql, bookId, "manuals", "Notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  await tieAndQueue(sql, spec);
  await tieAndQueue(sql, manual);
  const mpn = async (id) => (await sql.query("select mpn from library_files where id = $1", [id]))[0].mpn;
  assert.equal(await mpn(spec), "39343.0000");
  assert.equal(await mpn(manual), null);
  assert.deepEqual(await statusOf(sql, [spec, manual]), ["queued", "queued"]);
  await assert.rejects(() => tieAndQueue(sql, word), /not on a model/);
});

test("re-read: counts by where each read stands, and queueing the chosen ones again is the same twice", async () => {
  const sql = await freshDb();
  const bookId = await book(sql, "BUNN ICB", "BUNN");
  const ids = {
    never: await fileOf(sql, bookId, "spec", "A.pdf"),
    queued: await fileOf(sql, bookId, "spec", "B.pdf"),
    bad: await fileOf(sql, bookId, "spec", "C.pdf"),
    review: await fileOf(sql, bookId, "spec", "D.pdf"),
    done: await fileOf(sql, bookId, "spec", "E.pdf"),
    manualBad: await fileOf(sql, bookId, "manuals", "M.pdf"),
    manualNever: await fileOf(sql, bookId, "manuals", "N.pdf"),
  };
  await fileOf(sql, bookId, "manuals", "W.docx", "application/msword");
  await fileOf(sql, null, "spec", "Unfiled.pdf");
  const set = (id, status) => sql.query("insert into spec_reads (file_id, book_id, status) values ($1, $2, $3)", [id, bookId, status]);
  await set(ids.queued, "queued");
  await set(ids.bad, "unreadable");
  await set(ids.review, "needs_review");
  await set(ids.done, "read");
  await set(ids.manualBad, "unreadable");
  assert.deepEqual(await rereadCounts(sql), {
    spec: { unreadable: 1, never: 2, needs_review: 1, read: 1 },
    manuals: { unreadable: 1, never: 1, needs_review: 0, read: 0 },
  });
  const first = await queueRereads(sql, ["unreadable", "never"], ["spec", "manuals"]);
  assert.deepEqual(first, [ids.never, ids.queued, ids.bad, ids.manualBad, ids.manualNever]);
  assert.deepEqual(await statusOf(sql, first), Array(5).fill("queued"));
  assert.deepEqual(await statusOf(sql, [ids.review, ids.done]), ["needs_review", "read"], "not chosen: left as they are");
  assert.deepEqual(await queueRereads(sql, ["unreadable", "never"], ["spec", "manuals"]), [ids.never, ids.queued, ids.bad, ids.manualBad, ids.manualNever]);
  assert.deepEqual(await queueRereads(sql, ["read"], ["manuals"]), []);
  assert.deepEqual(await queueRereads(sql, ["read", "needs_review"], ["spec"]), [ids.review, ids.done]);
});
