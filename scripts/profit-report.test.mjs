// The Profit report (Chuy, 11/20, PR 5 of part cost and profit): revenue, cost and margin by job type and by customer,
// for a date range, with downloads. Each bill counts once. Invoices before 2026 count as revenue with no cost; 2026 lines
// not stored yet are "estimated". Who sees it follows Who Sees Cost and Margin and its labor switch. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const C = await import("../src/lib/ops/charges-api.ts");
const I = await import("../src/lib/ops/invoice-api.ts");
const P = await import("../src/lib/ops/part-pricing-api.ts");
const CA = await import("../src/lib/ops/cost-access.ts");
const R = await import("../src/lib/ops/profit-report-api.ts");
const PR = await import("../src/lib/ops/profit-report.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

let last = null;
let calls = 0;
async function fresh() {
  if (last) await last.close().catch(() => {});
  const pg = new PGlite();
  last = pg;
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'), ('u-desk', 'dana', true, false, 'service')`,
  );
  await pg.query("insert into billing_items (sku, item, kind, rate, cost) values ('TEST-A', 'PARTS : TEST-A', 'part', 45, 20)");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await P.saveLaborRate(sql, 30);
  return sql;
}
const idOf = async (sql, text, params) => Number((await sql.query(text, params))[0].id);
// 150 trip + 300 labor (2 h) + 90 parts = 540 sell; 0 + 60 + 40 = 100 cost; 440 margin.
const LINES = [
  { item: "Service : TRIPCHARGE", description: "", qty: 1, rate: 150 },
  { item: "Service : SERVICELABOR", description: "", qty: 2, rate: 150 },
  { item: "PARTS : TEST-A", description: "", qty: 2, rate: 45 },
];
async function billedTicket(sql, customer, billed, o = {}) {
  const job = await idOf(sql, "insert into service_jobs (kind, call_id, customer, status, received, completed_at) values ($1, $2, $3, 'Completed', $4, $4) returning id", [o.kind ?? "service", `SC-PR-${++calls}`, customer, billed]);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [] });
  await C.recordTicketSalesOrder(sql, job, "u-owner", `SO-PR-${calls}`, billed);
  return job;
}
async function approved(sql, type, customer) {
  const id =
    type === "pm"
      ? await idOf(sql, "insert into pm_jobs (customer, wo, status) values ($1, $2, 'Completed') returning id", [customer, `WO-PR-${++calls}`])
      : type === "install"
        ? await idOf(sql, "insert into installs (customer, complete, equip_status, archived) values ($1, false, 'Not Ready', false) returning id", [customer])
        : await idOf(sql, "insert into deals (customer) values ($1) returning id", [customer]);
  await I.approveInvoiceFor(sql, { type, id, lines: LINES, lineIds: [], discount: null, seen: null }, "u-owner");
  return id;
}
const ALL = { from: null, to: null };

test("each job type and customer totals its bills; margin is net less cost", async () => {
  const sql = await fresh();
  await billedTicket(sql, "Alpha Cafe", "2026-10-05");
  await billedTicket(sql, "Alpha Cafe", "2026-10-06", { kind: "tlc" });
  await approved(sql, "pm", "Beta Bakery");
  await approved(sql, "deal", "Beta Bakery");
  await approved(sql, "install", "Alpha Cafe");
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  const t = Object.fromEntries(r.byType.map((x) => [x.key, [x.bills, x.sell, x.cost, x.margin]]));
  assert.deepEqual(t, { service: [1, 540, 100, 440], tlc: [1, 540, 100, 440], pm: [1, 540, 100, 440], install: [1, 540, 100, 440], deal: [1, 540, 100, 440] });
  const c = Object.fromEntries(r.byCustomer.map((x) => [x.label, [x.bills, x.sell, x.margin]]));
  assert.deepEqual(c, { "Alpha Cafe": [3, 1620, 1320], "Beta Bakery": [2, 1080, 880] });
  assert.deepEqual([r.totals.bills, r.totals.sell, r.totals.cost, r.totals.margin, r.totals.marginPct], [5, 2700, 500, 2200, 81.48]);
});

test("a date range keeps bills inside it; before 2026 a bill counts as sell with no cost", async () => {
  const sql = await fresh();
  await billedTicket(sql, "Alpha Cafe", "2025-12-15");
  await billedTicket(sql, "Alpha Cafe", "2026-03-01");
  const all = await R.profitReportFor(sql, ALL, "u-owner");
  assert.deepEqual([all.totals.bills, all.totals.sell, all.totals.cost, all.totals.margin, all.totals.uncostedSell, all.totals.before2026], [2, 1080, 100, 440, 540, 1]);
  const spring = await R.profitReportFor(sql, { from: "2026-02-01", to: "2026-04-30" }, "u-owner");
  assert.deepEqual([spring.totals.bills, spring.totals.sell], [1, 540]);
});

test("a line not stored yet is estimated", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, null);
  await billedTicket(sql, "Alpha Cafe", "2026-10-05");
  await P.saveLaborRate(sql, 30);
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.deepEqual([r.totals.estimated, r.totals.margin], [1, 440], "labor invoiced before the rate was set is priced live");
});

test("each bill counts once: NetSuite's lines over the install's own invoice; a merged ticket and a PM billed on a ticket aren't counted again", async () => {
  const sql = await fresh();
  const inst = await approved(sql, "install", "Alpha Cafe");
  const b = await idOf(sql, "insert into record_ns_billing (install_id, wo, wo_key, ns_so, billed_at) values ($1, 'WO-9', '9', 'SO-9', '2026-10-20') returning id", [inst]);
  await sql.query("insert into record_ns_charges (billing_id, item, qty, rate, kind, sort) values ($1, 'PARTS : TEST-A', 4, 45, 'part', 1)", [b]);
  const { storeLineCosts } = await import("../src/lib/ops/line-cost.ts");
  await storeLineCosts(sql, "record_ns_charges", b, null);
  const keeper = await billedTicket(sql, "Beta Bakery", "2026-10-05");
  const dup = await billedTicket(sql, "Beta Bakery", "2026-10-05");
  await sql.query("update service_jobs set duplicate_of = $1 where id = $2", [keeper, dup]);
  const pm = await idOf(sql, "insert into pm_jobs (customer, wo, status, stacked_job_id) values ('Beta Bakery', 'WO-PR-S', 'Completed', $1) returning id", [keeper]);
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  const t = Object.fromEntries(r.byType.map((x) => [x.key, [x.bills, x.sell, x.cost]]));
  assert.deepEqual(t.install, [1, 180, 80], "NetSuite's 4 parts, not the invoice's 540");
  assert.deepEqual(t.service, [1, 540, 100]);
  assert.equal(t.pm, undefined, `PM ${pm} bills on its ticket`);
});

test("only someone who sees cost gets the report; with the labor switch off, labor is left out", async () => {
  const sql = await fresh();
  await billedTicket(sql, "Alpha Cafe", "2026-10-05");
  await assert.rejects(R.profitReportFor(sql, ALL, "u-desk"), /Profit shows cost and margin/);
  await assert.rejects(R.profitReportFileFor(sql, { filters: ALL, format: "xlsx" }, "u-desk"), /Profit shows cost and margin/);
  await CA.saveCostOptions(sql, { roles: ["service"], showLabor: false, warehouseRebuilds: false });
  const r = await R.profitReportFor(sql, ALL, "u-desk");
  assert.deepEqual([r.totals.sell, r.totals.cost, r.totals.margin, r.laborHidden], [240, 40, 200, true]);
  const f = await R.profitReportFileFor(sql, { filters: ALL, format: "xlsx" }, "u-desk");
  assert.match(f.filename, /^KatzDesk-Profit-\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.ok(f.records >= 1);
  await CA.saveCostOptions(sql, { roles: ["service"], showLabor: true, warehouseRebuilds: false });
  assert.equal((await R.profitReportFor(sql, ALL, "u-desk")).totals.sell, 540);
});

test("the group totals: margin only over bills with every cost known", () => {
  const g = PR.groupTotals([
    { type: "service", customer: "A", date: "2026-01-02", sell: 100, discount: 10, cost: 30, margin: 60, estimated: false, before2026: false },
    { type: "service", customer: "A", date: "2026-01-03", sell: 50, discount: 0, cost: 5, margin: null, estimated: true, before2026: false },
  ]);
  assert.deepEqual(g, { bills: 2, sell: 150, discount: 10, cost: 30, margin: 60, marginPct: 66.67, uncostedSell: 50, estimated: 1, before2026: 0 });
});

test("Analytics offers Profit and Parts Profit to anyone who sees cost", () => {
  const a = readFileSync(new URL("../src/routes/_app/analytics.tsx", import.meta.url), "utf8");
  assert.match(a, /getCostVisibility/);
  assert.match(a, /data-testid="analytics-view-profit-all"/);
  assert.doesNotMatch(a, /const isAdmin = /);
});

test("review: an install flagged as a possible duplicate still counts; one merged into another doesn't", async () => {
  const sql = await fresh();
  const keep = await approved(sql, "install", "Alpha Cafe");
  const flagged = await approved(sql, "install", "Alpha Cafe");
  await sql.query("update installs set duplicate_of = $1 where id = $2", [keep, flagged]);
  let r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.equal(r.byType.find((x) => x.key === "install").bills, 2);
  await sql.query("update installs set archived = true where id = $1", [flagged]);
  r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.equal(r.byType.find((x) => x.key === "install").bills, 1);
});

test("review: NetSuite lines with no Sales Order date are dated when written, so the bill isn't lost", async () => {
  const sql = await fresh();
  const pm = await approved(sql, "pm", "Beta Bakery");
  const b = await idOf(sql, "insert into record_ns_billing (pm_id, wo, wo_key, updated_at) values ($1, 'WO-8', '8', '2026-10-15T15:00:00Z') returning id", [pm]);
  await sql.query("insert into record_ns_charges (billing_id, item, qty, rate, kind, sort) values ($1, 'PARTS : TEST-A', 2, 45, 'part', 1)", [b]);
  const r = await R.profitReportFor(sql, { from: "2026-10-01", to: "2026-10-31" }, "u-owner");
  assert.deepEqual(r.byType.map((x) => [x.key, x.bills, x.sell]), [["pm", 1, 90]]);
});

test("review: a ticket billed by a NetSuite invoice alone is dated by that invoice, in range", async () => {
  const sql = await fresh();
  const job = await idOf(sql, "insert into service_jobs (kind, call_id, customer, status, received) values ('service', 'SC-PR-INV', 'Alpha Cafe', 'Open', '2025-11-02') returning id");
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES.slice(2), lineIds: [] });
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, invoice_date, status, total, amount_remaining, source) values ($1, 'INV-PR-1', '2026-03-04', 'Open', 90, 90, 'standalone')", [job]);
  const r = await R.profitReportFor(sql, { from: "2026-01-01", to: "2026-12-31" }, "u-owner");
  assert.deepEqual([r.totals.bills, r.totals.sell, r.totals.before2026], [1, 90, 0]);
});

test("review: dates are Chicago days: an approval on New Year's Eve evening is a 2025 bill", async () => {
  const sql = await fresh();
  const deal = await approved(sql, "deal", "Alpha Cafe");
  await sql.query("update invoices set approved_at = '2026-01-01T03:00:00Z' where entity_type = 'deal' and entity_id = $1", [deal]);
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.deepEqual([r.totals.before2026, r.totals.margin], [1, 0]);
});

test("review: a standalone rebuild invoice counts as Rebuild; customers group by their current name, any case", async () => {
  const sql = await fresh();
  const rb = await idOf(sql, "insert into rebuilds (title, account, status) values ('Refurb', 'Gamma Grind', 'Done') returning id");
  await I.approveInvoiceFor(sql, { type: "rebuild", id: rb, lines: LINES.slice(2), lineIds: [], discount: null, seen: null }, "u-owner");
  await billedTicket(sql, "gamma grind ", "2026-10-05");
  await sql.query("update invoices set customer = 'Old Gamma Name' where entity_type = 'rebuild'");
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.deepEqual(r.byType.find((x) => x.key === "rebuild").sell, 90);
  assert.deepEqual(r.byCustomer.map((x) => [x.bills, x.sell]), [[2, 630]]);
});

test("review: Warehouse never gets Profit or Parts Profit (it doesn't read customers' billing)", async () => {
  const sql = await fresh();
  await sql.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-wh', 'wes', true, false, 'warehouse')");
  await CA.saveCostOptions(sql, { roles: ["warehouse"], showLabor: true, warehouseRebuilds: true });
  await assert.rejects(R.profitReportFor(sql, ALL, "u-wh"), /Profit/);
  assert.equal((await R.costVisibilityFor(sql, "u-wh")).showReports, false);
  assert.equal((await R.costVisibilityFor(sql, "u-owner")).showReports, true);
});

test("review: Cost adds up the bills with a margin, so Sell − Discount − Cost = Margin", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, null);
  await billedTicket(sql, "Alpha Cafe", "2026-10-05");
  await P.saveLaborRate(sql, 30);
  await sql.query("insert into billing_items (sku, item, kind, rate) values ('TEST-N', 'PARTS : TEST-N', 'part', 10)");
  const job = await idOf(sql, "insert into service_jobs (kind, call_id, customer, status, received, completed_at) values ('service', 'SC-PR-N', 'Alpha Cafe', 'Completed', '2026-10-07', '2026-10-07') returning id");
  await C.writeTicketCharges(sql, job, "u-owner", { lines: [{ item: "PARTS : TEST-A", description: "", qty: 1, rate: 45 }, { item: "PARTS : TEST-N", description: "", qty: 1, rate: 10 }], lineIds: [] });
  await C.recordTicketSalesOrder(sql, job, "u-owner", "SO-PR-N", "2026-10-07");
  const t = (await R.profitReportFor(sql, ALL, "u-owner")).totals;
  assert.deepEqual([t.sell, t.cost, t.margin, t.uncostedSell], [595, 100, 440, 55]);
  assert.equal(t.sell - t.discount - t.cost - t.uncostedSell, t.margin);
});

test("migration 0134 only adds the item-name index", () => {
  const m = readFileSync(new URL("0134_billing_items_item_index.sql", MIGRATIONS), "utf8").replace(/--.*$/gm, "").trim();
  assert.equal(m, "create index if not exists billing_items_item_lower_idx on billing_items (lower(btrim(item)));");
});
