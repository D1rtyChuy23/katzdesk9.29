// Billing Backfill (NetSuite), Admin only (Grok's billing request through Chuy, 10/28): reading the charges and invoices
// files, credits netted, the header discount mirrored in dollars, the Sales Order and its billed date, invoices added
// and refreshed, a locked (invoiced) ticket only getting invoice records, the skips (merged, Walk-In, PMs, unknown,
// two tickets), the wrap, double bills, the amount check, and the one-statement write refusing stale previews.
// All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const bf = await import("../src/lib/ops/billing-backfill.ts");
const api = await import("../src/lib/ops/billing-backfill-api.ts");
const charges = await import("../src/lib/ops/charges-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'), ('u-desk', 'dana', true, false, 'service')`,
  );
  return { query: async (text, params) => (await pg.query(text, params)).rows };
}

let n = 0;
async function ticket(sql, o = {}) {
  n += 1;
  return (
    await sql.query(
      `insert into service_jobs (kind, call_id, customer, wo, status, technician, received, completed_at, ns_so, duplicate_of)
       values ($1, $2, $3, $4, 'Completed', $5, $6, $7, $8, $9) returning id`,
      [o.kind ?? "service", `SC-BF-${n}`, o.customer ?? "Zz Bean Cafe", o.wo, o.tech ?? "Ryan Gloria", o.received ?? "2026-09-01", o.completed ?? "2026-09-10", o.so ?? null, o.duplicateOf ?? null],
    )
  )[0].id;
}

const csv = (rows) => rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(",")).join("\n") + "\n";
const file = (name, rows) => ({ name, base64: Buffer.from(csv(rows)).toString("base64") });

const CHARGES_HEAD = ["WO", "Source invoice #", "Source SO #", "PO", "NetSuite customer", "Location", "Item", "Item type", "Description", "Qty", "Rate", "Amount", "Discount Item", "Discount Amount", "Record total (after discount)"];
const INVOICES_HEAD = ["WO", "SO #", "SO status", "Invoice #", "Invoice date", "Invoice status", "Invoice total", "Amount remaining", "Charges source", "Corrigo net (reference)"];

const linesOf = async (sql, id) => (await sql.query("select item, qty::text, rate::text from ticket_charges where job_id = $1 order by sort, id", [id])).map((r) => `${r.qty}x${r.rate} ${r.item}`);
const job = async (sql, id) =>
  (await sql.query("select ns_so, discount_kind, discount_value::text as dv, to_char(billed_at at time zone 'America/Chicago', 'YYYY-MM-DD') as billed_on from service_jobs where id = $1", [id]))[0];
const invoicesOf = async (sql, id) =>
  (await sql.query("select ns_invoice, ns_so, status, total::text, amount_remaining::text as remaining, source, location from ticket_invoices where job_id = $1 order by ns_invoice", [id])).map(
    (r) => `${r.ns_invoice} ${r.status} ${r.total} ${r.remaining} ${r.source} ${r.ns_so ?? "-"} ${r.location ?? "-"}`,
  );

// ── Pure ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test("charge lines: credits net against their item, a half cent splits across two lines, discount lines aren't charges", () => {
  const built = bf.chargeLinesFromNetSuite([
    { item: "FILTERS : ZZF1", itemType: "InvtPart", description: "Filter", qty: 3, rate: 50, amount: 150 },
    { item: "FILTERS : ZZF1", itemType: "InvtPart", description: "Filter", qty: -1, rate: 50, amount: -50 },
    { item: "FILTERS : ZZF2", itemType: "InvtPart", description: "Gone", qty: 1, rate: 9, amount: 9 },
    { item: "FILTERS : ZZF2", itemType: "InvtPart", description: "Gone", qty: -1, rate: 9, amount: -9 },
    { item: "PARTS : ZZP1", itemType: "InvtPart", description: "Half cent", qty: 2, rate: 104.675, amount: 209.35 },
    { item: "Service : SERVICELABOR", itemType: "Service", description: "Labor", qty: 1.5, rate: 150, amount: 225 },
    { item: "CLDSERVICE", itemType: "Discount", description: "", qty: 1, rate: -25, amount: -25 },
    { item: "Subtotal", itemType: "Subtotal", description: "", qty: 0, rate: 0, amount: 584.35 },
  ]);
  assert.equal(built.problem, null);
  assert.deepEqual(
    built.lines.map((l) => `${l.qty}x${l.rate} ${l.item} ${l.kind}`),
    ["2x50 FILTERS : ZZF1 part", "1x104.67 PARTS : ZZP1 part", "1x104.68 PARTS : ZZP1 part", "1.5x150 Service : SERVICELABOR labor"],
  );
  const credit = bf.chargeLinesFromNetSuite([{ item: "PARTS : ZZP2", itemType: "InvtPart", description: "", qty: -2, rate: 10, amount: -20 }]);
  assert.match(credit.problem, /can't hold a credit line/);
});

test("reading: columns by header name, both files, a Sales Order with no invoice yet", () => {
  const read = api.readBackfillFiles([
    file("charges.csv", [CHARGES_HEAD, ["WO-0101", "INV1", "SO1", "", "Zz Bean Cafe", "Houston - WH", "Service : TRIPCHARGE", "Service", "Trip", "1", "150", "150", "", "", "150"]]),
    file("invoices.csv", [INVOICES_HEAD, ["0101", "SO1", "Billed", "INV1", "10/02/2026", "Paid In Full", "150", "0", "Yes", "150"], ["WO-0101", "SO9", "Cancelled", "", "", "(no invoice yet)", "", "", "", ""]]),
  ]);
  assert.deepEqual(read.sheets.map((s) => [s.file, s.kind, s.rows]), [["charges.csv", "charges", 1], ["invoices.csv", "invoices", 2]]);
  assert.equal(read.lines[0].key, "101");
  assert.equal(read.lines[0].amount, 150);
  assert.deepEqual(read.invoices.map((i) => [i.invoice, i.so, i.date, i.chargesSource]), [["INV1", "SO1", "2026-10-02", true], ["", "SO9", null, false]]);
});

// ── Planning and writing ─────────────────────────────────────────────────────────────────────────────────────────

test("Admin only: a non-Admin can't preview or write", async () => {
  const sql = await fresh();
  const f = [file("invoices.csv", [INVOICES_HEAD, ["WO-0101", "", "", "INV1", "2026-10-02", "Open", "10", "10", "Yes", ""]])];
  await assert.rejects(() => api.previewBillingBackfillFor(sql, f, "u-desk"), /Only an Admin/);
  await assert.rejects(() => api.applyBillingBackfillFor(sql, f, "u-desk", { hash: "0".repeat(16), skip: [] }), /Only an Admin/);
});

test("not invoiced yet: charges, then the SO and its billed date, then the invoices; the ticket is locked after", async () => {
  const sql = await fresh();
  const id = await ticket(sql, { wo: "WO-0201", tech: "Lance Oden" });
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : TRIPCHARGE', 'Trip', 1, 150, 'trip', 1)", [id]);
  await sql.query("insert into billing_items (sku, item, kind, rate, cost) values ('ZZB1', 'BUNN PARTS : ZZB1', 'part', 3.6, 1.5), ('ZZW1', 'WATER FILTERS : ZZW1', 'part', 142.86, 60)");
  const f = [
    file("charges.csv", [
      CHARGES_HEAD,
      ["WO-0201", "INV2001", "SO2001", "WO-0201 JG", "Zz Bean Cafe", "Houston - WH", "BUNN PARTS : ZZB1", "InvtPart", "Sprayhead", "2", "3.6", "7.2", "CLDSERVICE", "-307.2", "142.86"],
      ["WO-0201", "INV2001", "SO2001", "WO-0201 JG", "Zz Bean Cafe", "Houston - WH", "Service : TRIPCHARGE", "Service", "Trip", "1", "150", "150", "CLDSERVICE", "-307.2", "142.86"],
      ["WO-0201", "INV2001", "SO2001", "WO-0201 JG", "Zz Bean Cafe", "Houston - WH", "Service : SERVICELABOR", "Service", "Labor", "1", "150", "150", "CLDSERVICE", "-307.2", "142.86"],
      ["WO-0201", "INV2001", "SO2001", "WO-0201 JG", "Zz Bean Cafe", "Houston - WH", "WATER FILTERS : ZZW1", "InvtPart", "Filter", "1", "142.86", "142.86", "CLDSERVICE", "-307.2", "142.86"],
    ]),
    file("invoices.csv", [INVOICES_HEAD, ["WO-0201", "SO2001", "Billed", "INV2001", "2026-10-26", "Open", "142.86", "142.86", "Yes", "142.86"]]),
  ];
  const p = await api.previewBillingBackfillFor(sql, f, "u-owner");
  const plan = p.plans[0];
  assert.equal(plan.status, "write");
  assert.equal(plan.charges.nextNet, 142.86, "like for like: KatzDesk after the discount equals NetSuite's total");
  assert.deepEqual(plan.charges.nextDiscount, { kind: "amount", value: 307.2 });
  assert.deepEqual(plan.so, { current: null, next: "SO2001", billedOn: "2026-10-26", change: true, note: null });
  assert.deepEqual(plan.warnings, ["Lance Oden bills from San Antonio WH, not Houston - WH"]);
  assert.equal(await (async () => (await sql.query("select count(*)::int as n from ticket_invoices"))[0].n)(), 0, "the preview writes nothing");

  const done = await api.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [] });
  assert.deepEqual(done.applied, { tickets: 1, lines: 4, invoices: 1 });
  assert.deepEqual(await linesOf(sql, id), ["2.00x3.60 BUNN PARTS : ZZB1", "1.00x150.00 Service : TRIPCHARGE", "1.00x150.00 Service : SERVICELABOR", "1.00x142.86 WATER FILTERS : ZZW1"]);
  assert.deepEqual(await job(sql, id), { ns_so: "SO2001", discount_kind: "amount", dv: "307.20", billed_on: "2026-10-26" });
  assert.deepEqual(await invoicesOf(sql, id), ["INV2001 Open 142.86 142.86 so SO2001 Houston - WH"]);
  const c = await charges.loadTicketCharges(sql, id);
  assert.equal(c.total, 142.86);
  assert.deepEqual(c.invoiceLock, { invoice: "INV2001", status: "Open" });
  const log = (await sql.query("select actor_name, detail from activity where entity_id = $1 and detail like 'Billing Backfill%'", [id]))[0];
  assert.equal(log.actor_name, "chuy");
  assert.match(log.detail, /charges 4 lines \$450\.06, discount \$307\.20 off, total \$142\.86 · Sales Order SO2001 \(billed 2026-10-26\) · invoices: INV2001 new \(Open \$142\.86\)/);
  // The part line got its cost and margin stored, as a billed ticket's lines do.
  assert.equal((await sql.query("select count(*)::int as n from ticket_charges where job_id = $1 and priced_at is not null", [id]))[0].n, 2);

  // The same files again: nothing left to do.
  const again = await api.previewBillingBackfillFor(sql, f, "u-owner");
  assert.equal(again.plans[0].status, "same");
});

test("already invoiced (locked): only the invoice records change; charges, discount, SO and billed date are kept", async () => {
  const sql = await fresh();
  const id = await ticket(sql, { wo: "WO-0301", so: "SO3001" });
  await sql.query("update service_jobs set billed_at = '2026-09-20 15:00-05' where id = $1", [id]);
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : TRIPCHARGE', 'Trip', 1, 150, 'trip', 1)", [id]);
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source) values ($1, 'INV3001', 'SO3001', '2026-09-21', 'Open', 150, 150, 'so')", [id]);
  const f = [
    file("charges.csv", [CHARGES_HEAD, ["WO-0301", "INV3001", "SO3001", "", "Zz Bean Cafe", "", "Service : SERVICELABOR", "Service", "Labor", "2", "150", "300", "", "", "300"]]),
    file("invoices.csv", [
      INVOICES_HEAD,
      ["WO-0301", "SO3001", "Billed", "INV3001", "2026-09-21", "Paid In Full", "150", "0", "Yes", "150"],
      ["WO-0301", "SO3009", "Billed", "INV3009", "2026-10-01", "Open", "40", "40", "", "150"],
    ]),
  ];
  const p = await api.previewBillingBackfillFor(sql, f, "u-owner");
  const plan = p.plans[0];
  assert.equal(plan.status, "invoices");
  assert.equal(plan.locked, true);
  assert.equal(plan.charges.next, null);
  assert.ok(plan.warnings.some((w) => /Locked: invoiced already, so the charges and Sales Order stay/.test(w)));
  await api.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [] });
  assert.deepEqual(await linesOf(sql, id), ["1.00x150.00 Service : TRIPCHARGE"], "charges kept");
  assert.deepEqual(await job(sql, id), { ns_so: "SO3001", discount_kind: null, dv: null, billed_on: "2026-09-20" }, "SO and billed date kept");
  assert.deepEqual(await invoicesOf(sql, id), ["INV3001 Paid In Full 150.00 0.00 so SO3001 -", "INV3009 Open 40.00 40.00 so SO3009 -"]);
  const log = (await sql.query("select detail from activity where entity_id = $1 and detail like 'Billing Backfill%'", [id]))[0].detail;
  assert.match(log, /invoices: INV3001 Open → Paid In Full \(\$0\.00 remaining\), INV3009 new \(Open \$40\.00\) · charges, P\.O\., discount and SO kept \(locked\)/);
});

test("NetSuite's status is never made up: a new invoice with no status is left out; one already here keeps its own", async () => {
  const sql = await fresh();
  const id = await ticket(sql, { wo: "WO-0302", so: "SO3002" });
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source) values ($1, 'INV3002', 'SO3002', '2026-09-21', 'Open', 150, 150, 'so')", [id]);
  const seen = (await sql.query("select updated_at::text as u from service_jobs where id = $1", [id]))[0].u;
  const f = [
    file("invoices.csv", [
      INVOICES_HEAD,
      ["WO-0302", "SO3002", "Billed", "INV3002", "2026-09-21", "", "150", "0", "Yes", ""],
      ["WO-0302", "SO3002", "Billed", "INV3003", "2026-09-25", "", "60", "60", "", ""],
    ]),
  ];
  const p = await api.previewBillingBackfillFor(sql, f, "u-owner");
  const plan = p.plans[0];
  assert.deepEqual(plan.invoices.map((i) => [i.invoice, i.status, i.change]), [["INV3002", "Open", "updated"]]);
  assert.ok(plan.warnings.some((w) => /INV3003 has no Invoice Status in the file, so it is left out/.test(w)), plan.warnings.join(" | "));
  await api.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [] });
  assert.deepEqual(await invoicesOf(sql, id), ["INV3002 Open 150.00 0.00 so SO3002 -"]);
  // A locked ticket's row is touched too (invoices only), so a save or merge waiting on it sees that it changed.
  assert.notEqual((await sql.query("select updated_at::text as u from service_jobs where id = $1", [id]))[0].u, seen);
});

test("skips: merged, Walk-In, a PM's WO, no ticket, two tickets; a cancelled SO is never set; untick leaves a ticket out", async () => {
  const sql = await fresh();
  const keeper = await ticket(sql, { wo: "WO-0401" });
  await ticket(sql, { wo: "WO-0402", duplicateOf: keeper });
  await ticket(sql, { wo: "WO-0403", customer: "Walk - In" });
  await sql.query("insert into pm_jobs (customer, wo, status) values ('Zz Bean Cafe', 'WO-0404', 'Completed')");
  await ticket(sql, { wo: "WO-0406", completed: "2026-09-10" });
  await ticket(sql, { wo: "WO-0406", completed: "2026-09-12" });
  const cancelled = await ticket(sql, { wo: "WO-0407" });
  const left = await ticket(sql, { wo: "WO-0408" });
  const row = (wo, inv, so = "", status = "Open", soStatus = "Billed") => [wo, so, so ? soStatus : "", inv, inv ? "2026-10-02" : "", inv ? status : "(no invoice yet)", inv ? "10" : "", inv ? "10" : "", inv ? "Yes" : "", ""];
  const f = [
    file("invoices.csv", [
      INVOICES_HEAD,
      row("WO-0402", "INV2"),
      row("WO-0403", "INV3"),
      row("WO-0404", "INV4"),
      row("WO-0405", "INV5"),
      row("WO-0406", "INV6"),
      row("WO-0407", "INV7"),
      row("WO-0407", "", "SO7", "", "Cancelled"),
      row("WO-0408", "INV8"),
    ]),
  ];
  const p = await api.previewBillingBackfillFor(sql, f, "u-owner");
  const by = Object.fromEntries(p.plans.map((x) => [x.wo, x]));
  assert.match(by["WO-0402"].reason, new RegExp(`Merged into #${keeper}`));
  assert.match(by["WO-0403"].reason, /Walk-In, which is never a billing account/);
  assert.match(by["WO-0404"].reason, /on PMs\. Billing Backfill covers service and TLC tickets/);
  assert.equal(by["WO-0405"].reason, "No ticket has this WO.");
  assert.match(by["WO-0406"].reason, /on 2 tickets/);
  assert.equal(by["WO-0407"].status, "write");
  assert.equal(by["WO-0407"].so.next, null);
  assert.equal(by["WO-0407"].so.note, "Cancelled SO7 left off.");
  assert.deepEqual(p.counts, { total: 7, write: 2, invoices: 0, same: 0, skip: 5, doubleBill: 0, nsMismatch: 2, corrigoMismatch: 0, warnings: 2 });
  const done = await api.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: ["408"] });
  assert.equal(done.applied.tickets, 1);
  assert.deepEqual(await invoicesOf(sql, cancelled), ["INV7 Open 10.00 10.00 standalone - -"]);
  assert.equal((await job(sql, cancelled)).ns_so, null);
  assert.deepEqual(await invoicesOf(sql, left), [], "unticked: left out");
});

test("WO numbers started over: the ticket done within a year before the invoice is the one", async () => {
  const sql = await fresh();
  await ticket(sql, { wo: "WO-0501", received: "2024-03-01", completed: "2024-03-05" });
  const now = await ticket(sql, { wo: "WO-0501", received: "2026-09-01", completed: "2026-09-03" });
  const p = await api.previewBillingBackfillFor(sql, [file("invoices.csv", [INVOICES_HEAD, ["WO-0501", "", "", "INV51", "2026-09-20", "Open", "10", "10", "Yes", ""]])], "u-owner");
  assert.equal(p.plans[0].jobId, now);
});

test("the only ticket with a WO number still has to fit the invoice's date (Chuy, 10/30): one far from it is another job's", async () => {
  const sql = await fresh();
  // Came in 2026-09-01, done 2026-09-10: an invoice from a week before it came in to a year after it was done is its
  // own; outside that, skipped with why.
  const id = await ticket(sql, { wo: "WO-0551", received: "2026-09-01", completed: "2026-09-10" });
  const plan = async (...rows) =>
    (await api.previewBillingBackfillFor(sql, [file("invoices.csv", [INVOICES_HEAD, ...rows.map(([inv, date]) => ["WO-0551", "", "", inv, date, "Open", "10", "10", "", ""])])], "u-owner")).plans[0];
  for (const date of ["2026-08-25", "2026-09-02", "2026-09-10", "2027-09-10", ""]) {
    const p = await plan(["INV55", date]);
    assert.deepEqual([p.jobId, p.status, p.reason], [id, "write", null], date || "no date");
  }
  const far = await plan(["INV56", "2026-03-02"]);
  assert.deepEqual(
    [far.jobId, far.status, far.reason],
    [
      null,
      "skip",
      `INV56 (2026-03-02) is too far from ticket #${id} (came in 2026-09-01, done 2026-09-10), the only one with this WO, to be its billing: it may be another job with this WO number. Take its rows out of the file, then run it again.`,
    ],
  );
  assert.equal((await plan(["INV57", "2026-08-24"])).status, "skip", "eight days before it came in");
  assert.equal((await plan(["INV58", "2027-09-11"])).status, "skip", "a year and a day after it was done");
  // One that fits beside one that doesn't: the WO is skipped, naming the one that doesn't.
  const mixed = await plan(["INV59", "2026-09-20"], ["INV50", "2025-12-01"]);
  assert.deepEqual([mixed.status, mixed.reason.slice(0, 31)], ["skip", "INV50 (2025-12-01) is too far f"]);
  // One already on the ticket from an earlier run is named as such.
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, invoice_date, status, total, source) values ($1, 'INV50', '2025-12-01', 'Open', 10, 'standalone')", [id]);
  assert.match((await plan(["INV50", "2025-12-01"])).reason, /INV50 is on the ticket already, from an earlier run: check it in NetSuite\. Take its rows out of the file, then run it again\.$/);
  // A ticket not done yet goes by the day it came in.
  const open = await ticket(sql, { wo: "WO-0552", received: "2026-09-01" });
  await sql.query("update service_jobs set completed_at = null where id = $1", [open]);
  const p = await api.previewBillingBackfillFor(sql, [file("invoices.csv", [INVOICES_HEAD, ["WO-0552", "", "", "INV52", "2026-08-20", "Open", "10", "10", "", ""]])], "u-owner");
  assert.match(p.plans[0].reason, new RegExp(`INV52 \\(2026-08-20\\) is too far from ticket #${open} \\(came in 2026-09-01\\)`));
});

test("two tickets with one WO: every invoice has to fit the ticket picked, and an undated SO on the only ticket is flagged", async () => {
  const sql = await fresh();
  const old = await ticket(sql, { wo: "WO-0553", received: "2024-03-01", completed: "2024-03-05" });
  await ticket(sql, { wo: "WO-0553", received: "2026-09-01", completed: "2026-09-03" });
  // The earliest invoice picks the 2024 ticket; the 2026 invoice isn't its billing, so nothing goes on either.
  const p = await api.previewBillingBackfillFor(
    sql,
    [file("invoices.csv", [INVOICES_HEAD, ["WO-0553", "", "", "INV53", "2024-03-10", "Paid In Full", "10", "0", "", ""], ["WO-0553", "", "", "INV54", "2026-09-20", "Open", "10", "10", "", ""]])],
    "u-owner",
  );
  assert.deepEqual(
    [p.plans[0].status, p.plans[0].reason],
    ["skip", `INV54 (2026-09-20) is too far from ticket #${old} (came in 2024-03-01, done 2024-03-05) to be its billing: it may be another job with this WO number. Take its rows out of the file, then run it again.`],
  );
  // An open Sales Order with no invoice yet has no date to check: it goes on the only ticket, with a warning.
  const only = await ticket(sql, { wo: "WO-0554" });
  const q = await api.previewBillingBackfillFor(sql, [file("invoices.csv", [INVOICES_HEAD, ["WO-0554", "SO5540", "Pending Billing", "", "", "", "", "", "", ""]])], "u-owner");
  assert.deepEqual([q.plans[0].jobId, q.plans[0].status, q.plans[0].so.next], [only, "write", "SO5540"]);
  assert.ok(
    q.plans[0].warnings.includes("No dated invoice in the file backs this Sales Order, so its date can't be checked against the ticket. WO numbers started over in July 2026: make sure SO5540 is this ticket's."),
    q.plans[0].warnings.join(" | "),
  );
  // With a dated invoice that fits, no such warning.
  const r = await api.previewBillingBackfillFor(sql, [file("invoices.csv", [INVOICES_HEAD, ["WO-0554", "SO5540", "Billed", "INV5540", "2026-09-12", "Open", "10", "10", "", ""]])], "u-owner");
  assert.ok(!r.plans[0].warnings.some((w) => w.startsWith("No dated invoice")), r.plans[0].warnings.join(" | "));
});

test("double bill and Corrigo's $0 net against NetSuite's $300 are flagged like for like", async () => {
  const sql = await fresh();
  await ticket(sql, { wo: "WO-0601" });
  await ticket(sql, { wo: "WO-0602" });
  const f = [
    file("charges.csv", [
      CHARGES_HEAD,
      ["WO-0601", "INV61", "", "", "Zz Bean Cafe", "", "Service : TRIPCHARGE", "Service", "Trip", "1", "150", "150", "", "", "229"],
      ["WO-0601", "INV61", "", "", "Zz Bean Cafe", "", "Service : SERVICELABOR", "Service", "Labor", "1", "79", "79", "", "", "229"],
      ["WO-0602", "INV62", "SO62", "", "Zz Bean Cafe", "", "Service : TRIPCHARGE", "Service", "Trip", "1", "150", "150", "", "", "300"],
      ["WO-0602", "INV62", "SO62", "", "Zz Bean Cafe", "", "Service : SERVICELABOR", "Service", "Labor", "1", "150", "150", "", "", "300"],
    ]),
    file("invoices.csv", [
      INVOICES_HEAD,
      ["WO-0601", "", "", "INV61", "2026-10-09", "Open", "229", "229", "Yes", "229"],
      ["WO-0601", "", "", "INV60", "2026-10-09", "Voided", "0", "0", "", "229"],
      ["WO-0601", "SO64", "Billed", "INV64", "2026-10-26", "Open", "229", "229", "", "229"],
      ["WO-0602", "SO62", "Billed", "INV62", "2026-10-15", "Paid In Full", "300", "0", "Yes", "0"],
    ]),
  ];
  const p = await api.previewBillingBackfillFor(sql, f, "u-owner");
  const [a, b] = p.plans;
  assert.equal(a.amounts.doubleBill, true);
  assert.deepEqual([a.amounts.kd, a.amounts.netsuite], [229, 458]);
  assert.equal(a.so.next, "SO64", "the SO from the other live invoice");
  assert.equal(b.amounts.corrigoMismatch, true);
  assert.ok(b.warnings.includes("Corrigo's net is $0.00 and NetSuite billed $300.00: check the discount."));
  assert.equal(p.counts.doubleBill, 1);
});

test("a stale preview writes nothing: changed since the preview, or edited between the plan and the write", async () => {
  const sql = await fresh();
  const id = await ticket(sql, { wo: "WO-0701" });
  const f = [file("invoices.csv", [INVOICES_HEAD, ["WO-0701", "", "", "INV71", "2026-10-02", "Open", "10", "10", "Yes", ""]])];
  const p = await api.previewBillingBackfillFor(sql, f, "u-owner");
  await sql.query("update service_jobs set notes = 'edited', updated_at = now() + interval '1 second' where id = $1", [id]);
  await assert.rejects(() => api.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [] }), /changed since the preview/);
  assert.deepEqual(await invoicesOf(sql, id), []);
  await assert.rejects(() => api.applyBillingBackfillFor(sql, f, "u-owner", { hash: "0123456789abcdef", skip: [] }), /changed since the preview/);
});
