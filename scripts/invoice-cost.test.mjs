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
  await CA.saveCostRoles(sql, ["service"]);
  const on = await I.getInvoiceFor(sql, { type: "install", id: install }, "u-desk");
  assert.deepEqual([on.profit[1].cost, on.profit[1].unitCost, on.profit[2].unitCost], [60, null, 20]);
  assert.deepEqual(on.profitTotals, { sell: 540, ticketDiscount: 0, cost: 100, margin: 440, marginPct: 81.48, noCost: 0 });
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
