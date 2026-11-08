// Per-item discounts (Chuy, 11/7): "I would also like to add a selection on which items I could choose to discount on
// an invoice." A bill keeps its one discount, on the Whole bill (as every discount was before) or on Chosen lines: it
// comes off only the lines ticked for it, and the other lines bill in full. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
// As in charges.test.mjs: the server modules start the app's database when loaded, and this keeps it off data/desk.
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";

const D = await import("../src/lib/ops/discount.ts");
const C = await import("../src/lib/ops/charges-api.ts");
const TB = await import("../src/lib/ops/ticket-billing-api.ts");
const I = await import("../src/lib/ops/invoice-api.ts");

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

const pmJob = (sql) => idOf(sql, "insert into pm_jobs (customer, wo, status) values ($1, $2, 'Completed') returning id", [CAFE, `WO-PID-${++calls}`]);
const deal = (sql) => idOf(sql, "insert into deals (customer) values ($1) returning id", [CAFE]);
const rebuild = (sql, account) => idOf(sql, "insert into rebuilds (title, account, status) values ('Test refurb', $1, 'In progress') returning id", [account]);

const install = (sql, o = {}) =>
  idOf(sql, "insert into installs (customer, wo, complete, equip_status, archived, po) values ($1, $2, $3, $4, false, $5) returning id", [
    o.customer ?? CAFE,
    o.wo ?? null,
    o.complete ?? false,
    o.equipStatus ?? "Not Ready",
    o.po ?? null,
  ]);

/** NetSuite's invoice on a ticket, which locks its charges until an Admin unlocks them. */
const ticketInvoice = (sql, jobId, inv, status, total, o = {}) =>
  sql.query(
    `insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source)
     values ($1, $2, $3, '2026-10-22', $4, $5, $5, $6)`,
    [jobId, inv, o.so ?? null, status, total, o.so ? "so" : "standalone"],
  );

const history = async (sql, id) => (await sql.query("select detail from activity where entity_id = $1 order by id", [id])).map((r) => r.detail);
const ticks = async (sql, jobId) => (await sql.query("select discount_chosen from ticket_charges where job_id = $1 order by sort, id", [jobId])).map((r) => r.discount_chosen);

// A and B as a ticket's charge lines, as the Charges panel sends them.
const LINES = [
  { item: "PARTS : TEST-A", description: "", qty: 2, rate: 45, discountChosen: true },
  { item: "Service : SERVICELABOR", description: "Bench labor", qty: 1.5, rate: 150, discountChosen: false },
];
/** The same lines from a page opened before 11/7: no ticks. */
const OLD_LINES = LINES.map(({ discountChosen: _tick, ...l }) => l);

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

/* ------------------------------------------------------------------ ticket charges */

test("a ticket's chosen-lines discount: saved with its ticks, read back, totalled on the ticked lines, and logged that way", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [], discount: pct });
  const c = await C.loadTicketCharges(sql, job);
  assert.deepEqual(c.lines.map((l) => l.discountChosen), [true, false]);
  assert.deepEqual(c.discount, pct);
  assert.deepEqual([c.subtotal, c.off, c.total], [315, 9, 306]);
  assert.equal((await history(sql, job)).at(-1), "charges: 2 lines, $315.00, 10% off 1 of 2 lines ($9.00), total $306.00");
});

test("a chosen-lines discount with nothing ticked is refused; clearing it makes the ticket Whole bill with no ticks", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql);
  const unticked = LINES.map((l) => ({ ...l, discountChosen: false }));
  await assert.rejects(C.writeTicketCharges(sql, job, "u-owner", { lines: unticked, lineIds: [], discount: pct }), { message: D.CHOSEN_NONE });
  assert.deepEqual(await ticks(sql, job), []);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [], discount: pct });
  const ids = (await C.loadTicketCharges(sql, job)).lines.map((l) => l.id);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: ids, discount: null });
  assert.deepEqual(await one(sql, "select discount_scope, discount_kind from service_jobs where id = $1", [job]), { discount_scope: "all", discount_kind: null });
  assert.deepEqual(await ticks(sql, job), [false, false]);
});

test("a page from before the publish can't save over a chosen-lines ticket, and saves on a Whole-bill ticket as before", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [], discount: pct });
  const ids = (await C.loadTicketCharges(sql, job)).lines.map((l) => l.id);
  // Its discount with no scope, or no discount sent and lines with no ticks: either would drop the ticks.
  await assert.rejects(C.writeTicketCharges(sql, job, "u-owner", { lines: OLD_LINES, lineIds: ids, discount: { kind: "percent", value: 10 } }), { message: D.OUT_OF_DATE });
  await assert.rejects(C.writeTicketCharges(sql, job, "u-owner", { lines: OLD_LINES, lineIds: ids }), { message: D.OUT_OF_DATE });
  assert.deepEqual(await ticks(sql, job), [true, false]);
  assert.equal((await one(sql, "select discount_scope from service_jobs where id = $1", [job])).discount_scope, "chosen");
  // A Whole-bill ticket takes both saves, as before.
  const whole = await ticket(sql);
  await C.writeTicketCharges(sql, whole, "u-owner", { lines: OLD_LINES, lineIds: [], discount: { kind: "percent", value: 10 } });
  const wids = (await C.loadTicketCharges(sql, whole)).lines.map((l) => l.id);
  await C.writeTicketCharges(sql, whole, "u-owner", { lines: OLD_LINES, lineIds: wids });
  const w = await C.loadTicketCharges(sql, whole);
  assert.deepEqual([w.discount, w.total], [{ kind: "percent", value: 10 }, 283.5]);
});

test("an Admin's unlocked save keeps the ticks", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql, { so: "SO5" });
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'PARTS : TEST-A', '', 2, 45, 'part', 1)", [job]);
  await ticketInvoice(sql, job, "INV200", "Paid In Full", 90, { so: "SO5" });
  await TB.unlockTicketBillingFor(sql, job, "u-owner", "NetSuite credit memo changed the part");
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, discount: pct, unlocked: { nsSo: "SO5", billedAt: "2026-10-22" } });
  const c = await C.loadTicketCharges(sql, job);
  assert.deepEqual(c.lines.map((l) => l.discountChosen), [true, false]);
  assert.deepEqual([c.discount, c.total], [pct, 306]);
});

test("Parts Profit: only lines that take the discount get a share of it", async () => {
  const { sql } = await fresh();
  await sql.query("insert into billing_items (sku, item, kind, rate, cost) values ('TEST-A', 'PARTS : TEST-A', 'part', 45, 20), ('TEST-B', 'PARTS : TEST-B', 'part', 150, 60)");
  const job = await ticket(sql);
  const parts = [
    { item: "PARTS : TEST-A", description: "", qty: 2, rate: 45, discountChosen: true },
    { item: "PARTS : TEST-B", description: "", qty: 1.5, rate: 150, discountChosen: false },
  ];
  await C.writeTicketCharges(sql, job, "u-owner", { lines: parts, lineIds: [], discount: pct });
  assert.deepEqual((await C.getTicketChargesFor(sql, job, "u-owner")).profit.map((p) => p?.ticketDiscount), [9, 0]);
  await C.recordTicketSalesOrder(sql, job, "u-owner", "SO-PID-1");
  assert.deepEqual((await sql.query("select ticket_discount::text as d from ticket_charges where job_id = $1 order by sort", [job])).map((r) => r.d), ["9.00", "0.00"]);
});

/* ------------------------------------------------------------------ the Invoice window */

// What the Invoice window sends on Approve: A ticked, B not, 10% on Chosen lines.
const SENT = { kind: "percent", value: "10", scope: "chosen" };
const head = (sql, type, id) =>
  one(sql, "select id, total::text as total, discount_scope, approved_at::text as approved from invoices where entity_type = $1 and entity_id = $2", [type, id]);
const lineTicks = async (sql, invoiceId) => (await sql.query("select discount_chosen from invoice_lines where invoice_id = $1 order by sort, id", [invoiceId])).map((r) => r.discount_chosen);

test("the Invoice window approves a chosen-lines discount on an install, a PM and a deal: ticks kept, total on the ticked lines", async () => {
  const { sql } = await fresh();
  for (const [type, id] of [
    ["install", await install(sql)],
    ["pm", await pmJob(sql)],
    ["deal", await deal(sql)],
  ]) {
    await I.approveInvoiceFor(sql, { type, id, lines: LINES, lineIds: [], discount: SENT, seen: null }, "u-owner");
    const h = await head(sql, type, id);
    assert.deepEqual([h.total, h.discount_scope], ["306.00", "chosen"], type);
    assert.deepEqual(await lineTicks(sql, h.id), [true, false], type);
    const v = await I.getInvoiceFor(sql, { type, id }, "u-owner");
    assert.deepEqual([v.off, v.total, v.lines.map((l) => l.discountChosen)], [9, 306, [true, false]], type);
    assert.deepEqual(v.discount, pct, type);
    assert.equal((await history(sql, id)).at(-1), "invoice approved: 2 lines, total $306.00 · 10% off 1 of 2 lines", type);
  }
});

test("the Invoice window on a ticket writes the ticket's Charges with their ticks", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql);
  await I.approveInvoiceFor(sql, { type: "service", id: job, lines: LINES, lineIds: [], discount: SENT, seen: null }, "u-owner");
  assert.deepEqual(await ticks(sql, job), [true, false]);
  assert.equal((await one(sql, "select discount_scope from service_jobs where id = $1", [job])).discount_scope, "chosen");
  assert.equal((await head(sql, "service", job)).total, "306.00");
});

test("an Invoice window from before the publish can't approve over a chosen-lines invoice", async () => {
  const { sql } = await fresh();
  for (const [type, id] of [
    ["install", await install(sql)],
    ["pm", await pmJob(sql)],
  ]) {
    await I.approveInvoiceFor(sql, { type, id, lines: LINES, lineIds: [], discount: SENT, seen: null }, "u-owner");
    const before = await head(sql, type, id);
    const seen = (await I.getInvoiceFor(sql, { type, id }, "u-owner")).version;
    await assert.rejects(I.approveInvoiceFor(sql, { type, id, lines: OLD_LINES, lineIds: [], discount: { kind: "percent", value: "10" }, seen }, "u-owner"), { message: D.OUT_OF_DATE }, type);
    assert.deepEqual(await head(sql, type, id), before, type);
    assert.deepEqual(await lineTicks(sql, before.id), [true, false], type);
  }
  // A Whole-bill invoice takes it, as before.
  const inst = await install(sql);
  await I.approveInvoiceFor(sql, { type: "install", id: inst, lines: OLD_LINES, lineIds: [], discount: { kind: "percent", value: "10" }, seen: null }, "u-owner");
  const seen = (await I.getInvoiceFor(sql, { type: "install", id: inst }, "u-owner")).version;
  await I.approveInvoiceFor(sql, { type: "install", id: inst, lines: OLD_LINES, lineIds: [], discount: { kind: "percent", value: "10" }, seen }, "u-owner");
  assert.deepEqual([(await head(sql, "install", inst)).total, (await head(sql, "install", inst)).discount_scope], ["283.50", "all"]);
});

test("Warehouse's Save for Approval stays Whole bill with no ticks", async () => {
  const { sql } = await fresh();
  await sql.query("insert into billing_items (sku, item, kind, rate, active) values ('TEST-A', 'PARTS : TEST-A', 'part', 45, true)");
  const rb = await rebuild(sql, "Katz Coffee Service Dept.");
  // Its waiting invoice read Chosen lines with a tick (it can't from the window): saving puts it back to the Whole bill.
  const inv = await idOf(sql, "insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at, discount_scope) values ('rebuild', $1, 'Katz Coffee Service Dept.', 90, 'wes', now(), 'chosen') returning id", [rb]);
  await sql.query("insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort, discount_chosen) values ($1, 'PARTS : TEST-A', '', 2, 45, 'part', 1, true)", [inv]);
  await I.saveInvoiceForApprovalFor(sql, { type: "rebuild", id: rb, lines: [{ item: "PARTS : TEST-A", description: "", qty: 2, rate: 45, discountChosen: true }], discount: null }, "u-wh");
  const h = await head(sql, "rebuild", rb);
  assert.equal(h.discount_scope, "all");
  assert.deepEqual(await lineTicks(sql, h.id), [false]);
});

test("the account's Invoices tab totals a chosen-lines ticket on its ticked lines", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [], discount: pct });
  const row = (await I.listAccountInvoicesFor(sql, CAFE, "u-owner")).find((r) => r.type === "service" && r.id === job);
  assert.equal(row.total, 306);
});
