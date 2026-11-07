// Per-item discounts (Chuy, 11/7): "I would also like to add a selection on which items I could choose to discount on
// an invoice." A bill keeps its one discount, on the Whole bill (as every discount was before) or on Chosen lines: it
// comes off only the lines ticked for it, and the other lines bill in full. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);

const D = await import("../src/lib/ops/discount.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const CAFE = "Test Bean Cafe - Heights";
// Two lines: a part ticked for the discount, and labor that isn't.
const A = { qty: 2, rate: 45, discountChosen: true };
const B = { qty: 1.5, rate: 150, discountChosen: false };
const pct = { kind: "percent", value: 10, scope: "chosen" };

// One database at a time: the last test's is closed when the next one starts. Call numbers start over with each.
let last = null;
let calls = 0;
/** A database with the migrations applied through `through` (a file name), or all of them. */
async function freshUpTo(through) {
  if (last) await last.close().catch(() => {});
  calls = 0;
  const pg = new PGlite();
  last = pg;
  for (const name of files) {
    await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    if (name === through) break;
  }
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'),
       ('u-desk', 'dana', true, false, 'service'),
       ('u-wh', 'wes', true, false, 'warehouse')`,
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}
const fresh = () => freshUpTo(null);

const one = async (sql, text, params = []) => (await sql.query(text, params))[0];
const idOf = async (sql, text, params) => Number((await one(sql, text, params)).id);

const ticket = (sql, o = {}) =>
  idOf(
    sql,
    `insert into service_jobs (kind, call_id, customer, wo, status, technician, po, ns_so, received)
     values ($1, $2, $3, $4, $5, 'Test Tech', $6, $7, $8) returning id`,
    [o.kind ?? "service", `SC-PID-${++calls}`, o.customer ?? CAFE, o.wo ?? null, o.status ?? "Completed", o.po ?? null, o.so ?? null, o.received ?? "2026-10-20"],
  );

const install = (sql, o = {}) =>
  idOf(sql, "insert into installs (customer, wo, complete, equip_status, archived, po) values ($1, $2, $3, $4, false, $5) returning id", [
    o.customer ?? CAFE,
    o.wo ?? null,
    o.complete ?? false,
    o.equipStatus ?? "Not Ready",
    o.po ?? null,
  ]);

/* ------------------------------------------------------------------ the migration */

test("migration 0123 only adds: a scope on tickets and invoices, a tick on their lines, and invoice_total with a base that works out totals as the app does", async () => {
  const statements = src("migrations/0123_per_item_discounts.sql")
    .replace(/--.*$/gm, "")
    .split(/;\s*(?=(?:alter|create)\b)/i)
    .map((s) => s.trim().replace(/;$/, ""))
    .filter(Boolean);
  for (const s of statements) {
    assert.match(
      s,
      /^(alter table (service_jobs|invoices) add column if not exists discount_scope text not null default 'all'|alter table (service_jobs|invoices) drop constraint if exists (service_jobs|invoices)_discount_scope_check|alter table (service_jobs|invoices) add constraint (service_jobs|invoices)_discount_scope_check check \(discount_scope in \('all', 'chosen'\)\)|alter table (ticket_charges|invoice_lines) add column if not exists discount_chosen boolean not null default false|create or replace function invoice_total\(subtotal numeric, base numeric, discount_kind text, discount_value numeric\) returns numeric language sql immutable as \$\$)/i,
      s.slice(0, 90),
    );
  }
  // Two scope columns, their two checks (each dropped, then added), two tick columns, one function.
  assert.equal(statements.length, 9);

  // Bills saved before it read as Whole bill, with no ticks.
  const { pg, sql } = await freshUpTo("0122_rebuild_invoice_sales_order.sql");
  const job = await ticket(sql);
  for (const [i, l] of [A, B].entries()) {
    await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, $2, '', $3, $4, 'part', $5)", [job, `PARTS : TEST-${i}`, l.qty, l.rate, i + 1]);
  }
  const inst = await install(sql);
  const inv = await idOf(sql, "insert into invoices (entity_type, entity_id, customer, total) values ('install', $1, $2, 90) returning id", [inst, CAFE]);
  await sql.query("insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort) values ($1, 'PARTS : TEST-0', '', 2, 45, 'part', 1)", [inv]);
  await pg.exec(src("migrations/0123_per_item_discounts.sql"));
  assert.deepEqual((await sql.query("select discount_scope from service_jobs where id = $1", [job])).map((r) => r.discount_scope), ["all"]);
  assert.deepEqual((await sql.query("select discount_chosen from ticket_charges where job_id = $1 order by sort", [job])).map((r) => r.discount_chosen), [false, false]);
  assert.deepEqual((await sql.query("select discount_scope from invoices where id = $1", [inv])).map((r) => r.discount_scope), ["all"]);
  assert.deepEqual((await sql.query("select discount_chosen from invoice_lines where invoice_id = $1", [inv])).map((r) => r.discount_chosen), [false]);
  // Whole bill or Chosen lines, nothing else.
  await assert.rejects(sql.query("update service_jobs set discount_scope = 'some' where id = $1", [job]));
  await assert.rejects(sql.query("update invoices set discount_scope = 'some' where id = $1", [inv]));

  // The SQL total matches the app's, to the cent.
  const cases = [
    { lines: [A, B], d: pct, want: 306 },
    { lines: [A, B], d: { kind: "amount", value: 100, scope: "chosen" }, want: 225 },
    { lines: [A, B], d: { kind: "percent", value: 10 }, want: 283.5 },
    { lines: [A, B], d: null, want: 315 },
  ];
  for (const c of cases) {
    const sub = D.billTotals(c.lines, null).subtotal;
    const base = D.discountBase(c.lines, c.d);
    const got = Number((await one(sql, "select invoice_total($1::numeric, $2::numeric, $3::text, $4::numeric)::text as t", [sub, base, c.d?.kind ?? null, c.d?.value ?? null])).t);
    assert.equal(got, D.billTotals(c.lines, c.d).total, JSON.stringify(c));
    assert.equal(got, c.want, JSON.stringify(c));
  }
  // A base outside 0 to the subtotal is held there, as applyDiscount holds it.
  for (const [base, want] of [
    [400, 283.5],
    [-5, 315],
  ]) {
    assert.equal(Number((await one(sql, "select invoice_total(315::numeric, $1::numeric, 'percent', 10)::text as t", [base])).t), want);
    assert.equal(D.applyDiscount(315, { kind: "percent", value: 10 }, base).total, want);
  }
  // Today's three-argument total is unchanged.
  assert.equal(Number((await one(sql, "select invoice_total(315::numeric, 'percent', 10)::text as t")).t), 283.5);
});
