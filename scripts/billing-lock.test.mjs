// NetSuite invoices on tickets and the invoice lock (Grok's billing request through Chuy, 10/28): the billing rules, the
// lock on charges and the Sales Order, the Admin's unlock (reason logged, one save, locked again), the billed date,
// Export Billing (header discount, SO and invoices, the location rule, every no-charges ticket) and the merge guard.
// All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const rules = await import("../src/lib/ops/billing-rules.ts");
const { withHeaderDiscount } = await import("../src/lib/ops/discount.ts");
const { billingCsv } = await import("../src/lib/ops/charges.ts");
const charges = await import("../src/lib/ops/charges-api.ts");
const billing = await import("../src/lib/ops/ticket-billing-api.ts");
const { mergeServiceJobs } = await import("../src/lib/ops/wo-duplicates.ts");

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
      `insert into service_jobs (kind, call_id, customer, wo, status, technician, completed_at, ns_so, discount_kind, discount_value, duplicate_of)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [
        o.kind ?? "service",
        `SC-TEST-${n}`,
        o.customer ?? "Zz Test Cafe",
        o.wo ?? `WO-${String(7000 + n)}`,
        o.status ?? "Completed",
        o.tech ?? "Ryan Gloria",
        o.completed ?? "2026-10-20",
        o.so ?? null,
        o.discount?.kind ?? null,
        o.discount?.value ?? null,
        o.duplicateOf ?? null,
      ],
    )
  )[0].id;
}

async function line(sql, jobId, item, qty, rate, sort = 1) {
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, $2, '', $3, $4, 'part', $5)", [jobId, item, qty, rate, sort]);
}

async function invoice(sql, jobId, inv, status, total, o = {}) {
  await sql.query(
    `insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source, location)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [jobId, inv, o.so ?? null, o.date ?? "2026-10-22", status, total, o.remaining ?? total, o.so ? "so" : "standalone", o.location ?? null],
  );
}

const history = async (sql, id) => (await sql.query("select detail from activity where entity_id = $1 order by id", [id])).map((r) => r.detail);

// ── Pure rules ───────────────────────────────────────────────────────────────────────────────────────────────────

test("invoice status: NetSuite's own word, never worked out from what is still owed", () => {
  assert.equal(rules.invoiceStatusKey("Paid In Full"), "paid");
  assert.equal(rules.invoiceStatusKey("Open"), "open");
  assert.equal(rules.invoiceStatusKey("Voided"), "voided");
  assert.equal(rules.invoiceStatusKey("Pending Approval"), "other");
  // A voided invoice with nothing owed is still Voided (not Paid), so it doesn't lock or count.
  const invs = [
    { invoice: "INV1", status: "Voided", total: 0, remaining: 0 },
    { invoice: "INV2", status: "Open", total: 229, remaining: 229 },
  ];
  assert.equal(rules.liveInvoices(invs).length, 1);
  assert.equal(rules.liveInvoiceTotal(invs), 229);
  assert.equal(rules.lockingInvoice(invs.map((i) => ({ ...i, date: "2026-10-01" }))).invoice, "INV2");
  assert.equal(rules.noInvoiceYet("", "(no invoice yet)"), true);
});

test("double bill and mismatch: two live invoices above the charges; one voided doesn't count", () => {
  const twice = [
    { status: "Open", total: 229 },
    { status: "Voided", total: 0 },
    { status: "Open", total: 229 },
  ];
  assert.equal(rules.possibleDoubleBill(twice, 229), true);
  assert.equal(rules.chargesMismatch(twice, 229), true);
  assert.equal(rules.possibleDoubleBill([{ status: "Open", total: 229 }, { status: "Voided", total: 229 }], 229), false);
  assert.equal(rules.possibleDoubleBill([{ status: "Open", total: 100 }, { status: "Open", total: 129 }], 229), false, "a split bill isn't a double bill");
  assert.equal(rules.chargesMismatch([{ status: "Paid In Full", total: 229.004 }], 229), false, "a cent either way is the same");
  assert.equal(rules.chargesMismatch([], 229), false, "nothing to compare without a live invoice");
});

test("warehouse rule: Lance bills from San Antonio WH, Bill from Dallas WH", () => {
  assert.equal(rules.warehouseForTech("Lance Oden"), "San Antonio WH");
  assert.equal(rules.warehouseForTech("Lance"), "San Antonio WH");
  assert.equal(rules.warehouseForTech("Bill McKinley"), "Dallas WH");
  assert.equal(rules.warehouseForTech("Ryan Gloria"), null);
  assert.equal(rules.locationWarning("Lance Oden", "Houston - WH"), "Lance Oden bills from San Antonio WH, not Houston - WH");
  assert.equal(rules.locationWarning("Lance Oden", "san antonio wh"), null);
  assert.equal(rules.locationWarning("Bill McKinley", "Dallas WH"), null);
  assert.equal(rules.locationWarning("Ryan Gloria", "Dallas WH"), null, "no rule for other techs");
});

test("ServiceChannel id: only a trailing BRSO-TX### comes off", () => {
  assert.equal(rules.stripServiceChannelId("Zz Rock Coffee - Katy BRSO-TX901"), "Zz Rock Coffee - Katy");
  assert.equal(rules.stripServiceChannelId("Zz Rock Coffee - Katy (BRSO-TX902)"), "Zz Rock Coffee - Katy");
  assert.equal(rules.stripServiceChannelId("Zz Rock Coffee - BRSO-TX901"), "Zz Rock Coffee");
  assert.equal(rules.stripServiceChannelId("AMS-QT10 Supply"), "AMS-QT10 Supply");
  assert.equal(rules.stripServiceChannelId("Zz Cafe KATZ-IT"), "Zz Cafe KATZ-IT");
  assert.equal(rules.stripServiceChannelId("BRSO-TX901 Zz Rock"), "BRSO-TX901 Zz Rock", "only at the end");
});

test("header discount: CLDSERVICE at minus the dollars on every row, never a discount line", () => {
  const rows = [
    { jobId: 1, item: "Service : TRIPCHARGE", qty: 1, rate: 150 },
    { jobId: 1, item: "Service : SERVICELABOR", qty: 2, rate: 150 },
    { jobId: 2, item: "Service : TRIPCHARGE", qty: 1, rate: 150 },
  ];
  const out = withHeaderDiscount(rows, new Map([[1, { kind: "percent", value: 10 }]]));
  assert.equal(out.length, 3, "no extra row");
  assert.deepEqual(out.map((r) => [r.jobId, r.discountItem, r.discountRate]), [
    [1, "CLDSERVICE", "-45.00"],
    [1, "CLDSERVICE", "-45.00"],
    [2, "", ""],
  ]);
  assert.deepEqual(rules.headerDiscount(300, { kind: "amount", value: 25 }), { item: "CLDSERVICE", rate: "-25.00", off: 25 });
  assert.equal(rules.headerDiscount(300, null), null);
});

test("NetSuite's discount is read from the lines and the total, whatever its sign", () => {
  assert.deepEqual(rules.discountFromNetSuite(450, -307.2, 142.8), { dollars: 307.2, note: null });
  assert.deepEqual(rules.discountFromNetSuite(300, 300, 0), { dollars: 300, note: null }, "stored positive, total 0");
  assert.deepEqual(rules.discountFromNetSuite(300, null, 300), { dollars: 0, note: null });
  assert.equal(rules.discountFromNetSuite(300, null, 310).dollars, 0);
  assert.match(rules.discountFromNetSuite(300, null, 310).note, /more than its lines/);
  assert.match(rules.discountFromNetSuite(300, -50, 280).note, /doesn't match/);
});

test("filters: from the address bar, and what a row matches", () => {
  const f = rules.parseBillingFilters({ dateBy: "invoiced", dateFrom: "2026-10-01", dateTo: "bad", so: "no", invStatus: "paid", double: "1", board: "x" });
  assert.deepEqual(f, { dateBy: "invoiced", dateFrom: "2026-10-01", so: "no", invStatus: "paid", double: true });
  assert.deepEqual(rules.filtersToSearch(f), { dateBy: "invoiced", dateFrom: "2026-10-01", so: "no", invStatus: "paid", double: "1" });
  const row = {
    board: "service",
    status: "Completed",
    account: "Zz Test Cafe",
    techs: ["Lance Oden"],
    received: "2026-10-01",
    completed: "2026-10-20",
    invoiced: ["2026-10-22"],
    so: null,
    invoiceStatuses: ["Paid In Full", "Voided"],
    doubleBill: true,
    mismatch: true,
    words: ["WO-7001"],
  };
  assert.equal(rules.matchesBillingFilters(row, f), true);
  assert.equal(rules.matchesBillingFilters(row, { ...f, so: "yes" }), false);
  assert.equal(rules.matchesBillingFilters(row, { tech: "Lance" }), true);
  assert.equal(rules.matchesBillingFilters(row, { dateBy: "completed", dateTo: "2026-10-19" }), false);
  assert.equal(rules.matchesBillingFilters(row, { invoice: "no" }), false);
  assert.equal(rules.matchesBillingFilters(row, { q: "7001" }), true);
  assert.equal(rules.activeFilterCount(f), 4);
});

// ── The lock ─────────────────────────────────────────────────────────────────────────────────────────────────────

test("a live invoice locks the charges and the Sales Order for everyone; a voided one doesn't", async () => {
  const sql = await fresh();
  const voided = await ticket(sql);
  await invoice(sql, voided, "INV100", "Voided", 0);
  await charges.writeTicketCharges(sql, voided, "u-desk", { lines: [{ item: "PARTS : ZZ1", description: "", qty: 1, rate: 10 }] });
  assert.equal((await charges.loadTicketCharges(sql, voided)).invoiceLock, null);

  const id = await ticket(sql);
  await line(sql, id, "PARTS : ZZ1", 1, 10);
  await invoice(sql, id, "INV101", "Open", 10);
  const c = await charges.loadTicketCharges(sql, id);
  assert.deepEqual(c.invoiceLock, { invoice: "INV101", status: "Open" });
  assert.equal(c.state, "billed", "an invoice with no SO is billed too");
  await assert.rejects(
    () => charges.writeTicketCharges(sql, id, "u-owner", { lines: [{ item: "PARTS : ZZ1", description: "", qty: 2, rate: 10 }] }),
    /invoiced on INV101 \(Open\).*locked/,
  );
  await assert.rejects(() => charges.recordTicketSalesOrder(sql, id, "u-owner", "SO77"), /invoiced on INV101/);
  // The SQL guard holds even if the check in front of it is skipped.
  const raw = await sql.query(charges.replaceTicketChargesSql(), [id, ["X"], [""], [1], [1], ["part"], true, [], null, null, null, [""]]);
  assert.equal(raw.length, 0);
  assert.equal((await sql.query("select count(*)::int as n from ticket_charges where job_id = $1", [id]))[0].n, 1);
});

test("Admin unlock: a reason is required and logged; one save keeps the SO, dates it, and locks again", async () => {
  const sql = await fresh();
  const id = await ticket(sql, { so: "SO5" });
  await line(sql, id, "PARTS : ZZ1", 1, 10);
  await invoice(sql, id, "INV200", "Paid In Full", 10, { so: "SO5" });
  await assert.rejects(() => billing.unlockTicketBillingFor(sql, id, "u-desk", "fix it"), /Only an Admin/);
  await assert.rejects(() => billing.unlockTicketBillingFor(sql, id, "u-owner", " "), /Say why/);
  await billing.unlockTicketBillingFor(sql, id, "u-owner", "NetSuite credit memo changed the part");
  const open = await charges.loadTicketCharges(sql, id);
  assert.equal(open.unlock?.by, "chuy");
  assert.equal(open.unlock?.reason, "NetSuite credit memo changed the part");
  assert.ok((await history(sql, id)).some((d) => /Unlocked the invoiced charges .*why: NetSuite credit memo changed the part/.test(d)));
  // Normal saves stay locked while it is unlocked: only the Admin's save goes through.
  await assert.rejects(() => charges.writeTicketCharges(sql, id, "u-desk", { lines: [{ item: "PARTS : ZZ1", description: "", qty: 1, rate: 12 }] }), /locked/);
  await charges.writeTicketCharges(sql, id, "u-owner", {
    lines: [{ item: "PARTS : ZZ1", description: "", qty: 1, rate: 12 }],
    unlocked: { nsSo: "SO5", billedAt: "2026-10-22" },
  });
  const after = (await sql.query("select ns_so, to_char(billed_at at time zone 'America/Chicago', 'YYYY-MM-DD') as day, billing_unlocked_at from service_jobs where id = $1", [id]))[0];
  assert.equal(after.ns_so, "SO5", "the SO is kept");
  assert.equal(after.day, "2026-10-22", "billed on the SO/invoice date, not today");
  assert.equal(after.billing_unlocked_at, null, "saving locks it again");
  assert.equal((await charges.loadTicketCharges(sql, id)).lines[0].rate, 12);
  assert.ok((await history(sql, id)).some((d) => /saved while unlocked \(Admin\).*Sales Order SO5 · locked again/.test(d)));
  // Locked again: a second save needs a second unlock.
  await assert.rejects(
    () => charges.writeTicketCharges(sql, id, "u-owner", { lines: [{ item: "PARTS : ZZ1", description: "", qty: 1, rate: 13 }], unlocked: { nsSo: "SO5", billedAt: null } }),
    /ran out or was closed/,
  );
});

test("an unlock runs out after an hour; Lock Without Saving closes it and says so", async () => {
  const sql = await fresh();
  const id = await ticket(sql);
  await invoice(sql, id, "INV300", "Open", 0);
  await billing.unlockTicketBillingFor(sql, id, "u-owner", "fix the labor");
  await sql.query("update service_jobs set billing_unlocked_at = now() - interval '61 minutes' where id = $1", [id]);
  assert.equal((await charges.loadTicketCharges(sql, id)).unlock, null);
  await assert.rejects(
    () => charges.writeTicketCharges(sql, id, "u-owner", { lines: [], unlocked: { nsSo: null, billedAt: null } }),
    /ran out/,
  );
  await billing.unlockTicketBillingFor(sql, id, "u-owner", "second try");
  await billing.relockTicketBillingFor(sql, id, "u-owner");
  assert.equal((await charges.loadTicketCharges(sql, id)).unlock, null);
  assert.ok((await history(sql, id)).some((d) => /Locked the invoiced charges again, with no changes/.test(d)));
  // A ticket with no live invoice can't be unlocked (nothing is locked).
  const plain = await ticket(sql);
  await assert.rejects(() => billing.unlockTicketBillingFor(sql, plain, "u-owner", "why not"), /isn't locked/);
});

test("Mark Billed takes the SO or invoice date instead of today", async () => {
  const sql = await fresh();
  const id = await ticket(sql);
  await charges.recordTicketSalesOrder(sql, id, "u-desk", "so 4345", "2026-09-30");
  const row = (await sql.query("select ns_so, to_char(billed_at at time zone 'America/Chicago', 'YYYY-MM-DD') as day from service_jobs where id = $1", [id]))[0];
  assert.deepEqual(row, { ns_so: "SO4345", day: "2026-09-30" });
  await charges.recordTicketSalesOrder(sql, id, "u-desk", null);
  assert.equal((await sql.query("select billed_at from service_jobs where id = $1", [id]))[0].billed_at, null);
});

test("ticket billing view: invoices, double bill, mismatch, Corrigo net, location rule and the account check", async () => {
  const sql = await fresh();
  await sql.query("insert into directory_customers (name) values ('Zz Test Cafe'), ('Zz Other Cafe')");
  const id = await ticket(sql, { tech: "Lance Oden" });
  await sql.query("update service_jobs set corrigo_net = 0, service_location = 'Zz Other Cafe BRSO-TX901' where id = $1", [id]);
  await line(sql, id, "Service : TRIPCHARGE", 1, 229);
  await invoice(sql, id, "INV5889", "Open", 229, { date: "2026-10-09", location: "Houston - WH" });
  await invoice(sql, id, "INV6207", "Voided", 0, { date: "2026-10-09" });
  await invoice(sql, id, "INV7623", "Open", 229, { so: "SO4350", date: "2026-10-26", location: "San Antonio WH" });
  const view = await billing.loadTicketBilling(sql, id, false);
  assert.equal(view.invoices.length, 3);
  assert.equal(view.liveTotal, 458);
  assert.equal(view.doubleBill, true);
  assert.equal(view.mismatch, true);
  assert.equal(view.corrigoNet, 0);
  assert.deepEqual(view.lockedBy, { invoice: "INV7623", status: "Open" });
  assert.equal(view.locationAccount, "Zz Other Cafe", "the Corrigo location is another account");
  assert.deepEqual(view.locationWarnings, ["Lance Oden bills from San Antonio WH, not Houston - WH"]);
  const summaries = await billing.loadBillingSummaries(sql);
  assert.equal(summaries.get(id).doubleBill, true);
  assert.deepEqual(summaries.get(id).invoicedDates, ["2026-10-09", "2026-10-26"]);
});

// ── Export Billing ───────────────────────────────────────────────────────────────────────────────────────────────

test("Export Billing: header discount columns, SO and invoices, location, invoiced tickets left out, every no-charges ticket", async () => {
  const sql = await fresh();
  const a = await ticket(sql, { wo: "WO-7101", tech: "Lance Oden", discount: { kind: "percent", value: 10 } });
  await line(sql, a, "Service : TRIPCHARGE", 1, 150, 1);
  await line(sql, a, "Service : SERVICELABOR", 2, 150, 2);
  const invoiced = await ticket(sql, { wo: "WO-7102" });
  await line(sql, invoiced, "Service : TRIPCHARGE", 1, 150);
  await invoice(sql, invoiced, "INV9", "Open", 150, { location: "Houston - WH" });
  const voided = await ticket(sql, { wo: "WO-7103", tech: "Bill McKinley" });
  await line(sql, voided, "Service : TRIPCHARGE", 1, 150);
  await invoice(sql, voided, "INV10", "Voided", 0);
  for (let i = 0; i < 230; i += 1) await ticket(sql, { wo: `WO-8${String(i).padStart(3, "0")}` });
  // Walk-In is never a billing account: its charges stay out of the file, and the ticket is listed.
  const walkIn = await ticket(sql, { wo: "WO-7104", customer: "Walk-In" });
  await line(sql, walkIn, "Service : TRIPCHARGE", 1, 150);

  const out = await charges.exportBillingFor(sql, { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(out.noAccount.map((t) => [t.id, t.wo, t.customer]), [[walkIn, "WO-7104", "Walk-In"]]);
  assert.ok(!out.csv.includes("WO-7104"));
  const [head, ...rows] = out.csv.trim().split("\r\n");
  assert.match(head, /,Work Done,Discount Item,Discount Rate,SO,Invoices,Location$/);
  assert.equal(out.tickets, 2, "the invoiced ticket is billed already");
  assert.equal(rows.length, 3, "no discount line");
  assert.ok(rows.filter((r) => r.startsWith("WO-7101,")).every((r) => r.endsWith(",CLDSERVICE,-45.00,,,San Antonio WH")));
  assert.ok(rows.find((r) => r.startsWith("WO-7103,")).endsWith(",,,,INV10 Voided,Dallas WH"));
  assert.equal(out.total, 555, "405 after the discount, plus 150");
  assert.equal(out.noCharges.length, 230, "no 200 cap");
  assert.deepEqual(out.locationRules.sort((x, y) => x.location.localeCompare(y.location)), [
    { location: "Dallas WH", tickets: 1 },
    { location: "San Antonio WH", tickets: 1 },
  ]);

  const all = await charges.exportBillingFor(sql, { from: "2026-10-01", to: "2026-10-31", includeBilled: true });
  assert.equal(all.tickets, 3);
  assert.ok(all.csv.includes(",INV9 Open,Houston - WH"));
  assert.equal(all.locationWarnings.length, 0);
  // The CSV helper still quotes and defuses.
  assert.match(billingCsv([{ wo: "WO-1", po: "", customer: "A", accountNumber: "", netsuiteId: "", technician: "", completed: "", item: "X", description: "=1+1", qty: 1, rate: 1, workDone: "" }]), /'=1\+1/);
});

// ── A save waiting on the Billing Backfill ───────────────────────────────────────────────────────────────────────

test("a save, Mark Billed or a Corrigo P.O. only writes to the ticket row as its statement first read it", () => {
  // A lock check that reads ticket_invoices sees the statement's snapshot, even after waiting for the ticket's row, so
  // an invoice the backfill commits meanwhile is missed. The backfill touches every ticket it writes; these writes
  // compare the row (re-read after the wait) with the snapshot. PGlite has one connection, so the race itself was
  // tried on a throwaway Postgres 16 (10/28): before, the save wrote; after, it wrote nothing and Mark Billed refused.
  const guard = "updated_at = (select seen_row.updated_at from service_jobs seen_row where seen_row.id = $1)";
  assert.ok(charges.replaceTicketChargesSql().includes(`s.${guard}`));
  const api = readFileSync(new URL("../src/lib/ops/charges-api.ts", import.meta.url), "utf8");
  const mark = api.slice(api.indexOf("export async function recordTicketSalesOrder"), api.indexOf("export const setTicketSalesOrder"));
  assert.match(mark, /and \$\{UNCHANGED_SINCE_READ\("service_jobs", "\$1"\)\}/);
  const corrigo = readFileSync(new URL("../src/lib/ops/corrigo-import.ts", import.meta.url), "utf8");
  assert.match(corrigo, /po = case when \$9::text is not null[^\n]*\n\s*and \$\{UNCHANGED_SINCE_READ\("service_jobs", "\$1"\)\} then \$9::text else po end/);
  const backfill = readFileSync(new URL("../src/lib/ops/billing-backfill-api.ts", import.meta.url), "utf8");
  // Every planned ticket is touched (no "and not p.locked" left on the update).
  assert.ok(backfill.includes("updated_at = now()\n    from plan p, ok\n   where ok.go and s.id = p.job_id\n  returning s.id"));
});

// ── Merge guard ──────────────────────────────────────────────────────────────────────────────────────────────────

test("merging: a ticket with NetSuite invoices can't be folded away, and charges can't move onto an invoiced ticket", async () => {
  const sql = await fresh();
  const keeper = await ticket(sql, { wo: "WO-7201" });
  const extra = await ticket(sql, { wo: "WO-7201" });
  await invoice(sql, extra, "INV11", "Paid In Full", 0);
  const out = await mergeServiceJobs(sql, keeper, extra, "chuy");
  assert.match(out.refused, /has NetSuite invoices/);

  const k2 = await ticket(sql, { wo: "WO-7202" });
  const e2 = await ticket(sql, { wo: "WO-7202" });
  await invoice(sql, k2, "INV12", "Open", 10);
  await line(sql, e2, "PARTS : ZZ2", 1, 10);
  const out2 = await mergeServiceJobs(sql, k2, e2, "chuy");
  assert.match(out2.refused, /invoiced on INV12/);

  // An invoiced keeper keeps its own P.O.: the merge doesn't fill it in from the other ticket. Not invoiced: it does.
  const k3 = await ticket(sql, { wo: "WO-7203" });
  const e3 = await ticket(sql, { wo: "WO-7203" });
  await invoice(sql, k3, "INV13", "Open", 10);
  await sql.query("update service_jobs set po = 'PO-EXTRA' where id = $1", [e3]);
  const out3 = await mergeServiceJobs(sql, k3, e3, "chuy");
  assert.equal(out3.refused, undefined);
  assert.deepEqual(await sql.query("select po, duplicate_of from service_jobs where id = any($1::int[]) order by id", [[k3, e3]]), [
    { po: null, duplicate_of: null },
    { po: "PO-EXTRA", duplicate_of: k3 },
  ]);
  const k4 = await ticket(sql, { wo: "WO-7204" });
  const e4 = await ticket(sql, { wo: "WO-7204" });
  await sql.query("update service_jobs set po = 'PO-FILL' where id = $1", [e4]);
  await mergeServiceJobs(sql, k4, e4, "chuy");
  assert.deepEqual(await sql.query("select po from service_jobs where id = $1", [k4]), [{ po: "PO-FILL" }]);
});
