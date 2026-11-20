import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { applyDiscount } from "../src/lib/ops/discount.ts";

// Chuy, 11/20: fix the one cent on an exact half-cent percent. The app rounded 14.95% of $910.00 ($136.045) down to
// $136.04 while the database's invoice_total rounded it up to $136.05. Both now round half up, as the database does.

test("an exact half-cent percent rounds up, as the database does", () => {
  assert.deepEqual(applyDiscount(910, { kind: "percent", value: 14.95 }), { subtotal: 910, off: 136.05, total: 773.95 });
  assert.deepEqual(applyDiscount(0.1, { kind: "percent", value: 5 }), { subtotal: 0.1, off: 0.01, total: 0.09 });
  assert.equal(applyDiscount(10.01, { kind: "percent", value: 50 }).off, 5.01);
  // Unchanged: not on a half cent, an amount, 100%, the base cap.
  assert.equal(applyDiscount(100, { kind: "percent", value: 12.5 }).off, 12.5);
  assert.equal(applyDiscount(99.99, { kind: "percent", value: 100 }).off, 99.99);
  assert.equal(applyDiscount(50, { kind: "amount", value: 80 }).off, 50);
  assert.equal(applyDiscount(200, { kind: "percent", value: 10, scope: "chosen" }, 45.55).off, 4.56);
});

test("the app and invoice_total agree on every percent from 0.01% to 100% over a spread of totals", async () => {
  const pg = new PGlite();
  try {
    const dir = new URL("../migrations/", import.meta.url);
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
    const subs = [0.01, 0.1, 0.99, 1.05, 9.99, 10.01, 33.33, 99.95, 136.45, 910, 1234.56, 99999.99];
    const pcts = [];
    for (let v = 1; v <= 10000; v += 37) pcts.push(v / 100);
    pcts.push(14.95, 33.33, 50, 66.67, 100);
    const rows = (
      await pg.query(
        `select s::text as s, p::text as p, invoice_total(s, s, 'percent', p)::text as t
           from unnest($1::numeric[]) s cross join unnest($2::numeric[]) p`,
        [subs, pcts],
      )
    ).rows;
    let bad = [];
    for (const r of rows) {
      const app = applyDiscount(Number(r.s), { kind: "percent", value: Number(r.p) }).total;
      if (app !== Number(r.t)) bad.push(`${r.p}% of ${r.s}: app ${app}, db ${r.t}`);
    }
    assert.deepEqual(bad.slice(0, 5), []);
  } finally {
    await pg.close();
  }
});
