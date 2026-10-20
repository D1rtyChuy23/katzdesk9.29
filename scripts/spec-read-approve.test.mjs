import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { approveOne } = await import("../src/lib/ops/spec-read-api.ts");

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
