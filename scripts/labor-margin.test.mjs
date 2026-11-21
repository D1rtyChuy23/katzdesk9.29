// Labor in ticket margin (Chuy, 11/20): labor cost is billed labor hours × the blended Labor Cost Rate, stored when
// the ticket is invoiced like part costs. The trip charge is separate, one per visit, and has no cost. Who sees a
// ticket's cost and margin follows Settings → Who Sees Cost and Margin; the rate itself stays Admin only. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";

const C = await import("../src/lib/ops/charges-api.ts");
const P = await import("../src/lib/ops/part-pricing-api.ts");
const CA = await import("../src/lib/ops/cost-access.ts");
const round = (n) => Math.round(n * 100) / 100;
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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
       ('u-owner', 'chuy', true, true, 'admin'), ('u-desk', 'dana', true, false, 'service'), ('u-sales', 'sal', true, false, 'sales')`,
  );
  await pg.query("insert into billing_items (sku, item, kind, rate, cost) values ('TEST-A', 'PARTS : TEST-A', 'part', 45, 20)");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  return Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
}
const ticket = async (sql) =>
  Number((await sql.query("insert into service_jobs (kind, call_id, customer, status, received) values ('service', $1, 'Test Cafe', 'Completed', '2026-10-20') returning id", [`SC-LM-${++calls}`]))[0].id);

const LINES = [
  { item: "Service : TRIPCHARGE", description: "", qty: 1, rate: 150 },
  { item: "Service : SERVICELABOR", description: "", qty: 1.5, rate: 150 },
  { item: "PARTS : TEST-A", description: "", qty: 2, rate: 45 },
  { item: "PARTS : NOT-LISTED", description: "", qty: 1, rate: 10 },
];

test("labor's cost is billed hours × the Labor Cost Rate; the trip has no cost; the ticket totals its margin", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 31);
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES, lineIds: [] });
  const c = await C.getTicketChargesFor(sql, job, "u-owner");
  const [trip, labor, part, unlisted] = c.profit;
  assert.deepEqual([trip.source, trip.cost, trip.sell, trip.margin], ["trip", 0, 150, 150]);
  assert.deepEqual([labor.source, labor.unitCost, labor.cost, labor.sell, labor.margin], ["labor", 31, 46.5, 225, 178.5]);
  assert.deepEqual([part.source, part.cost, part.margin], ["purchase", 40, 50]);
  assert.equal(unlisted, null, "a line not on the parts list has no cost");
  // 150 + 225 + 90 + 10 = 475 sell; 0 + 46.5 + 40 known cost; one line with no cost, so no margin.
  assert.deepEqual(c.profitTotals, { sell: 475, ticketDiscount: 0, cost: 86.5, margin: null, marginPct: null, noCost: 1, laborHidden: false });
});

test("with every line costed the ticket has a margin; with no Labor Cost Rate labor has no cost", async () => {
  const sql = await fresh();
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES.slice(0, 3), lineIds: [] });
  let c = await C.getTicketChargesFor(sql, job, "u-owner");
  assert.deepEqual([c.profit[1].source, c.profit[1].cost, c.profit[1].margin], ["none", null, null]);
  assert.equal(c.profitTotals.noCost, 1);
  await P.saveLaborRate(sql, 30);
  c = await C.getTicketChargesFor(sql, job, "u-owner");
  // 465 sell − (0 + 45 + 40) = 380.
  assert.deepEqual(c.profitTotals, { sell: 465, ticketDiscount: 0, cost: 85, margin: 380, marginPct: 81.72, noCost: 0, laborHidden: false });
});

test("invoicing stores labor's cost at the rate then; a later rate change leaves it; clearing the Sales Order clears it", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 31);
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES.slice(0, 3), lineIds: [] });
  await C.recordTicketSalesOrder(sql, job, "u-owner", "SO-LM-1");
  const stored = await sql.query("select kind, unit_cost::text as u, cost_source as s, margin::text as m, priced_at is not null as p from ticket_charges where job_id = $1 order by sort, id", [job]);
  assert.deepEqual(stored.map((r) => [r.kind, r.u, r.s, r.m, r.p]), [
    ["trip", "0.00", "trip", "150.00", true],
    ["labor", "31.00", "labor", "178.50", true],
    ["part", "20.00", "purchase", "50.00", true],
  ]);
  await P.saveLaborRate(sql, 40);
  const c = await C.getTicketChargesFor(sql, job, "u-owner");
  assert.deepEqual([c.profit[1].cost, c.profit[1].stored], [46.5, true]);
  await C.recordTicketSalesOrder(sql, job, "u-owner", null);
  assert.equal((await sql.query("select count(*)::int as n from ticket_charges where job_id = $1 and priced_at is not null", [job]))[0].n, 0);
});

test("a ticket invoiced before the Labor Cost Rate is set keeps labor live, so it prices once the rate is set", async () => {
  const sql = await fresh();
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES.slice(0, 3), lineIds: [] });
  await C.recordTicketSalesOrder(sql, job, "u-owner", "SO-LM-3");
  const labor = (await sql.query("select priced_at from ticket_charges where job_id = $1 and kind = 'labor'", [job]))[0];
  assert.equal(labor.priced_at, null);
  await P.saveLaborRate(sql, 31);
  const c = await C.getTicketChargesFor(sql, job, "u-owner");
  assert.deepEqual([c.profit[1].cost, c.profit[1].stored, c.profit[2].stored], [46.5, false, true]);
});

test("a ticket's cost follows Who Sees Cost and Margin; the labor rate goes only to an Admin; Unlock stays Admin", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 31);
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES.slice(0, 3), lineIds: [] });
  const off = await C.getTicketChargesFor(sql, job, "u-desk");
  assert.deepEqual([off.profit, off.profitTotals, off.ruleLabel, off.canUnlock], [null, null, null, false]);
  // The labor switch on (cost-options.test.mjs has it off).
  await CA.saveCostOptions(sql, { roles: ["service"], showLabor: true, warehouseRebuilds: false });
  const on = await C.getTicketChargesFor(sql, job, "u-desk");
  assert.equal(on.canUnlock, false);
  // The rate isn't sent; a ticked role can still divide labor's cost by its hours (Chuy decides whether labor shows).
  assert.deepEqual([on.profit[1].cost, on.profit[1].unitCost], [46.5, null]);
  assert.equal(on.profit[2].unitCost, 20, "a part's unit cost is shown");
  assert.equal((await C.getTicketChargesFor(sql, job, "u-sales")).profit, null);
  const admin = await C.getTicketChargesFor(sql, job, "u-owner");
  assert.deepEqual([admin.profit[1].unitCost, admin.canUnlock], [31, true]);
});

test("a discount spreads over labor too: Whole bill, Chosen lines, and 100% off", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 30);
  const three = LINES.slice(0, 3); // trip 150, labor 225, part 90 = 465
  const whole = await ticket(sql);
  await C.writeTicketCharges(sql, whole, "u-owner", { lines: three, lineIds: [], discount: { kind: "percent", value: 10 } });
  let c = await C.getTicketChargesFor(sql, whole, "u-owner");
  assert.deepEqual(c.profit.map((p) => p.ticketDiscount), [15, 22.5, 9]);
  assert.deepEqual(c.profitTotals, { sell: 465, ticketDiscount: 46.5, cost: 85, margin: 333.5, marginPct: 79.69, noCost: 0, laborHidden: false });
  assert.equal(round(c.profit.reduce((a, p) => a + p.margin, 0)), c.profitTotals.margin, "the lines add up to the ticket");
  const chosen = await ticket(sql);
  await C.writeTicketCharges(sql, chosen, "u-owner", {
    lines: three.map((l, i) => ({ ...l, discountChosen: i === 1 })),
    lineIds: [],
    discount: { kind: "percent", value: 10, scope: "chosen" },
  });
  c = await C.getTicketChargesFor(sql, chosen, "u-owner");
  assert.deepEqual(c.profit.map((p) => p.ticketDiscount), [0, 22.5, 0]);
  assert.deepEqual([c.profit[1].margin, c.profitTotals.margin], [157.5, 357.5]);
  const free = await ticket(sql);
  await C.writeTicketCharges(sql, free, "u-owner", { lines: three, lineIds: [], discount: { kind: "percent", value: 100 } });
  c = await C.getTicketChargesFor(sql, free, "u-owner");
  assert.deepEqual([c.profitTotals.margin, c.profitTotals.marginPct], [-85, null]);
});

test("an invoiced ticket viewed by a ticked role: stored costs and totals, still no labor rate", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 31);
  // The labor switch on (cost-options.test.mjs has it off).
  await CA.saveCostOptions(sql, { roles: ["service"], showLabor: true, warehouseRebuilds: false });
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES.slice(0, 3), lineIds: [] });
  await C.recordTicketSalesOrder(sql, job, "u-owner", "SO-LM-4");
  const c = await C.getTicketChargesFor(sql, job, "u-desk");
  assert.deepEqual([c.profit[1].stored, c.profit[1].cost, c.profit[1].unitCost, c.profitTotals.margin], [true, 46.5, null, 378.5]);
});

test("Parts Profit stays parts only: labor and trip lines aren't in it", async () => {
  const sql = await fresh();
  await P.saveLaborRate(sql, 31);
  const job = await ticket(sql);
  await C.writeTicketCharges(sql, job, "u-owner", { lines: LINES.slice(0, 3), lineIds: [] });
  await C.recordTicketSalesOrder(sql, job, "u-owner", "SO-LM-2");
  const { lines } = await C.invoicedPartLines(sql, { from: null, to: null });
  assert.deepEqual(lines.map((l) => l.sku), ["TEST-A"]);
});

test("every save that returns the charges uses the same view rule", () => {
  const f = src("src/lib/ops/charges-api.ts");
  assert.doesNotMatch(f, /loadCharges\(sql, (data\.)?jobId, await canReviewNames/);
  assert.equal((f.match(/loadCharges\(sql, (data\.)?jobId, await chargeView\(sql, (context\.)?userId\)\)/g) ?? []).length, 4);
  assert.match(src("src/components/desk/charges-panel.tsx"), /<ProfitTotalsRow t=\{c\.profitTotals\} testId="charge-profit-total" \/>/);
});
