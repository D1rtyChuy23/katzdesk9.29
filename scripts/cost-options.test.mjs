// Two more switches in Who Sees Cost and Margin (Chuy, 11/20: "I want both to be toggle. I can decide later."), both
// off to start:
//   * Labor cost for ticked roles. Off: a non-Admin who sees cost gets parts and the trip only; labor lines carry no
//     cost and are left out of the totals, so the Labor Cost Rate can't be worked out.
//   * Warehouse sees cost on rebuild invoices. Off: no cost on rebuild invoices for Warehouse, even with Warehouse ticked.
// An Admin always sees everything. All data is made up.
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

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const SHOP = "Katz Coffee Service Dept.";

let last = null;
async function fresh() {
  if (last) await last.close().catch(() => {});
  const pg = new PGlite();
  last = pg;
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'), ('u-desk', 'dana', true, false, 'service'), ('u-wh', 'wes', true, false, 'warehouse')`,
  );
  await pg.query("insert into billing_items (sku, item, kind, rate, cost) values ('TEST-A', 'PARTS : TEST-A', 'part', 45, 20)");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await P.saveLaborRate(sql, 30);
  return sql;
}
const LINES = [
  { item: "Service : TRIPCHARGE", description: "", qty: 1, rate: 150 },
  { item: "Service : SERVICELABOR", description: "", qty: 2, rate: 150 },
  { item: "PARTS : TEST-A", description: "", qty: 2, rate: 45 },
];

test("the switches are stored with the roles; both start off", async () => {
  const sql = await fresh();
  assert.deepEqual(await CA.loadCostOptions(sql), { roles: [], showLabor: false, warehouseRebuilds: false });
  await CA.saveCostOptions(sql, { roles: ["service", "warehouse"], showLabor: true, warehouseRebuilds: true });
  assert.deepEqual(await CA.loadCostOptions(sql), { roles: ["service", "warehouse"], showLabor: true, warehouseRebuilds: true });
  assert.deepEqual(await CA.loadCostRoles(sql), ["service", "warehouse"]);
});

test("labor off: a ticked role sees the ticket's parts and trip, not labor; an Admin sees all; labor on shows it", async () => {
  const sql = await fresh();
  await CA.saveCostOptions(sql, { roles: ["service"], showLabor: false, warehouseRebuilds: false });
  const job = Number((await sql.query("insert into service_jobs (kind, call_id, customer, status, received) values ('service', 'SC-CO-1', 'Test Cafe', 'Completed', '2026-10-20') returning id"))[0].id);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [] });
  const off = await C.getTicketChargesFor(sql, job, "u-desk");
  assert.equal(off.profit[1], null, "no labor line cost");
  assert.equal(off.profit[2].cost, 40);
  // Trip 150 and parts 90: 240 sell, 40 cost.
  assert.deepEqual(off.profitTotals, { sell: 240, ticketDiscount: 0, cost: 40, margin: 200, marginPct: 83.33, noCost: 0, laborHidden: true });
  const admin = await C.getTicketChargesFor(sql, job, "u-owner");
  assert.deepEqual([admin.profit[1].cost, admin.profitTotals.sell, admin.profitTotals.laborHidden], [60, 540, false]);
  await CA.saveCostOptions(sql, { roles: ["service"], showLabor: true, warehouseRebuilds: false });
  const on = await C.getTicketChargesFor(sql, job, "u-desk");
  assert.deepEqual([on.profit[1].cost, on.profit[1].unitCost, on.profitTotals.sell, on.profitTotals.laborHidden], [60, null, 540, false]);
});

test("labor off on the Invoice window too", async () => {
  const sql = await fresh();
  await CA.saveCostOptions(sql, { roles: ["service"], showLabor: false, warehouseRebuilds: false });
  const deal = Number((await sql.query("insert into deals (customer) values ('Test Cafe') returning id"))[0].id);
  await I.approveInvoiceFor(sql, { type: "deal", id: deal, lines: LINES, lineIds: [], discount: null, seen: null }, "u-owner");
  const v = await I.getInvoiceFor(sql, { type: "deal", id: deal }, "u-desk");
  assert.equal(v.profit[1], null);
  assert.deepEqual([v.profitTotals.sell, v.profitTotals.cost, v.profitTotals.laborHidden], [240, 40, true]);
});

test("Warehouse ticked still sees no cost on rebuild invoices until that switch is on", async () => {
  const sql = await fresh();
  const rb = Number((await sql.query("insert into rebuilds (title, account, status) values ('Test refurb', $1, 'In progress') returning id", [SHOP]))[0].id);
  await I.approveInvoiceFor(sql, { type: "rebuild", id: rb, lines: [LINES[2]], lineIds: [], discount: null, seen: null }, "u-owner");
  await CA.saveCostOptions(sql, { roles: ["warehouse"], showLabor: false, warehouseRebuilds: false });
  assert.equal(await CA.canSeeCost(sql, "u-wh"), true, "Warehouse sees Parts cost");
  assert.equal((await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-wh")).profit, null);
  await CA.saveCostOptions(sql, { roles: ["warehouse"], showLabor: false, warehouseRebuilds: true });
  assert.equal((await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-wh")).profit[0].cost, 40);
  await CA.saveCostOptions(sql, { roles: [], showLabor: false, warehouseRebuilds: true });
  assert.equal((await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-wh")).profit, null, "the switch alone doesn't show it: Warehouse must be ticked");
});

test("Settings shows both switches to an Admin", () => {
  const e = readFileSync(new URL("../src/components/desk/cost-access-editor.tsx", import.meta.url), "utf8");
  assert.match(e, /data-testid="cost-access-labor"/);
  assert.match(e, /data-testid="cost-access-warehouse-rebuilds"/);
});
