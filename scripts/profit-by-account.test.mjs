// The Profit report's customer tables both ways (Chuy, 11/26: "Can you do both? Allow both reports?"): By Account puts
// each listed account on one row under its name now, by the account's id; By Name Billed groups by the name, as before.
// A bill with no listed account id goes under the account its name means, else by its name. Made-up data.
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
const R = await import("../src/lib/ops/profit-report-api.ts");
const PR = await import("../src/lib/ops/profit-report.ts");
const CI = await import("../src/lib/ops/customer-identity.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

let last = null;
let calls = 0;
async function fresh() {
  if (last) await last.close().catch(() => {});
  const pg = new PGlite();
  last = pg;
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin')");
  await pg.query("insert into billing_items (sku, item, kind, rate, cost) values ('TEST-A', 'PARTS : TEST-A', 'part', 45, 20)");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await P.saveLaborRate(sql, 30);
  return sql;
}
const idOf = async (sql, text, params) => Number((await sql.query(text, params))[0].id);
const account = (sql, name, archived = false) => idOf(sql, "insert into directory_customers (name, archived) values ($1, $2) returning id", [name, archived]);
// 150 trip + 300 labor + 90 parts = 540 sell.
const LINES = [
  { item: "Service : TRIPCHARGE", description: "", qty: 1, rate: 150 },
  { item: "Service : SERVICELABOR", description: "", qty: 2, rate: 150 },
  { item: "PARTS : TEST-A", description: "", qty: 2, rate: 45 },
];
async function billedTicket(sql, customer, billed = "2026-10-05") {
  const job = await idOf(sql, "insert into service_jobs (kind, call_id, customer, status, received, completed_at) values ('service', $1, $2, 'Completed', $3, $3) returning id", [`SC-PA-${++calls}`, customer, billed]);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [] });
  await C.recordTicketSalesOrder(sql, job, "u-owner", `SO-PA-${calls}`, billed);
  return job;
}
const ALL = { from: null, to: null };
const rows = (groups) => groups.map((g) => [g.label, g.bills]).sort((a, b) => a[0].localeCompare(b[0]));

test("two accounts whose names differ only in punctuation: By Account keeps them apart, By Name Billed together", async () => {
  const sql = await fresh();
  await account(sql, "Joe's Cafe");
  await account(sql, "Joes Cafe");
  await billedTicket(sql, "Joe's Cafe");
  await billedTicket(sql, "Joes Cafe");
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.deepEqual(r.byCustomer.map((g) => g.bills), [2], "by name: one row, as before");
  assert.deepEqual(rows(r.byAccount), [["Joe's Cafe", 1], ["Joes Cafe", 1]]);
  assert.equal(r.byAccount.reduce((n, g) => n + g.sell, 0), r.totals.sell, "every bill is in exactly one account row");
});

test("a renamed account: By Account has its bills on one row under its name now, even an invoice that kept the old name", async () => {
  const sql = await fresh();
  const alpha = await account(sql, "Alpha Cafe");
  await billedTicket(sql, "Alpha Cafe");
  // A deal invoice whose deal is gone: the invoice's own copy of the name, and its id.
  const deal = await idOf(sql, "insert into deals (customer) values ('Alpha Cafe') returning id");
  await I.approveInvoiceFor(sql, { type: "deal", id: deal, lines: LINES, lineIds: [], discount: null, seen: null }, "u-owner");
  await sql.query("delete from deals where id = $1", [deal]);
  await CI.renameOrMergeCustomer(sql, alpha, "Alpha Coffee");
  const kept = (await sql.query("select customer, customer_id from invoices where entity_type = 'deal' and entity_id = $1", [deal]))[0];
  assert.deepEqual([kept.customer, Number(kept.customer_id)], ["Alpha Cafe", alpha], "an invoice keeps its name and moves by id");
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.deepEqual(rows(r.byCustomer), [["Alpha Cafe", 1], ["Alpha Coffee", 1]], "by name: the ticket follows the rename, the invoice doesn't");
  assert.deepEqual(rows(r.byAccount), [["Alpha Coffee", 2]], "by account: one row, the account's name now");
});

test("By Account: an id naming no listed account goes by the name's account, else by the name", async () => {
  const sql = await fresh();
  const beta = await account(sql, "Beta Bakery");
  const gone = await account(sql, "Beta Old", true);
  const t = await billedTicket(sql, "Beta Bakery");
  // A ticket still holding a removed account's id: it goes by its name, to Beta Bakery.
  await sql.query("update service_jobs set customer_id = $1 where id = $2", [gone, t]);
  await billedTicket(sql, "Beta Bakery");
  await billedTicket(sql, "Walk-in Wendy");
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.deepEqual(rows(r.byAccount), [["Beta Bakery", 2], ["Walk-in Wendy", 1]]);
  assert.ok(r.byAccount.find((g) => g.label === "Beta Bakery").key.endsWith(`:${beta}`), "keyed by the account's id");
  assert.notEqual(r.byAccount.find((g) => g.label === "Walk-in Wendy").key, r.byAccount.find((g) => g.label === "Beta Bakery").key);
});

test("an invoice goes with its record's account now, as By Name Billed takes the record's name", async () => {
  const sql = await fresh();
  await account(sql, "Alpha Cafe");
  const beta = await account(sql, "Beta Bakery");
  const pm = await idOf(sql, "insert into pm_jobs (customer, wo, status) values ('Alpha Cafe', 'WO-PA-1', 'Completed') returning id");
  await I.approveInvoiceFor(sql, { type: "pm", id: pm, lines: LINES, lineIds: [], discount: null, seen: null }, "u-owner");
  // The PM moves to another account after it was billed; its invoice keeps the name and id it was billed under.
  await sql.query("update pm_jobs set customer = 'Beta Bakery' where id = $1", [pm]);
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.deepEqual(rows(r.byCustomer), [["Beta Bakery", 1]]);
  assert.deepEqual(r.byAccount.map((g) => [g.key, g.label]), [[`a:${beta}`, "Beta Bakery"]]);
});

test("NetSuite lines go with their install's account id", async () => {
  const sql = await fresh();
  const grill = await account(sql, "Gamma Grill");
  const inst = await idOf(sql, "insert into installs (customer, complete, equip_status, archived) values ('Gamma Grill Kitchen', false, 'Not Ready', false) returning id");
  // Its id names Gamma Grill though its name finds no account (a save that set the id itself).
  await sql.query("update installs set customer_id = $1 where id = $2", [grill, inst]);
  const b = await idOf(sql, "insert into record_ns_billing (install_id, wo, wo_key, ns_so, billed_at) values ($1, 'WO-PA-8', '8', 'SO-PA-8', '2026-10-20') returning id", [inst]);
  await sql.query("insert into record_ns_charges (billing_id, item, qty, rate, kind, sort) values ($1, 'PARTS : TEST-A', 4, 45, 'part', 1)", [b]);
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.deepEqual(rows(r.byCustomer), [["Gamma Grill Kitchen", 1]]);
  assert.deepEqual(r.byAccount.map((g) => [g.key, g.label, g.bills]), [[`a:${grill}`, "Gamma Grill", 1]]);
});

test("a merged account's bills land on the kept account, NetSuite lines and an invoice that kept its name too", async () => {
  const sql = await fresh();
  const kept = await account(sql, "Gamma Grill");
  const dropped = await account(sql, "Gamma Grill Downtown");
  const inst = await idOf(sql, "insert into installs (customer, complete, equip_status, archived) values ('Gamma Grill Downtown', false, 'Not Ready', false) returning id");
  const b = await idOf(sql, "insert into record_ns_billing (install_id, wo, wo_key, ns_so, billed_at) values ($1, 'WO-PA-9', '9', 'SO-PA-9', '2026-10-20') returning id", [inst]);
  await sql.query("insert into record_ns_charges (billing_id, item, qty, rate, kind, sort) values ($1, 'PARTS : TEST-A', 4, 45, 'part', 1)", [b]);
  // A deal invoice whose deal is gone keeps the dropped account's name; a merge moves its id.
  const deal = await idOf(sql, "insert into deals (customer) values ('Gamma Grill Downtown') returning id");
  await I.approveInvoiceFor(sql, { type: "deal", id: deal, lines: LINES, lineIds: [], discount: null, seen: null }, "u-owner");
  await sql.query("delete from deals where id = $1", [deal]);
  await billedTicket(sql, "Gamma Grill");
  {
    const r = await R.profitReportFor(sql, ALL, "u-owner");
    assert.deepEqual(rows(r.byAccount), [["Gamma Grill", 1], ["Gamma Grill Downtown", 2]], "the NetSuite lines are under the install's account");
  }
  const merged = await CI.renameOrMergeCustomer(sql, dropped, "Gamma Grill");
  assert.ok(merged.merged && [kept, dropped].includes(merged.id));
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  assert.deepEqual(rows(r.byAccount), [["Gamma Grill", 3]], "after the merge, one row");
  assert.equal(r.byAccount[0].key, `a:${merged.id}`);
  assert.deepEqual(rows(r.byCustomer), [["Gamma Grill", 2], ["Gamma Grill Downtown", 1]], "by name: the invoice keeps its name");
});

test("QuickBooks history has both tables too", async () => {
  const sql = await fresh();
  const alpha = await account(sql, "Alpha Cafe");
  const dotted = await account(sql, "Alpha Cafe.");
  const run = await idOf(sql, "insert into wo_history_runs (filename) values ('x.csv') returning id");
  const wo = async (customer, ref) => {
    const h = await idOf(sql, "insert into wo_history (run_id, history_ref, customer, invoice_date) values ($1, $2, $3, '2025-03-01') returning id", [run, ref, customer]);
    await sql.query("insert into wo_history_lines (history_id, line_type, kind, amount, line_cost) values ($1, 'Item', 'part', 100, 40)", [h]);
    return h;
  };
  await wo("Alpha Cafe", "WO-1");
  await wo("Alpha Cafe.", "WO-2");
  await wo("Alpha Cafe", "WO-3");
  const s = await R.historyProfitSection(sql, ALL);
  assert.deepEqual(rows(s.byCustomer).map((r) => r[1]), [3], "by name: punctuation doesn't split a name");
  assert.deepEqual(rows(s.byAccount), [["Alpha Cafe", 2], ["Alpha Cafe.", 1]]);
  assert.deepEqual(s.byAccount.map((g) => g.key).sort(), [`a:${alpha}`, `a:${dotted}`].sort());
  assert.equal(s.byAccount.reduce((n, g) => n + g.sell, 0), s.totals.sell, "every history bill is in exactly one account row");
});

test("the downloads carry both customer tables, and both history ones", async () => {
  const sql = await fresh();
  await account(sql, "Joe's Cafe");
  await account(sql, "Joes Cafe");
  await billedTicket(sql, "Joe's Cafe");
  await billedTicket(sql, "Joes Cafe");
  const r = await R.profitReportFor(sql, ALL, "u-owner");
  const file = PR.buildProfitReportFile(r, { generated: "now", scope: "All" });
  assert.deepEqual([file.records.title, file.records.columns[0], file.records.rows.length], ["By Account", "Account", 2]);
  assert.deepEqual(file.extra.map((t) => [t.title, t.sheet ?? t.title, t.columns[0]]), [
    ["By Name Billed", "By Name Billed", "Name Billed"],
    ["QuickBooks history (2024–2026): By Year", "QB History By Year", "Year"],
    ["QuickBooks history (2024–2026): By Account", "QB History By Account", "Account"],
    ["QuickBooks history (2024–2026): By Name Billed", "QB History By Name Billed", "Name Billed"],
  ]);
  assert.equal(file.extra[0].rows.length, 1);
  const { reportSheets } = await import("../src/lib/ops/analytics.ts");
  assert.ok(reportSheets(file).every((s) => s.name.length <= 31), "Excel sheet names fit");
});
