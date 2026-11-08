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
const BF = await import("../src/lib/ops/billing-backfill-api.ts");
const M = await import("../src/lib/ops/ticket-install-merge.ts");
const WD = await import("../src/lib/ops/wo-duplicates.ts");
const IP = await import("../src/lib/ops/install-projects.ts");

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

async function install(sql, o = {}) {
  const id = await idOf(sql, "insert into installs (customer, wo, complete, equip_status, archived, po) values ($1, $2, $3, $4, false, $5) returning id", [
    o.customer ?? CAFE,
    o.wo ?? null,
    o.complete ?? false,
    o.equipStatus ?? "Not Ready",
    o.po ?? null,
  ]);
  if (o.wo) await sql.query("insert into install_work_orders (install_id, wo, match_key) values ($1, $2, $3)", [id, o.wo, o.wo.replace(/\D+/g, "").replace(/^0+/, "")]);
  return id;
}

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

test("each save statement refuses a page from before the publish on a chosen-lines bill, even with the check in front of it skipped", async () => {
  const { sql } = await fresh();
  // What an old page sends: no scope. The same call with a scope, from a page of today, writes: only the guard stops it.
  const arrays = [["PARTS : TEST-A", "Service : SERVICELABOR"], ["", "Bench labor"], [2, 1.5], [45, 150], ["part", "labor"]];
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [], discount: pct });
  const charges = (scope) => sql.query(C.replaceTicketChargesSql(), [job, ...arrays, true, [], null, "percent", 10, ["", ""], false, scope, [false, true]]);
  assert.deepEqual(await charges(null), []);
  assert.deepEqual(await ticks(sql, job), [true, false]);
  assert.equal((await charges("chosen")).length, 1);
  assert.deepEqual(await ticks(sql, job), [false, true]);

  // An Admin's save on an unlocked, invoiced ticket.
  const billed = await ticket(sql, { so: "SO5" });
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'PARTS : TEST-A', '', 2, 45, 'part', 1)", [billed]);
  await ticketInvoice(sql, billed, "INV200", "Paid In Full", 90, { so: "SO5" });
  await TB.unlockTicketBillingFor(sql, billed, "u-owner", "NetSuite credit memo changed the part");
  await C.writeTicketCharges(sql, billed, "u-owner", { lines: LINES, discount: pct, unlocked: { nsSo: "SO5", billedAt: "2026-10-22" } });
  await TB.unlockTicketBillingFor(sql, billed, "u-owner", "NetSuite credit memo changed the labor");
  const unlocked = (scope) => sql.query(C.replaceUnlockedChargesSql(), [billed, ...arrays, true, [], null, "percent", 10, ["", ""], "SO5", "2026-10-22", false, scope, [false, true]]);
  assert.deepEqual(await unlocked(null), []);
  assert.deepEqual(await ticks(sql, billed), [true, false]);
  assert.equal((await unlocked("chosen")).length, 1);
  assert.deepEqual(await ticks(sql, billed), [false, true]);

  // Approving an install's invoice again, at the version the window opened.
  const inst = await install(sql);
  await I.approveInvoiceFor(sql, { type: "install", id: inst, lines: LINES, lineIds: [], discount: SENT, seen: null }, "u-owner");
  const version = (await one(sql, "select invoice_version('install', $1) as v", [inst])).v;
  const ih = await head(sql, "install", inst);
  const record = (scope) => sql.query(I.approveRecordInvoiceSql(), ["install", inst, CAFE, "percent", 10, null, null, null, null, 306, "chuy", version, ...arrays, null, false, [null, null], scope, [false, true]]);
  assert.deepEqual(await record(null), []);
  assert.deepEqual(await lineTicks(sql, ih.id), [true, false]);
  assert.equal((await record("chosen")).length, 1);
  assert.deepEqual(await lineTicks(sql, ih.id), [false, true]);

  // And a PM's.
  const pm = await pmJob(sql);
  await I.approveInvoiceFor(sql, { type: "pm", id: pm, lines: LINES, lineIds: [], discount: SENT, seen: null }, "u-owner");
  const ph = await head(sql, "pm", pm);
  const pmApprove = (scope) => sql.query(I.approvePmInvoiceSql(), ["pm", pm, CAFE, "percent", 10, null, null, null, null, 306, "chuy", ...arrays, null, false, scope, [false, true]]);
  assert.deepEqual(await pmApprove(null), []);
  assert.deepEqual(await lineTicks(sql, ph.id), [true, false]);
  assert.equal((await pmApprove("chosen")).length, 1);
  assert.deepEqual(await lineTicks(sql, ph.id), [false, true]);
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

/* ------------------------------------------------------------------ what goes out */

// Two part lines on the item list, A ticked and B not, for Parts Profit.
const PART_LINES = [
  { item: "PARTS : TEST-A", description: "", qty: 2, rate: 45, discountChosen: true },
  { item: "PARTS : TEST-B", description: "", qty: 1.5, rate: 150, discountChosen: false },
];
const partItems = (sql) => sql.query("insert into billing_items (sku, item, kind, rate, cost) values ('TEST-A', 'PARTS : TEST-A', 'part', 45, 20), ('TEST-B', 'PARTS : TEST-B', 'part', 150, 60)");

test("Export Billing: a chosen-lines ticket's header discount is the dollars off its ticked lines, and the file's total matches", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [], discount: pct });
  await sql.query("update service_jobs set completed_at = '2026-10-20' where id = $1", [job]);
  const out = await C.exportBillingFor(sql, { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(out.total, 306);
  const [header, ...rows] = out.csv.trim().split("\r\n").map((r) => r.split(","));
  const item = header.indexOf("Discount Item");
  const rate = header.indexOf("Discount Rate");
  assert.deepEqual(
    rows.map((r) => [r[item], r[rate]]),
    [
      ["CLDSERVICE", "-9.00"],
      ["CLDSERVICE", "-9.00"],
    ],
  );
});

test("the Invoices page reads a chosen-lines ticket's total on its ticked lines", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [], discount: pct });
  const net = (await TB.loadChargeNets(sql, [job])).get(job);
  assert.deepEqual([net.lines, net.subtotal, net.off, net.net], [2, 315, 9, 306]);
  assert.deepEqual(net.discount, pct);
});

test("the Parts Profit report gives a billed chosen-lines ticket's discount to its ticked lines", async () => {
  const { sql } = await fresh();
  await partItems(sql);
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: PART_LINES, lineIds: [], discount: pct });
  // Billed with no cost stored yet: the report works it out live.
  await sql.query("update service_jobs set ns_so = 'SO-PID-2', billed_at = '2026-10-21' where id = $1", [job]);
  const { lines } = await C.invoicedPartLines(sql, { from: null, to: null });
  assert.deepEqual(
    lines.map((l) => [l.sku, l.ticketDiscount]),
    [
      ["TEST-A", 9],
      ["TEST-B", 0],
    ],
  );
});

/* ------------------------------------------------------------------ Billing Backfill */

const CHARGES_HEAD = ["WO", "Source invoice #", "Source SO #", "PO", "NetSuite customer", "Location", "Item", "Item type", "Description", "Qty", "Rate", "Amount", "Discount Item", "Discount Amount", "Record total (after discount)"];
const INVOICES_HEAD = ["WO", "SO #", "SO status", "Invoice #", "Invoice date", "Invoice status", "Invoice total", "Amount remaining", "Charges source", "Corrigo net (reference)"];
/** A NetSuite export as the Backfill reads it (no cell here has a comma). */
const nsFile = (name, rows) => ({ name, base64: Buffer.from(rows.map((r) => r.join(",")).join("\n") + "\n").toString("base64") });
const nsInvoice = (wo, so, inv, total) => [wo, so, "Billed", inv, "2026-10-22", "Open", String(total), String(total), "Yes", ""];

test("the Billing Backfill checks a chosen-lines bill on its ticked lines", async () => {
  const { sql } = await fresh();
  const pm1 = await idOf(sql, "insert into pm_jobs (customer, wo, status) values ($1, 'WO-7701', 'Completed') returning id", [CAFE]);
  const pm2 = await idOf(sql, "insert into pm_jobs (customer, wo, status) values ($1, 'WO-7702', 'Completed') returning id", [CAFE]);
  for (const id of [pm1, pm2]) await I.approveInvoiceFor(sql, { type: "pm", id, lines: LINES, lineIds: [], discount: SENT, seen: null }, "u-owner");
  assert.deepEqual((await BF.loadKatzDeskInvoiceNets(sql, [], [pm1])).get(`pm:${pm1}`), { lines: 2, net: 306 });
  // NetSuite invoiced 306.00 on one and 315.00 on the other: only the second doesn't match.
  const f = [nsFile("invoices.csv", [INVOICES_HEAD, nsInvoice("WO-7701", "SO7701", "INV7701", 306), nsInvoice("WO-7702", "SO7702", "INV7702", 315)])];
  const by = Object.fromEntries((await BF.previewBillingBackfillFor(sql, f, "u-owner")).plans.map((x) => [x.wo, x]));
  assert.deepEqual([by["WO-7701"].amounts.kd, by["WO-7701"].amounts.nsMismatch], [306, false]);
  assert.deepEqual([by["WO-7702"].amounts.kd, by["WO-7702"].amounts.nsMismatch], [306, true]);
});

test("the Billing Backfill writes NetSuite's lines onto a chosen-lines ticket as Whole bill", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql, { wo: "WO-7801" });
  await sql.query("update service_jobs set completed_at = '2026-10-20' where id = $1", [job]);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [], discount: pct });
  // NetSuite has the same two lines, with its header discount of $9.00 off the order.
  const row = (item, type, qty, rate) => ["WO-7801", "INV7801", "SO7801", "", CAFE, "Houston - WH", item, type, "Line", String(qty), String(rate), String(qty * rate), "CLDSERVICE", "-9", "306"];
  const f = [
    nsFile("charges.csv", [CHARGES_HEAD, row("PARTS : TEST-A", "InvtPart", 2, 45), row("Service : SERVICELABOR", "Service", 1.5, 150)]),
    nsFile("invoices.csv", [INVOICES_HEAD, nsInvoice("WO-7801", "SO7801", "INV7801", 306)]),
  ];
  const p = await BF.previewBillingBackfillFor(sql, f, "u-owner");
  await BF.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [] });
  assert.deepEqual(await one(sql, "select discount_kind, discount_value::text as value, discount_scope from service_jobs where id = $1", [job]), { discount_kind: "amount", value: "9.00", discount_scope: "all" });
  assert.deepEqual(await ticks(sql, job), [false, false]);
  assert.equal((await C.loadTicketCharges(sql, job)).total, 306);
});

test("a NetSuite file with a ticket's lines but no discount keeps its chosen-lines discount as the dollars it took off", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql, { wo: "WO-7901" });
  await sql.query("update service_jobs set completed_at = '2026-10-20' where id = $1", [job]);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [], discount: pct });
  // No Discount Amount and no Record total: the file says nothing about a discount.
  const row = (item, type, qty, rate) => ["WO-7901", "INV7901", "SO7901", "", CAFE, "Houston - WH", item, type, "Line", String(qty), String(rate), String(qty * rate), "", "", ""];
  const f = [
    nsFile("charges.csv", [CHARGES_HEAD, row("PARTS : TEST-A", "InvtPart", 2, 45), row("Service : SERVICELABOR", "Service", 1.5, 150)]),
    nsFile("invoices.csv", [INVOICES_HEAD, nsInvoice("WO-7901", "SO7901", "INV7901", 306)]),
  ];
  const p = await BF.previewBillingBackfillFor(sql, f, "u-owner");
  assert.deepEqual([p.plans[0].charges.nextDiscount, p.plans[0].charges.nextNet], [{ kind: "amount", value: 9 }, 306]);
  await BF.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [] });
  assert.deepEqual(await one(sql, "select discount_kind, discount_value::text as value, discount_scope from service_jobs where id = $1", [job]), { discount_kind: "amount", value: "9.00", discount_scope: "all" });
  assert.equal((await C.loadTicketCharges(sql, job)).total, 306);
});

/* ------------------------------------------------------------------ merges */

/** A ticket with these charge lines and discount. */
async function billedTicket(sql, o, lines = LINES, discount = pct) {
  const job = await ticket(sql, o);
  await C.writeTicketCharges(sql, job, "u-owner", { lines, lineIds: [], discount });
  return job;
}
/** An install's invoice waiting for approval, with these lines (ticks as given) and discount. */
async function installInvoice(sql, inst, lines, discount) {
  const inv = await idOf(
    sql,
    "insert into invoices (entity_type, entity_id, customer, total, discount_kind, discount_value, discount_scope, submitted_by, submitted_at) values ('install', $1, $2, 0, $3, $4, $5, 'chuy', now()) returning id",
    [inst, CAFE, discount?.kind ?? null, discount?.value ?? null, discount?.scope ?? "all"],
  );
  for (const [i, l] of lines.entries()) {
    await sql.query("insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort, discount_chosen) values ($1, $2, '', $3, $4, 'part', $5, $6)", [inv, l.item, l.qty, l.rate, i + 1, !!l.discountChosen]);
  }
  return inv;
}
async function mergeIntoInstall(sql, job, inst) {
  const p = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: job, installId: inst });
  assert.equal(p.refusal ?? null, null, p.refusal);
  await M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId: job, installId: inst, stamps: p.stamps, billedSo: p.moves.billed?.so ?? "", billedOn: p.moves.billed?.on ?? "" });
  return p;
}
const C100 = { item: "PARTS : TEST-C", qty: 1, rate: 100, discountChosen: true };
const D100 = { item: "PARTS : TEST-D", qty: 1, rate: 100, discountChosen: false };

test("merging a ticket into an install never changes what a line pays", async () => {
  const { sql } = await fresh();
  // An empty install takes the ticket's Chosen-lines discount, ticks and all.
  const j1 = await billedTicket(sql, { wo: "WO-8101", status: "Scheduled" });
  const i1 = await install(sql, { wo: "WO-8101" });
  assert.equal((await mergeIntoInstall(sql, j1, i1)).moves.invoiceTotal, 306);
  const h1 = await head(sql, "install", i1);
  assert.deepEqual([h1.total, h1.discount_scope, await lineTicks(sql, h1.id)], ["306.00", "chosen", [true, false]]);
  // Its own 10% on the Whole bill and the ticket's 10% on Chosen lines: Chosen lines, its own line ticked.
  const j2 = await billedTicket(sql, { wo: "WO-8102", status: "Scheduled" });
  const i2 = await install(sql, { wo: "WO-8102" });
  const inv2 = await installInvoice(sql, i2, [{ ...C100, discountChosen: false }], { kind: "percent", value: 10 });
  await mergeIntoInstall(sql, j2, i2);
  const h2 = await head(sql, "install", i2);
  assert.deepEqual([h2.total, h2.discount_scope, await lineTicks(sql, inv2)], ["396.00", "chosen", [true, true, false]]);
  // The ticket on the Whole bill, the install on Chosen lines: the ticket's lines come in ticked.
  const j3 = await billedTicket(sql, { wo: "WO-8103", status: "Scheduled" }, LINES, { kind: "percent", value: 10, scope: "all" });
  const i3 = await install(sql, { wo: "WO-8103" });
  const inv3 = await installInvoice(sql, i3, [C100, D100], { kind: "percent", value: 10, scope: "chosen" });
  await mergeIntoInstall(sql, j3, i3);
  const h3 = await head(sql, "install", i3);
  assert.deepEqual([h3.total, h3.discount_scope, await lineTicks(sql, inv3)], ["473.50", "chosen", [true, false, true, true]]);
  // Different discounts still don't merge.
  const j4 = await billedTicket(sql, { wo: "WO-8104", status: "Scheduled" });
  const i4 = await install(sql, { wo: "WO-8104" });
  await installInvoice(sql, i4, [C100], { kind: "percent", value: 15, scope: "all" });
  assert.match((await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: j4, installId: i4 })).refusal, /has a 10% discount and Install #\d+'s invoice has 15%; merged, only one would apply/);
});

test("a ticket merged into an install as billed keeps which lines took its discount", async () => {
  const { sql } = await fresh();
  const job = await billedTicket(sql, { wo: "WO-8201", status: "Completed" });
  await sql.query("update service_jobs set ns_so = 'SO8201', billed_at = now() where id = $1", [job]);
  const inst = await install(sql, { wo: "WO-8201" });
  await mergeIntoInstall(sql, job, inst);
  const billed = (await I.getInvoiceFor(sql, { type: "install", id: inst }, "u-owner")).billedElsewhere[0];
  assert.deepEqual([billed.lines.map((l) => l.discounted), billed.total], [[true, false], 306]);
  // A merge logged before 11/7 didn't say: every line took the discount.
  await sql.query("update ticket_install_merges set moved = jsonb_set(moved, '{billedLines}', (select jsonb_agg(x - 'discounted') from jsonb_array_elements(moved->'billedLines') x)) where job_id = $1", [job]);
  assert.deepEqual((await I.getInvoiceFor(sql, { type: "install", id: inst }, "u-owner")).billedElsewhere[0].lines.map((l) => l.discounted), [true, true]);
});

test("merging duplicate WOs never changes what a line pays", async () => {
  const { sql } = await fresh();
  const tickTotal = async (id) => (await C.loadTicketCharges(sql, id)).total;
  // An empty keeper takes the extra's Chosen-lines discount, ticks and all.
  const k1 = await ticket(sql, { wo: "WO-8301", status: "Open" });
  const e1 = await billedTicket(sql, { wo: "WO-8301", status: "Open" });
  await WD.mergeServiceJobs(sql, k1, e1, "Chuy");
  assert.deepEqual([(await one(sql, "select discount_scope from service_jobs where id = $1", [k1])).discount_scope, await ticks(sql, k1), await tickTotal(k1)], ["chosen", [true, false], 306]);
  // A keeper at 10% on the Whole bill takes an extra at 10% on Chosen lines: its own line ticked, the totals added.
  const k2 = await billedTicket(sql, { wo: "WO-8302", status: "Open" }, [{ item: "PARTS : TEST-C", description: "", qty: 1, rate: 100 }], { kind: "percent", value: 10, scope: "all" });
  const e2 = await billedTicket(sql, { wo: "WO-8302", status: "Open" });
  const before = (await tickTotal(k2)) + (await tickTotal(e2));
  await WD.mergeServiceJobs(sql, k2, e2, "Chuy");
  assert.deepEqual([(await one(sql, "select discount_scope from service_jobs where id = $1", [k2])).discount_scope, await ticks(sql, k2), await tickTotal(k2)], ["chosen", [true, true, false], before]);
  assert.equal(before, 396);
});

test("Merge installs moves a chosen-lines invoice as it is", async () => {
  const { sql } = await fresh();
  const keep = await install(sql, { wo: "WO-8401" });
  const drop = await install(sql, { wo: "WO-8402" });
  await I.approveInvoiceFor(sql, { type: "install", id: drop, lines: LINES, lineIds: [], discount: SENT, seen: null }, "u-owner");
  await IP.mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
  const h = await head(sql, "install", keep);
  assert.deepEqual([h.total, h.discount_scope, await lineTicks(sql, h.id)], ["306.00", "chosen", [true, false]]);
  assert.equal((await I.getInvoiceFor(sql, { type: "install", id: keep }, "u-owner")).total, 306);
});

/* ------------------------------------------------------------------ the Charges panel and the Invoice window */

test("the discount box offers Whole bill or Chosen lines, a Discount tick on each line with All and None, and says what it comes off", () => {
  const controls = src("src/components/desk/discount-controls.tsx");
  for (const name of ["ScopePicker", "ChosenBar", "LineTick"]) assert.match(controls, new RegExp(`export function ${name}\\(`), name);
  // The two pills, like Percent / Amount, with their testids.
  assert.match(controls, /\(\["all", "chosen"\] as const\)\.map\(\(s\) =>/);
  assert.match(controls, /data-testid=\{`discount-scope-\$\{s\}`\}/);
  assert.match(controls, /\{s === "all" \? "Whole bill" : "Chosen lines"\}/);
  assert.match(controls, /aria-pressed=\{scope === s\}/);
  // "Comes off 3 of 5 lines", with All and None.
  assert.match(controls, /Comes off \{chosen\} of \{lines\} line\{lines === 1 \? "" : "s"\}/);
  assert.match(controls, /data-testid="discount-chosen-count"/);
  assert.match(controls, /data-testid="discount-chosen-all"[^>]*>\s*All\s*</);
  assert.match(controls, /data-testid="discount-chosen-none"[^>]*>\s*None\s*</);
  // The tick: labelled "Discount", named for its line, a 40px row on phones.
  assert.match(controls, /aria-label=\{`Discount \$\{item\}`\}/);
  assert.match(controls, /data-testid="line-discount-tick"/);
  assert.match(controls, />\s*Discount\s*<\/label>/);
  assert.ok((controls.match(/max-sm:h-10/g) ?? []).length >= 3, "the pills, All / None and the tick row are 40px on phones");

  for (const path of ["src/components/desk/charges-panel.tsx", "src/components/desk/invoice-window.tsx"]) {
    const panel = src(path);
    assert.match(panel, /import \{ ChosenBar, LineTick, ScopePicker \} from "\.\/discount-controls";/, path);
    // Saves say the scope, and each line its tick.
    assert.match(panel, /\{ kind: discKind, value: discValue, scope: discScope \}/, path);
    assert.match(panel, /discountChosen: l\.discountChosen/, path);
    // What it comes off, in the totals; nothing ticked is refused before the save.
    assert.match(panel, /Discount\{discount \? ` · \$\{discountOffLabel\(discount, /, path);
    assert.match(panel, /chosenDiscountError\(/, path);
    // Chosen lines ticks every line, Whole bill none; a line added comes in unticked; clearing the value is Whole bill.
    assert.match(panel, /(cur|\(cur \?\? \[\]\))\.map\(\(l\) => \(\{ \.\.\.l, discountChosen: s === "chosen" \}\)\)/, path);
    assert.match(panel, /\[\.\.\.(cur|\(cur \?\? \[\]\)), \{ \.\.\.l, discountChosen: false \}\]/, path);
    assert.match(panel, /if \(!e\.target\.value\.trim\(\)\) pickScope\("all"\);/, path);
    // The pills once a discount is typed; the ticks and the bar on Chosen lines only.
    assert.match(panel, /\{(!v\.partsOnly && )?discValue\.trim\(\) \? \(\n\s+<div className="mt-3">\n\s+<ScopePicker /, path);
    assert.match(panel, /\{chosen \? <LineTick /, path);
    assert.match(panel, /\{chosen \? \(\n\s+<ChosenBar\n/, path);
  }
  // Save and Approve wait for a tick.
  const charges = src("src/components/desk/charges-panel.tsx");
  assert.equal(charges.match(/\|\| !!tickError/g)?.length, 2, "Save Charges and Save And Lock");
  const win = src("src/components/desk/invoice-window.tsx");
  assert.match(win, /const blocked = problem \?\? tickError;/);
  assert.equal(win.match(/disabled=\{busy \|\| !!blocked/g)?.length, 2, "Save for Approval and Approve");
  // Warehouse invoices still take no discount: no pills, no ticks.
  assert.match(win, /const tickError = v\?\.partsOnly \? null : chosenDiscountError\(/);
  assert.match(win, /\{!v\.partsOnly && discValue\.trim\(\) \? \(/);
  // A ticket merged in as billed: which of its lines took its discount.
  assert.match(win, /\{!l\.discounted && off > 0\.004 \? " · no discount" : ""\}/);
  assert.match(win, /Discount\{took < b\.lines\.length \? ` · off \$\{took\} of \$\{b\.lines\.length\} lines` : ""\}/);
});
