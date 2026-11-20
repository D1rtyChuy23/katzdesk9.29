import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { applyDiscount, billTotals, withHeaderDiscount } from "../src/lib/ops/discount.ts";
import { lineAmount } from "../src/lib/ops/charges.ts";
import { chargesMismatch, possibleDoubleBill } from "../src/lib/ops/billing-rules.ts";

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

test("a line's amount rounds an exact half cent up, as round(qty * rate, 2) does", () => {
  assert.equal(lineAmount({ qty: 0.5, rate: 4.35 }), 2.18);
  assert.equal(lineAmount({ qty: 1.5, rate: 1.45 }), 2.18);
  assert.equal(lineAmount({ qty: 0.75, rate: 2.9 }), 2.18);
  assert.equal(lineAmount({ qty: 0.15, rate: 14.5 }), 2.18);
  assert.equal(lineAmount({ qty: 3, rate: 19.99 }), 59.97);
  assert.equal(lineAmount({ qty: 1, rate: -12.5 }), -12.5);
  assert.equal(lineAmount({ qty: 0.5, rate: -4.35 }), -2.18, "a credit rounds away from zero, as Postgres does");
});

test("the app's line amounts and percent off agree with the database on a dense half-cent sweep, Chosen base too", async () => {
  const pg = new PGlite();
  try {
    const dir = new URL("../migrations/", import.meta.url);
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
    const qtys = [0.01, 0.05, 0.15, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2.5, 3.33, 7.75];
    const rates = [];
    for (let c = 1; c <= 2000; c += 7) rates.push(c / 100);
    const lines = (await pg.query("select q::text q, r::text r, round(q * r, 2)::text a from unnest($1::numeric[]) q cross join unnest($2::numeric[]) r", [qtys, rates])).rows;
    const badLines = lines.filter((l) => lineAmount({ qty: Number(l.q), rate: Number(l.r) }) !== Number(l.a)).map((l) => `${l.q} x ${l.r}: db ${l.a}`);
    assert.deepEqual(badLines.slice(0, 5), []);
    const bases = [];
    for (let c = 1; c <= 3001; c += 2) bases.push(c / 100);
    const pcts = [5, 10, 25, 50, 75, 14.95];
    const rows = (await pg.query("select b::text b, p::text p, invoice_total(b + 100, b, 'percent', p)::text t from unnest($1::numeric[]) b cross join unnest($2::numeric[]) p", [bases, pcts])).rows;
    const bad = rows.filter((r) => applyDiscount(Number(r.b) + 100, { kind: "percent", value: Number(r.p), scope: "chosen" }, Number(r.b)).total !== Number(r.t));
    assert.deepEqual(bad.slice(0, 5).map((r) => `${r.p}% of ${r.b} (+100 unticked): db ${r.t}`), []);
  } finally {
    await pg.close();
  }
});

test("Export Billing's header discount for 14.95% of $910.00 is $136.05", () => {
  const lines = [{ jobId: 1, item: "PARTS : ZZ-1", description: "Zz part", qty: 1, rate: 910 }];
  const out = withHeaderDiscount(lines, new Map([[1, { kind: "percent", value: 14.95 }]]));
  assert.equal(out[0].discountRate, "-136.05");
  assert.equal(billTotals(lines, { kind: "percent", value: 14.95 }).total, 773.95);
});

test("a one-cent rounding difference with NetSuite isn't a mismatch or a double bill; two cents is", () => {
  // Bills exported before 11/20 at the old rounding can be a cent off what KatzDesk now works out.
  assert.equal(chargesMismatch([{ status: "Open", total: 773.96 }], 773.95), false);
  assert.equal(chargesMismatch([{ status: "Open", total: 773.94 }], 773.95), false);
  assert.equal(chargesMismatch([{ status: "Open", total: 773.97 }], 773.95), true);
  assert.equal(possibleDoubleBill([{ status: "Open", total: 400 }, { status: "Open", total: 373.96 }], 773.95), false);
  assert.equal(possibleDoubleBill([{ status: "Open", total: 400 }, { status: "Open", total: 373.97 }], 773.95), true);
});
