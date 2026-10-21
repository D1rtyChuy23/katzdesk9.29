// Migration 0090: the X20's old PPM kits are hidden; the CBM kits, the shared X20/X30 kit B and other parts stay.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("0090 hides only the X20's old PPM kits", async () => {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  const files = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
  for (const name of files.filter((n) => n < "0090")) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const skus = ["FA981900000", "fa981902000 ", "FA981907000", "FA981908020", "FA981909010", "FA981945000", "FA981901010", "FA781739020", "FA781740010", "FA946820010"];
  for (const sku of skus) {
    await pg.query("insert into billing_items (sku, item, description, kind, active) values ($1, $1, $1, 'part', true)", [sku]);
  }
  for (const name of files.filter((n) => n >= "0090")) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const hidden = (await pg.query("select btrim(sku) as sku from billing_items where hidden_at is not null order by 1")).rows.map((r) => r.sku);
  assert.deepEqual(hidden, ["FA981900000", "FA981907000", "FA981908020", "FA981909010", "FA981945000", "fa981902000"].sort());
});
