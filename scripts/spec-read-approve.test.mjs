import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { approveExact, approveOne, noSheetBooks, resolveHandEntry, specReadRows } = await import("../src/lib/ops/spec-read-api.ts");
const { saveTarget } = await import("../src/lib/ops/spec-library.ts");

const pg = new PGlite();
const dir = new URL("../migrations/", import.meta.url);
for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
const sql = { query: async (text, params) => (await pg.query(text, params)).rows };

let seq = 0;
async function bookWithRead(title, manufacturer, mpn, extracted) {
  seq += 1;
  const book = (await sql.query("insert into library_books (title, manufacturer, mpn) values ($1, $2, $3) returning id", [title, manufacturer, mpn]))[0].id;
  const file = (
    await sql.query(
      "insert into library_files (section, name, mime, size, token, complete, book_id) values ('spec', $1, 'application/pdf', 1, $2, true, $3) returning id",
      [`${title}.pdf`, `t${seq}`, book],
    )
  )[0].id;
  await sql.query("insert into spec_reads (file_id, book_id, status, extracted) values ($1, $2, 'needs_review', $3::jsonb)", [
    file,
    book,
    JSON.stringify(extracted),
  ]);
  return { book, file };
}

async function sheetOf(manufacturer, model) {
  const sheet = (await sql.query("select id, book_id, specs from spec_sheets where manufacturer = $1 and model = $2", [manufacturer, model]))[0];
  const config = (await sql.query("select requirements from spec_configs where sheet_id = $1 order by position limit 1", [sheet.id]))[0];
  return { ...sheet, requirements: config?.requirements };
}

test("approve keeps and ties an untied sheet with the same maker and model instead of overwriting it", async () => {
  const sheet = (
    await sql.query(
      `insert into spec_sheets (manufacturer, model, specs) values ('Bunn', 'ITCB', '[{"label":"Boilers","value":"2"}]'::jsonb) returning id`,
    )
  )[0].id;
  await sql.query(`insert into spec_configs (sheet_id, label, position, requirements) values ($1, 'Standard', 0, '{"power":{"voltage":"208V"}}'::jsonb)`, [
    sheet,
  ]);
  const { book, file } = await bookWithRead("Bunn ITCB", "Bunn", null, { voltage: "240V", amps: "30A" });
  await approveOne(sql, file, []);
  const after = await sheetOf("Bunn", "ITCB");
  assert.equal(after.id, sheet);
  assert.equal(after.book_id, book);
  assert.equal(after.requirements.power.voltage, "208V");
  assert.equal(after.requirements.power.amps, "30A");
  assert.deepEqual(after.specs, [{ label: "Boilers", value: "2" }]);
});

test("approve refuses a sheet that belongs to another model", async () => {
  const other = (await sql.query("insert into library_books (title, manufacturer) values ('Bunn Axiom Twin', 'Bunn') returning id"))[0].id;
  await sql.query("insert into spec_sheets (manufacturer, model, book_id) values ('Bunn', 'Axiom', $1)", [other]);
  const { file } = await bookWithRead("Bunn Axiom", "Bunn", null, { voltage: "120V" });
  await assert.rejects(() => approveOne(sql, file, []), /already has a spec sheet on another model/);
  const status = (await sql.query("select status from spec_reads where file_id = $1", [file]))[0].status;
  assert.equal(status, "needs_review");
});

test("a duplicate MPN is refused before anything is written", async () => {
  await sql.query("insert into library_books (title, manufacturer, mpn) values ('Fetco CBS-2131', 'Fetco', 'C2131-10')");
  const { file } = await bookWithRead("Fetco CBS-2132", "Fetco", null, { voltage: "208V", mpn: "c2131 10" });
  await assert.rejects(() => approveOne(sql, file, ["mpn"]), /MPN c2131 10 is already on another model\. Nothing was saved\./);
  const sheets = await sql.query("select id from spec_sheets where manufacturer = 'Fetco' and model = 'CBS-2132'");
  assert.equal(sheets.length, 0);
});

test("a sheet moved to another model after it was read is not approved onto the old one", async () => {
  const { book, file } = await bookWithRead("BUNN ICB-DV Short", "BUNN", null, { voltage: "120V", amps: "15A" });
  const tall = (await sql.query("insert into library_books (title, manufacturer) values ('BUNN ICB-DV Tall', 'BUNN') returning id"))[0].id;
  // Move only changes the file's model, as moveLibraryFile does.
  await sql.query("update library_files set book_id = $2 where id = $1", [file, tall]);
  const row = (await specReadRows(sql)).find((r) => Number(r.file_id) === file);
  assert.equal(Number(row.book_id), tall);
  assert.equal(row.book_title, "BUNN ICB-DV Tall");
  await assert.rejects(() => approveOne(sql, file, []), /^Error: This sheet was moved to another model\. Read it again\.$/);
  assert.equal((await sql.query("select id from spec_sheets where book_id = any($1::int[])", [[book, tall]])).length, 0);
  assert.equal((await sql.query("select status from spec_reads where file_id = $1", [file]))[0].status, "needs_review");
});

test("Use new on the MPN is refused while a file is tied to the current MPN, before anything is written", async () => {
  const { book, file } = await bookWithRead("BUNN CWTF15-TC", "BUNN", "12950.0360", { voltage: "120V", mpn: "12950.0212" });
  await sql.query("update library_files set mpn = '12950.0360' where id = $1", [file]);
  await assert.rejects(() => approveOne(sql, file, ["mpn"]), /^Error: Files here are tied to the current MPN\. Untie them before changing it\.$/);
  assert.equal((await sql.query("select mpn from library_books where id = $1", [book]))[0].mpn, "12950.0360");
  assert.equal((await sql.query("select id from spec_sheets where book_id = $1 or (manufacturer = 'BUNN' and model = 'CWTF15-TC')", [book])).length, 0);
  assert.equal((await sql.query("select status from spec_reads where file_id = $1", [file]))[0].status, "needs_review");
});

test("an MPN filled from a read is cleaned like one typed in", async () => {
  const long = "12950.0212-" + "X".repeat(60);
  const { book, file } = await bookWithRead("BUNN CWTF35", "BUNN", null, { voltage: "120V", mpn: long });
  await approveOne(sql, file, []);
  assert.equal((await sql.query("select mpn from library_books where id = $1", [book]))[0].mpn, long.slice(0, 60));
});

test("approve all exact skips a refused sheet, names it, and still approves the rest", async () => {
  await sql.query("update spec_reads set status = 'read' where status = 'needs_review'");
  const exact = JSON.stringify([{ key: "voltage", label: "Voltage", oldValue: "", newValue: "120V", kind: "fill" }]);
  const moved = await bookWithRead("Curtis G4 Single", "Curtis", null, { voltage: "120V" });
  const fine = await bookWithRead("Curtis G4 Twin", "Curtis", null, { voltage: "120V" });
  await sql.query("update spec_reads set changes = $2::jsonb where file_id = any($1::int[])", [[moved.file, fine.file], exact]);
  const elsewhere = (await sql.query("insert into library_books (title, manufacturer) values ('Curtis G4 Triple', 'Curtis') returning id"))[0].id;
  await sql.query("update library_files set book_id = $2 where id = $1", [moved.file, elsewhere]);
  const result = await approveExact(sql);
  assert.equal(result.approved, 1);
  assert.deepEqual(result.skipped, ["Curtis G4 Single.pdf: This sheet was moved to another model. Read it again."]);
  assert.equal((await sql.query("select status from spec_reads where file_id = $1", [fine.file]))[0].status, "read");
});

test("a hand entry closes its Spec Review row, and a model with a tied sheet leaves the no-sheet list", async () => {
  const { book, file } = await bookWithRead("Bunn ITCB-DV", "Bunn", null, {});
  await sql.query("update spec_reads set status = 'unreadable' where file_id = $1", [file]);
  // Nothing saved on the model yet: the row stays open.
  assert.equal(await resolveHandEntry(sql, file), false);
  assert.equal((await sql.query("select status from spec_reads where file_id = $1", [file]))[0].status, "unreadable");
  // saveSpecSheet, then moveSpecSheet ties it to the row's model, as afterImport does.
  await sql.query("insert into spec_sheets (manufacturer, model, book_id) values ('Bunn', 'ITCB-DV', $1)", [book]);
  assert.equal(await resolveHandEntry(sql, file), true);
  const row = (await sql.query("select status, resolved_at from spec_reads where file_id = $1", [file]))[0];
  assert.equal(row.status, "read");
  assert.ok(row.resolved_at);
  const done = await sql.query("select label, detail from library_admin_done where section = 'spec-review' and item_key = $1", [`file:${file}`]);
  assert.deepEqual(done, [{ label: "Bunn ITCB-DV", detail: "Entered by hand" }]);
  const typed = (await sql.query("insert into library_books (title, manufacturer) values ('BUNN CWTF15', 'BUNN') returning id"))[0].id;
  const bare = (await sql.query("insert into library_books (title, manufacturer) values ('BUNN CWTF20', 'BUNN') returning id"))[0].id;
  await sql.query("insert into spec_sheets (manufacturer, model, book_id) values ('BUNN', 'CWTF15', $1)", [typed]);
  const ids = (await noSheetBooks(sql)).map((b) => b.id);
  assert.equal(ids.includes(typed), false);
  assert.equal(ids.includes(bare), true);
});

test("a hand entry for one model never takes over the sheet tied to another", async () => {
  const family = (await sql.query("insert into library_books (title, manufacturer) values ('Fetco CBS-2152', 'Fetco') returning id"))[0].id;
  const variation = (await sql.query("insert into library_books (title, manufacturer) values ('Fetco CBS-2152-DV', 'Fetco') returning id"))[0].id;
  const sheet = (await sql.query("insert into spec_sheets (manufacturer, model, book_id) values ('Fetco', 'CBS-2152', $1) returning id", [family]))[0].id;
  const d = { manufacturer: "fetco", model: "cbs-2152" };
  await assert.rejects(
    () => saveTarget(sql, d, { overwrite: true, bookId: variation }),
    /^Error: Fetco CBS-2152 is the spec sheet for Fetco CBS-2152\. Nothing was saved\./,
  );
  assert.equal((await sql.query("select book_id from spec_sheets where id = $1", [sheet]))[0].book_id, family);
  // Its own model, or a save from Add Files (no model), still asks to replace it.
  assert.equal((await saveTarget(sql, d, { bookId: family })).conflict.id, sheet);
  assert.deepEqual(await saveTarget(sql, d, { overwrite: true }), { id: sheet });
});
