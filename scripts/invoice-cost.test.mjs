// Cost on PM, install, rebuild and deal invoices (Chuy, 11/20, PR 4 of part cost and profit): each line's cost and
// margin is stored when the invoice is approved in the Invoice window, and when NetSuite's lines come in through
// Billing Backfill. Parts at their Purchase Price (else Our Discount Rule), labor at the Labor Cost Rate, the trip at no
// cost. Who sees it follows Who Sees Cost and Margin; the labor rate stays Admin only. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const I = await import("../src/lib/ops/invoice-api.ts");
const P = await import("../src/lib/ops/part-pricing-api.ts");
const CA = await import("../src/lib/ops/cost-access.ts");
const BF = await import("../src/lib/ops/billing-backfill-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const CAFE = "Test Bean Cafe - Heights";

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
  return Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
}
const one = async (sql, text, params = []) => (await sql.query(text, params))[0];
const idOf = async (sql, text, params) => Number((await one(sql, text, params)).id);
const records = async (sql) => ({
  pm: await idOf(sql, "insert into pm_jobs (customer, wo, status) values ($1, $2, 'Completed') returning id", [CAFE, `WO-IC-${++calls}`]),
  install: await idOf(sql, "insert into installs (customer, complete, equip_status, archived) values ($1, false, 'Not Ready', false) returning id", [CAFE]),
  deal: await idOf(sql, "insert into deals (customer) values ($1) returning id", [CAFE]),
  rebuild: await idOf(sql, "insert into rebuilds (title, account, status) values ('Test refurb', $1, 'In progress') returning id", [CAFE]),
});
const LINES = [
  { item: "Service : TRIPCHARGE", description: "", qty: 1, rate: 150 },
  { item: "Service : SERVICELABOR", description: "", qty: 2, rate: 150 },
  { item: "PARTS : TEST-A", description: "", qty: 2, rate: 45 },
];
const stored = async (sql, type, id) =>
  (
    await sql.query(
      `select l.kind, l.unit_cost::text as u, l.cost_source as s, l.line_discount::text as d, l.margin::text as m, l.priced_at is not null as p
         from invoice_lines l join invoices v on v.id = l.invoice_id where v.entity_type = $1 and v.entity_id = $2 order by l.sort, l.id`,
      [type, id],
    )
  ).map((r) => [r.kind, r.u, r.s, r.d, r.m, r.p]);

test("migration 0133 only adds the cost columns to invoice lines and NetSuite's record lines", () => {
  const m = readFileSync(new URL("0133_invoice_line_cost.sql", MIGRATIONS), "utf8").replace(/--.*$/gm, "");
  assert.doesNotMatch(m, /\b(drop|delete|update|truncate|rename)\b/i);
  for (const t of ["invoice_lines", "record_ns_charges"]) {
    for (const c of ["unit_cost", "cost_source", "line_discount", "margin", "priced_at"]) assert.match(m, new RegExp(`alter table ${t} add column if not exists ${c}\\b`), `${t}.${c}`);
  }
});

test("approving a PM, install, deal or rebuild invoice stores each line's cost and margin, discount included", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 30);
  const ids = await records(sql);
  for (const [type, id] of Object.entries(ids)) {
    await I.approveInvoiceFor(sql, { type, id, lines: LINES, lineIds: [], discount: { kind: "percent", value: "10", scope: "all" }, seen: null }, "u-owner");
    // 540 sell (150 + 300 + 90), 10% off: 54 spread by amount, 15 / 30 / 9.
    assert.deepEqual(await stored(sql, type, id), [
      ["trip", "0.00", "trip", "15.00", "135.00", true],
      ["labor", "30.00", "labor", "30.00", "210.00", true],
      ["part", "20.00", "purchase", "9.00", "41.00", true],
    ], type);
  }
});

test("a later rate change leaves an approved invoice; approving again prices it fresh", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 30);
  const { deal } = await records(sql);
  await I.approveInvoiceFor(sql, { type: "deal", id: deal, lines: LINES, lineIds: [], discount: null, seen: null }, "u-owner");
  await P.saveLaborRate(sql, 40);
  let v = await I.getInvoiceFor(sql, { type: "deal", id: deal }, "u-owner");
  assert.deepEqual([v.profit[1].cost, v.profit[1].stored], [60, true]);
  const seen = v.version;
  await I.approveInvoiceFor(sql, { type: "deal", id: deal, lines: LINES, lineIds: [], discount: null, seen }, "u-owner");
  v = await I.getInvoiceFor(sql, { type: "deal", id: deal }, "u-owner");
  assert.deepEqual([v.profit[1].cost, v.profitTotals.cost, v.profitTotals.margin], [80, 120, 420]);
});

test("labor approved before the Labor Cost Rate is set stays live, so it prices once the rate is set", async () => {
  const sql = await fresh();
  const { pm } = await records(sql);
  await I.approveInvoiceFor(sql, { type: "pm", id: pm, lines: LINES, lineIds: [], discount: null, seen: null }, "u-owner");
  assert.equal((await stored(sql, "pm", pm))[1][5], false);
  await P.saveLaborRate(sql, 31);
  const v = await I.getInvoiceFor(sql, { type: "pm", id: pm }, "u-owner");
  assert.deepEqual([v.profit[1].cost, v.profit[1].stored], [62, false]);
});

test("the Invoice window's cost follows Who Sees Cost and Margin; the rate goes only to an Admin; a ticket's is on its Charges", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 30);
  const { install } = await records(sql);
  await I.approveInvoiceFor(sql, { type: "install", id: install, lines: LINES, lineIds: [], discount: null, seen: null }, "u-owner");
  const off = await I.getInvoiceFor(sql, { type: "install", id: install }, "u-desk");
  assert.deepEqual([off.profit, off.profitTotals], [null, null]);
  // The labor switch on (cost-options.test.mjs has it off).
  await CA.saveCostOptions(sql, { roles: ["service"], showLabor: true, warehouseRebuilds: false });
  const on = await I.getInvoiceFor(sql, { type: "install", id: install }, "u-desk");
  assert.deepEqual([on.profit[1].cost, on.profit[1].unitCost, on.profit[2].unitCost], [60, null, 20]);
  assert.deepEqual(on.profitTotals, { sell: 540, ticketDiscount: 0, cost: 100, margin: 440, marginPct: 81.48, noCost: 0, laborHidden: false });
  const admin = await I.getInvoiceFor(sql, { type: "install", id: install }, "u-owner");
  assert.equal(admin.profit[1].unitCost, 30);
  const job = await idOf(sql, "insert into service_jobs (kind, call_id, customer, status, received) values ('service', 'SC-IC-1', $1, 'Completed', '2026-10-20') returning id", [CAFE]);
  assert.equal((await I.getInvoiceFor(sql, { type: "service", id: job }, "u-owner")).profit, null, "a ticket's cost is on its Charges panel");
});

test("NetSuite's lines on an install, from Billing Backfill, get their cost and margin stored", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 30);
  const inst = await idOf(sql, "insert into installs (customer, wo, received, completed_at, complete, equip_status, technician, archived) values ($1, 'WO-7001', '2026-10-01', '2026-10-20', true, 'Installed', 'Test Tech', false) returning id", [CAFE]);
  const csv = (rows) => rows.map((r) => r.join(",")).join("\n") + "\n";
  const file = (name, rows) => ({ name, base64: Buffer.from(csv(rows)).toString("base64") });
  const f = [
    file("charges.csv", [
      ["WO", "Source invoice #", "Source SO #", "PO", "NetSuite customer", "Location", "Item", "Item type", "Description", "Qty", "Rate", "Amount", "Discount Item", "Discount Amount", "Record total (after discount)"],
      ["WO-7001", "INV7001", "SO7001", "", CAFE, "Houston - WH", "PARTS : TEST-A", "InvtPart", "a", "2", "45", "90", "", "", ""],
      ["WO-7001", "INV7001", "SO7001", "", CAFE, "Houston - WH", "Service : SERVICELABOR", "Service", "b", "1", "150", "150", "", "", ""],
    ]),
    file("invoices.csv", [
      ["WO", "SO #", "SO status", "Invoice #", "Invoice date", "Invoice status", "Invoice total", "Amount remaining", "Charges source", "Corrigo net (reference)"],
      ["WO-7001", "SO7001", "Billed", "INV7001", "10/28/2026", "Open", "240", "240", "Yes", ""],
    ]),
  ];
  const p = await BF.previewBillingBackfillFor(sql, f, "u-owner");
  await BF.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [] });
  const rows = (
    await sql.query(
      `select c.kind, c.unit_cost::text as u, c.cost_source as s, c.margin::text as m, c.priced_at is not null as p
         from record_ns_charges c join record_ns_billing b on b.id = c.billing_id where b.install_id = $1 order by c.sort, c.id`,
      [inst],
    )
  ).map((r) => [r.kind, r.u, r.s, r.m, r.p]);
  assert.deepEqual(rows, [
    ["part", "20.00", "purchase", "50.00", true],
    ["labor", "30.00", "labor", "120.00", true],
  ]);
});

test("the Invoice window shows each saved line's cost and the bill's total", () => {
  const w = readFileSync(new URL("../src/components/desk/invoice-window.tsx", import.meta.url), "utf8");
  assert.match(w, /!dirty && v\.profit\?\.\[i\] \? <LineProfitRow/);
  assert.match(w, /<ProfitTotalsRow t=\{v\.profitTotals\} testId="invoice-profit-total" \/>/);
});

test("a Chosen-lines or dollar discount, a rule-priced part, and a part with no cost (left live)", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 30);
  await sql.query("insert into billing_items (sku, item, kind, rate, list_price) values ('TEST-R', 'PARTS : TEST-R', 'part', 80, 100), ('TEST-N', 'PARTS : TEST-N', 'part', 10, null)");
  await sql.query("insert into desk_settings (key, value) values ('our_discount_rule', $1)", [JSON.stringify({ mode: "percent", value: 40 })]);
  const { deal, pm } = await records(sql);
  const lines = [
    { item: "PARTS : TEST-R", description: "", qty: 1, rate: 80, discountChosen: true },
    { item: "Service : SERVICELABOR", description: "", qty: 1, rate: 150, discountChosen: false },
    { item: "PARTS : TEST-N", description: "", qty: 1, rate: 10, discountChosen: false },
  ];
  await I.approveInvoiceFor(sql, { type: "deal", id: deal, lines, lineIds: [], discount: { kind: "percent", value: "10", scope: "chosen" }, seen: null }, "u-owner");
  assert.deepEqual(await stored(sql, "deal", deal), [
    ["part", "60.00", "rule", "8.00", "12.00", true],
    ["labor", "30.00", "labor", "0.00", "120.00", true],
    ["part", null, null, null, null, false],
  ]);
  let v = await I.getInvoiceFor(sql, { type: "deal", id: deal }, "u-owner");
  assert.deepEqual([v.profit[2].source, v.profitTotals.noCost, v.profitTotals.margin], ["none", 1, null]);
  await sql.query("update billing_items set cost = 4 where sku = 'TEST-N'");
  v = await I.getInvoiceFor(sql, { type: "deal", id: deal }, "u-owner");
  assert.deepEqual([v.profit[2].cost, v.profit[2].stored, v.profitTotals.margin], [4, false, 138]);
  await I.approveInvoiceFor(sql, { type: "pm", id: pm, lines: lines.map(({ discountChosen: _t, ...l }) => l), lineIds: [], discount: { kind: "amount", value: "24", scope: "all" }, seen: null }, "u-owner");
  // $24 off 240, spread 8 / 15 / 1; TEST-N has its $4 cost by now, so all three are stored.
  assert.deepEqual((await stored(sql, "pm", pm)).map((r) => [r[3], r[5]]), [["8.00", true], ["15.00", true], ["1.00", true]]);
});

test("unlinking a rebuild brings its lines back onto its own approved invoice, with their cost stored", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 30);
  const L = await import("../src/lib/ops/rebuild-link-api.ts");
  const rb = await idOf(sql, "insert into rebuilds (title, account, status) values ('Test refurb', $1, 'In progress') returning id", [CAFE]);
  const inv = await idOf(sql, "insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('rebuild', $1, $2, 240, 'chuy', '2026-11-01T15:00:00Z') returning id", [rb, CAFE]);
  await sql.query("insert into invoice_lines (invoice_id, item, qty, rate, kind, sort) values ($1, 'PARTS : TEST-A', 2, 45, 'part', 1), ($1, 'Service : SERVICELABOR', 1, 150, 'labor', 2)", [inv]);
  const inst = await idOf(sql, "insert into installs (customer, complete, equip_status, archived) values ($1, false, 'Not Ready', false) returning id", [CAFE]);
  await sql.query("insert into install_work_orders (install_id, wo, match_key) values ($1, 'WO-5100', '5100')", [inst]);
  const f = await L.findRebuildLinksFor(sql, { id: rb, wo: "5100" }, "u-owner");
  const cand = f.candidates[0];
  await L.setRebuildLinkFor(
    sql,
    { id: rb, expect: { installId: f.installId, jobId: f.jobId }, to: cand.target, seen: { own: f.own.version, current: f.current?.stamp ?? null, target: cand.project.stamp }, ...(cand.plan.ok === "ask" ? { salesOrder: "not" } : {}) },
    "u-owner",
  );
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  await L.setRebuildLinkFor(sql, { id: rb, expect: { installId: v.installId, jobId: v.jobId }, to: null, seen: { own: v.own.version, current: v.current?.stamp ?? null, target: null } }, "u-owner");
  const rows = await stored(sql, "rebuild", rb);
  assert.deepEqual(rows.map((r) => [r[0], r[1], r[4], r[5]]), [
    ["part", "20.00", "50.00", true],
    ["labor", "30.00", "120.00", true],
  ]);
});
