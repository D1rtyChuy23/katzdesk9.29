// Merge into install for a ticket billed on a NetSuite Sales Order (Grok through Chuy, 10/30): its charges stay billed
// on that SO. They never go on the install's invoice, the install's Invoice window lists them as billed, the account's
// Invoices tab shows the ticket as billed, Export Billing never takes them, and the billing lists count them once.
// Shaped like the first real case (one $500.00 line on a Sales Order, merging into the install with its WO); all data
// is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const M = await import("../src/lib/ops/ticket-install-merge.ts");
const { approveInvoiceFor, getInvoiceFor, listAccountInvoicesFor } = await import("../src/lib/ops/invoice-api.ts");
const { exportBillingFor, invoicedPartLines, recordTicketSalesOrder } = await import("../src/lib/ops/charges-api.ts");
const { loadTicketBillingRows } = await import("../src/lib/ops/billing-report-api.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
const { previewBillingBackfillFor, applyBillingBackfillFor, APPLY_BACKFILL_SQL } = await import("../src/lib/ops/billing-backfill-api.ts");
const { loadPartUses } = await import("../src/lib/ops/part-usage-api.ts");
const { todayChicago, addDays } = await import("../src/lib/ops/clock.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

const CAFE = "Test Sushi - Bayfront";
const WO = "WO-4792";
const SO = "SO9001";
const BILLED = `Billed on ${SO}: charges carry over as billed, not re-billed.`;
const TODAY = todayChicago();
const RANGE = { from: addDays(TODAY, -30), to: TODAY };
const LABOR_500 = { item: "Service : SERVICELABOR", description: "Service : SERVICELABOR line", qty: 1, rate: 500, kind: "labor" };

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'boss', true, true, 'admin')");
  await pg.query("insert into directory_customers (name, account_number) values ($1, 'TEST-1')", [CAFE]);
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}
const one = async (pg, text, params) => (await pg.query(text, params)).rows[0];
async function ticket(pg, fields = {}) {
  const f = { kind: "service", call_id: "SC-202610-901", customer: CAFE, issue: "1 Test Way", status: "Open", wo: WO, received: addDays(TODAY, -18), completed_at: addDays(TODAY, -2), technician: "Test Tech", ...fields };
  const cols = Object.keys(f);
  return Number((await one(pg, `insert into service_jobs (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f))).id);
}
async function install(pg, fields = {}) {
  const f = { received: addDays(TODAY, -21), customer: CAFE, equip_status: "Installed", complete: true, wo: WO, completed_at: addDays(TODAY, -3), technician: "Test Tech", ...fields };
  const cols = Object.keys(f);
  return Number((await one(pg, `insert into installs (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f))).id);
}
const charge = (pg, jobId, item, qty, rate, kind, sort) =>
  pg.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, $2, $3, $4, $5, $6, $7)", [jobId, item, `${item} line`, qty, rate, kind, sort]);
const preview = (sql, jobId, installId) => M.previewTicketInstallMergeFor(sql, "u-owner", { jobId, installId });
// billedSo: the Sales Order the confirm showed ('' for none); left out, as a window from before 10/30 sends it.
const merge = (sql, jobId, installId, stamps, billedSo) => M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId, installId, stamps, ...(billedSo === undefined ? {} : { billedSo }) });
/** Merge as the confirm `p` showed it. */
const mergeShown = (sql, jobId, installId, p) => merge(sql, jobId, installId, p.stamps, p.moves.billed?.so ?? "");
/** The billed ticket of the first real case's shape: one $500.00 line, on a Sales Order. */
async function billedTicket(pg, fields = {}) {
  const jobId = await ticket(pg, { ns_so: SO, ...fields });
  await charge(pg, jobId, LABOR_500.item, 1, 500, "labor", 1);
  return jobId;
}
async function snapshot(pg) {
  const t = async (q) => JSON.stringify((await pg.query(q)).rows);
  return [
    await t("select id, duplicate_of, merged_install_id, ns_so, done, updated_at from service_jobs order by id"),
    await t("select id, notes, updated_at from installs order by id"),
    await t("select * from invoices order by id"),
    await t("select * from invoice_lines order by id"),
    await t("select count(*) from activity"),
    await t("select count(*) from ticket_install_merges"),
  ].join("\n");
}

test("a ticket billed on a Sales Order merges: its charges stay billed there, never on the install's invoice, and the install lists them as billed", async () => {
  const { pg, sql } = await fresh();
  const jobId = await billedTicket(pg, { po: "PO-T9" });
  const installId = await install(pg);
  // Before: billed, so Export Billing takes it only when asked for billed tickets too.
  assert.deepEqual([(await exportBillingFor(sql, { ...RANGE })).tickets, (await exportBillingFor(sql, { ...RANGE, includeBilled: true })).tickets], [0, 1]);

  // The confirm says so, and nothing about the install's invoice applies.
  const p = await preview(sql, jobId, installId);
  assert.equal(p.refusal, null);
  assert.deepEqual(p.moves.billed, { so: SO, invoices: null, text: BILLED });
  assert.deepEqual([p.moves.chargeLines, p.moves.chargeTotal, p.moves.invoiceTotal, p.moves.invoicePo], [1, 500, 0, null]);
  assert.deepEqual(p.stays, ["Its own record and history", `Its Sales Order ${SO}`, `Its charge lines, billed on ${SO} (the install lists them as billed)`]);
  // The Sales Order goes back from the confirm on its own, not in the stamps (an older window passes those along).
  assert.deepEqual(Object.keys(p.stamps).sort(), ["head", "install", "job"]);
  assert.ok(p.note.includes("\nP.O.: PO-T9\n") && p.note.endsWith(`\n${BILLED}`), p.note);

  const r = await mergeShown(sql, jobId, installId, p);
  assert.deepEqual([r.chargeLines, r.billedOn], [0, SO]);

  // No invoice was made for the install, and the ticket kept its Sales Order and its charges.
  assert.equal(Number((await one(pg, "select count(*)::int as n from invoices where entity_type = 'install'")).n), 0);
  const t = await one(pg, "select duplicate_of, merged_install_id, ns_so from service_jobs where id = $1", [jobId]);
  assert.deepEqual([t.duplicate_of, t.merged_install_id, t.ns_so], [jobId, installId, SO]);
  assert.equal(Number((await one(pg, "select count(*)::int as n from ticket_charges where job_id = $1", [jobId])).n), 1);
  // The merge log keeps the Sales Order and a copy of the lines billed on it.
  const log = (await one(pg, "select moved from ticket_install_merges where job_id = $1", [jobId])).moved;
  assert.deepEqual([log.billedSo, log.billedInvoices, Number(log.billedTotal), log.invoiceId, log.invoiceLines], [SO, null, 500, null, []]);
  assert.deepEqual(log.billedLines.map((l) => ({ ...l, qty: Number(l.qty), rate: Number(l.rate) })), [LABOR_500]);
  // The install's notes end with the ticket's text and the Sales Order.
  assert.ok((await one(pg, "select notes from installs where id = $1", [installId])).notes.endsWith(`\n${BILLED}`));

  // The install's Invoice window: its own invoice empty, the ticket's charges listed as billed on the SO.
  const iv = await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner");
  assert.deepEqual([iv.state, iv.lines.length, iv.total], ["none", 0, 0]);
  assert.deepEqual(iv.billedElsewhere, [{ jobId, ticket: `SC-202610-901 (${WO})`, so: SO, invoices: null, lines: [LABOR_500], total: 500 }]);
  // The ticket's own window says where its charges are.
  assert.equal(
    (await getInvoiceFor(sql, { type: "service", id: jobId }, "u-owner")).locked,
    `This ticket was merged into install #${installId}. Its charges were billed on ${SO} and stay billed there; the install lists them as billed.`,
  );
  // The account's Invoices tab: the ticket, billed on its SO (never waiting or not approved), and no install invoice.
  assert.deepEqual(
    (await listAccountInvoicesFor(sql, CAFE, "u-owner")).map((x) => [x.type, x.id, x.total, x.status]),
    [["service", jobId, 500, `Billed ${SO} · merged into install #${installId}`]],
  );
  // Export Billing never takes it now, billed tickets included.
  for (const includeBilled of [false, true]) assert.equal((await exportBillingFor(sql, { ...RANGE, includeBilled })).tickets, 0, String(includeBilled));
  // The history on both records says so.
  const acts = (await pg.query("select entity_type, detail from activity where action = 'merged' order by id")).rows;
  assert.deepEqual(acts.map((a) => a.entity_type), ["install", "service"]);
  for (const a of acts) assert.ok(a.detail.includes(` · its charges stay billed on ${SO}, not billed again`), a.detail);
});

test("billed, with a NetSuite invoice and QuickBooks history, onto an install whose invoice is approved: it merges, and that invoice is left as it was", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg, { ns_so: SO, po: "PO-T1", discount_kind: "percent", discount_value: 10 });
  await charge(pg, jobId, "PARTS : TESTGASKET", 2, 12.5, "part", 1);
  await pg.query("insert into ticket_invoices (job_id, ns_invoice, status) values ($1, 'INV-77', 'Paid In Full')", [jobId]);
  const qbRun = Number((await one(pg, "insert into wo_history_runs (filename) values ('test.xlsx') returning id")).id);
  await pg.query("insert into wo_history (run_id, history_ref, wo, customer, job_id) values ($1, 'QB-9', $2, $3, $4)", [qbRun, WO, CAFE, jobId]);
  const installId = await install(pg);
  const own = await approveInvoiceFor(
    sql,
    { type: "install", id: installId, lines: [{ item: "Service : SERVICELABOR", description: "Install labor", qty: 3, rate: 150 }], lineIds: [], discount: { kind: "amount", value: "20" }, seen: null, po: "PO-OWN" },
    "u-owner",
  );

  const p = await preview(sql, jobId, installId);
  assert.equal(p.refusal, null);
  assert.deepEqual(p.moves.billed, { so: SO, invoices: "INV-77", text: `Billed on ${SO} (NetSuite invoice INV-77): charges carry over as billed, not re-billed.` });
  // The ticket's $25.00 less its 10%; the install's invoice stays at $430.00 with its own P.O.; no "approve again" warning.
  assert.deepEqual([p.moves.chargeTotal, p.moves.invoiceTotal, p.moves.invoicePo, p.warnings], [22.5, 430, null, []]);
  await mergeShown(sql, jobId, installId, p);

  const after = await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner");
  assert.deepEqual([after.version, after.state, after.total, after.po, after.lines.length], [own.version, "approved", 430, "PO-OWN", 1]);
  assert.deepEqual(after.billedElsewhere.map((b) => [b.so, b.invoices, b.total, b.lines.length]), [[SO, "INV-77", 22.5, 1]]);
  // The NetSuite invoice and the QuickBooks history stay with the ticket.
  assert.equal(Number((await one(pg, "select count(*)::int as n from ticket_invoices where job_id = $1", [jobId])).n), 1);
  assert.equal(Number((await one(pg, "select count(*)::int as n from wo_history where job_id = $1", [jobId])).n), 1);
});

test("what the confirm showed is what merges: a Sales Order cleared or entered since is refused, and nothing is written", async () => {
  const { pg, sql } = await fresh();
  const jobId = await billedTicket(pg);
  const installId = await install(pg);
  const billed = await preview(sql, jobId, installId);
  // Cleared since, straight on the row (its stamp didn't move): the confirm said billed, so nothing merges.
  await pg.query("update service_jobs set ns_so = null where id = $1", [jobId]);
  let before = await snapshot(pg);
  await assert.rejects(() => mergeShown(sql, jobId, installId, billed), { message: M.CHANGED_SINCE_OPENED });
  assert.equal(await snapshot(pg), before);
  // Read unbilled, then a Sales Order entered the same way: the confirm said the charges go on the invoice.
  const unbilled = await preview(sql, jobId, installId);
  assert.equal(unbilled.moves.billed, null);
  await pg.query("update service_jobs set ns_so = $2 where id = $1", [jobId, SO]);
  before = await snapshot(pg);
  await assert.rejects(() => mergeShown(sql, jobId, installId, unbilled), { message: M.CHANGED_SINCE_OPENED });
  // A window from before this release (its confirm would say the charges go on the install's invoice) sends no Sales
  // Order: a billed ticket isn't merged from it, with this preview or an older one.
  for (const p of [billed, unbilled]) {
    await assert.rejects(() => merge(sql, jobId, installId, p.stamps), { message: M.RELOAD_FOR_BILLED(SO) });
  }
  // The statement checks it too, on the locked row.
  const run = (so) => sql.query(M.mergeTicketIntoInstallSql(), [jobId, installId, "boss", billed.stamps.job, billed.stamps.install, billed.stamps.head, "note", 0, null, null, null, so, so ? 500 : null]);
  assert.deepEqual(await run(""), []);
  assert.deepEqual(await run("SO9002"), []);
  // A repair quote or a stacked PM added after the read: still refused, read fresh in the statement.
  await pg.query("insert into repair_quotes (job_id) values ($1)", [jobId]);
  assert.deepEqual(await run(SO), []);
  await pg.query("delete from repair_quotes");
  const pm = Number((await one(pg, "insert into pm_jobs (customer, status, stacked_job_id) values ($1, 'Open', $2) returning id", [CAFE, jobId])).id);
  assert.deepEqual(await run(SO), []);
  await pg.query("update pm_jobs set stacked_job_id = null where id = $1", [pm]);
  assert.equal(await snapshot(pg), before);
  // Read again, billed: it merges.
  assert.equal((await mergeShown(sql, jobId, installId, await preview(sql, jobId, installId))).billedOn, SO);
});

test("a billed merge stays billed: its Sales Order can't be cleared or changed, and Merge installs takes it to the install kept", async () => {
  const { pg, sql } = await fresh();
  const jobId = await billedTicket(pg);
  const installId = await install(pg);
  await mergeShown(sql, jobId, installId, await preview(sql, jobId, installId));
  await assert.rejects(() => recordTicketSalesOrder(sql, jobId, "u-owner", null), {
    message: `This ticket was merged into install #${installId} as billed on ${SO}, so its Sales Order stays.`,
  });
  await assert.rejects(() => recordTicketSalesOrder(sql, jobId, "u-owner", "SO9002"), { message: `This ticket was merged into install #${installId}. Its work is on the install now.` });
  assert.equal((await one(pg, "select ns_so from service_jobs where id = $1", [jobId])).ns_so, SO);

  // Merge installs: the install kept lists the billed charges; the archived one is off the list.
  const keep = await install(pg, { wo: "WO-4800" });
  assert.equal((await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: installId })).invoiceMoved, false);
  assert.equal(Number((await one(pg, "select merged_install_id from service_jobs where id = $1", [jobId])).merged_install_id), keep);
  assert.deepEqual((await getInvoiceFor(sql, { type: "install", id: keep }, "u-owner")).billedElsewhere.map((b) => [b.jobId, b.so, b.total]), [[jobId, SO, 500]]);
  assert.match((await getInvoiceFor(sql, { type: "service", id: jobId }, "u-owner")).locked, new RegExp(`merged into install #${keep}\\. Its charges were billed on ${SO}`));
});

test("billing lists count a billed merged ticket once: parts profit and the Invoices page as before, Export Billing never", async () => {
  const { pg, sql } = await fresh();
  await pg.query("insert into billing_items (sku, item, kind, rate, cost) values ('TESTGASKET', 'PARTS : TESTGASKET', 'part', 12.5, 5)");
  const jobId = await ticket(pg, { ns_so: SO });
  await charge(pg, jobId, "PARTS : TESTGASKET", 2, 12.5, "part", 1);
  const unbilledId = await ticket(pg, { call_id: "SC-202610-902" });
  const installId = await install(pg);
  const parts = async () => (await invoicedPartLines(sql, RANGE)).lines.map((l) => [l.sku, l.qty]);
  const page = async () => (await loadTicketBillingRows(sql, { kind: "service" })).map((r) => [r.id, r.so]).sort((a, b) => a[0] - b[0]);
  const partsBefore = await parts();
  assert.deepEqual(partsBefore, [["TESTGASKET", 2]]);
  assert.deepEqual(await page(), [[jobId, SO], [unbilledId, null]]);

  await mergeShown(sql, jobId, installId, await preview(sql, jobId, installId));
  assert.deepEqual(await parts(), partsBefore);
  assert.deepEqual(await page(), [[jobId, SO], [unbilledId, null]]);
  for (const includeBilled of [false, true]) assert.equal((await exportBillingFor(sql, { ...RANGE, includeBilled })).tickets, 0, String(includeBilled));
  // The install's invoice and the account's install row count none of it.
  assert.equal(Number((await one(pg, "select count(*)::int as n from invoices where entity_type = 'install'")).n), 0);
  assert.equal((await listAccountInvoicesFor(sql, CAFE, "u-owner")).filter((x) => x.type === "install").length, 0);
});

test("a billed merge doesn't depend on the install's invoice, and names only NetSuite invoices that stand", async () => {
  const { pg, sql } = await fresh();
  const jobId = await billedTicket(pg);
  await pg.query("insert into ticket_invoices (job_id, ns_invoice, status) values ($1, 'INV-70', 'Voided'), ($1, 'INV-71', 'Open')", [jobId]);
  const installId = await install(pg);
  const p = await preview(sql, jobId, installId);
  assert.deepEqual(p.moves.billed, { so: SO, invoices: "INV-71", text: `Billed on ${SO} (NetSuite invoice INV-71): charges carry over as billed, not re-billed.` });
  // The install's invoice approved after the confirm read it: nothing goes on it, so the merge still goes ahead.
  await approveInvoiceFor(sql, { type: "install", id: installId, lines: [{ item: "Service : SERVICELABOR", description: "Install labor", qty: 1, rate: 150 }], lineIds: [], discount: null, seen: null }, "u-owner");
  const own = await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner");
  assert.equal((await mergeShown(sql, jobId, installId, p)).billedOn, SO);
  const after = await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner");
  assert.deepEqual([after.version, after.total], [own.version, 150]);
  assert.deepEqual(after.billedElsewhere.map((b) => [b.invoices, b.total]), [["INV-71", 500]]);
  assert.equal((await one(pg, "select moved->>'billedInvoices' as i from ticket_install_merges")).i, "INV-71");
  // In the statement too: the invoice stamp it is given is checked for an unbilled ticket only.
  const j2 = await billedTicket(pg, { call_id: "SC-202610-908", wo: "WO-4830" });
  const i2 = await install(pg, { wo: "WO-4830" });
  const p2 = await preview(sql, j2, i2);
  const ran = await sql.query(M.mergeTicketIntoInstallSql(), [j2, i2, "boss", p2.stamps.job, p2.stamps.install, "1:stale:stamp", "note", 0, null, null, null, SO, 500]);
  assert.equal(ran.length, 1);
});

test("the Billing Backfill records a billed merged ticket's NetSuite invoices, and nothing else", async () => {
  const { pg, sql } = await fresh();
  const jobId = await billedTicket(pg);
  const installId = await install(pg);
  await mergeShown(sql, jobId, installId, await preview(sql, jobId, installId));
  const csv = (rows) => rows.map((r) => r.join(",")).join("\n") + "\n";
  const file = (name, rows) => ({ name, base64: Buffer.from(csv(rows)).toString("base64") });
  const INVOICES_HEAD = ["WO", "SO #", "SO status", "Invoice #", "Invoice date", "Invoice status", "Invoice total", "Amount remaining", "Charges source", "Corrigo net (reference)"];
  const CHARGES_HEAD = ["WO", "Source invoice #", "Source SO #", "PO", "NetSuite customer", "Location", "Item", "Item type", "Description", "Qty", "Rate", "Amount", "Discount Item", "Discount Amount", "Record total (after discount)"];
  const files = [
    file("charges.csv", [CHARGES_HEAD, [WO, "INV9001", SO, "", CAFE, "", "Service : SERVICELABOR", "Service", "Labor", "2", "150", "300", "", "", "300"]]),
    file("invoices.csv", [INVOICES_HEAD, [WO, SO, "Billed", "INV9001", TODAY, "Open", "500", "500", "Yes", ""]]),
  ];
  const plan = (await previewBillingBackfillFor(sql, files, "u-owner")).plans[0];
  assert.deepEqual([plan.jobId, plan.status, plan.locked, plan.charges.next], [jobId, "invoices", true, null]);
  assert.ok(plan.warnings.includes(`Merged into install #${installId} as billed on ${SO}: only its NetSuite invoices are recorded; its charges and Sales Order stay as they are.`), plan.warnings.join(" | "));
  const before = await one(pg, "select ns_so, discount_kind, (select count(*)::int from ticket_charges c where c.job_id = j.id) as lines from service_jobs j where id = $1", [jobId]);
  // The write itself takes invoices only for it: a plan that would write its charges or SO is refused whole (checked
  // while it has no NetSuite invoice, which would refuse such a plan on its own).
  const seen = (await one(pg, "select updated_at::text as u from service_jobs where id = $1", [jobId])).u;
  const forced = [{ job_id: jobId, seen, locked: false, write_charges: true, dk: null, dv: null, set_so: true, so: "SO9999", billed_on: null, log: "x" }];
  const r = (await pg.query(APPLY_BACKFILL_SQL, [JSON.stringify(forced), JSON.stringify([{ job_id: jobId, item: "X", description: "", qty: 1, rate: 1, kind: "part", ord: 1 }]), "[]", "boss"])).rows[0];
  assert.equal(r.go, false);
  assert.deepEqual(await one(pg, "select ns_so, discount_kind, (select count(*)::int from ticket_charges c where c.job_id = j.id) as lines from service_jobs j where id = $1", [jobId]), before);
  await applyBillingBackfillFor(sql, files, "u-owner", { hash: (await previewBillingBackfillFor(sql, files, "u-owner")).hash, skip: [] });
  // The invoice is recorded; the charges, discount and Sales Order are as they were; the install lists the invoice.
  assert.deepEqual((await pg.query("select ns_invoice, status from ticket_invoices where job_id = $1", [jobId])).rows, [{ ns_invoice: "INV9001", status: "Open" }]);
  assert.deepEqual(await one(pg, "select ns_so, discount_kind, (select count(*)::int from ticket_charges c where c.job_id = j.id) as lines from service_jobs j where id = $1", [jobId]), before);
  assert.deepEqual((await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner")).billedElsewhere.map((b) => [b.so, b.invoices, b.total]), [[SO, "INV9001", 500]]);
  // Rows on another Sales Order (the install's own billing on the WO) never go on it, alone or with its own.
  const otherSo = file("invoices.csv", [INVOICES_HEAD, [WO, "SO9500", "Billed", "INV9500", TODAY, "Open", "999", "999", "", ""]]);
  const mixed = file("invoices.csv", [INVOICES_HEAD, [WO, SO, "Billed", "INV9002", TODAY, "Open", "10", "10", "", ""], [WO, "SO9500", "Billed", "INV9500", TODAY, "Open", "999", "999", "", ""]]);
  const offSo = (await previewBillingBackfillFor(sql, [otherSo], "u-owner")).plans[0];
  assert.deepEqual([offSo.status, offSo.jobId, offSo.reason], ["skip", null, `Ticket #${jobId} was merged into install #${installId} as billed on ${SO}; these rows are on SO9500. Skipped.`]);
  const both = (await previewBillingBackfillFor(sql, [mixed], "u-owner")).plans[0];
  assert.deepEqual([both.status, both.reason], ["skip", `The rows are on ${SO}, SO9500, and ticket #${jobId} was merged into install #${installId} as billed on ${SO}. Record its invoices by hand, or split the file by Sales Order.`]);
  // A live ticket on the same WO: the rows on the merged ticket's SO still go to the merged ticket; others to the live one.
  const live = await ticket(pg, { call_id: "SC-202610-907" });
  assert.equal((await previewBillingBackfillFor(sql, [file("invoices.csv", [INVOICES_HEAD, [WO, SO, "Billed", "INV9003", TODAY, "Open", "10", "10", "", ""]])], "u-owner")).plans[0].jobId, jobId);
  assert.equal((await previewBillingBackfillFor(sql, [otherSo], "u-owner")).plans[0].jobId, live);
  assert.deepEqual((await pg.query("select ns_invoice from ticket_invoices where job_id = $1 order by id", [jobId])).rows.map((r) => r.ns_invoice), ["INV9001"]);
  // An unbilled ticket merged into an install is still skipped.
  const other = await ticket(pg, { call_id: "SC-202610-905", wo: "WO-4810" });
  const otherInstall = await install(pg, { wo: "WO-4810" });
  await mergeShown(sql, other, otherInstall, await preview(sql, other, otherInstall));
  const skipped = (await previewBillingBackfillFor(sql, [file("invoices.csv", [INVOICES_HEAD, ["WO-4810", "SO9100", "Billed", "INV9100", TODAY, "Open", "50", "50", "Yes", ""]])], "u-owner")).plans[0];
  assert.deepEqual([skipped.status, skipped.reason], ["skip", `Merged into install #${otherInstall}. Billing Backfill covers service and TLC tickets.`]);
});

test("Part Usage counts a billed merged ticket's parts once, on the install, over its WO part line", async () => {
  const { pg, sql } = await fresh();
  await pg.query("insert into billing_items (sku, item, kind, rate, cost) values ('TESTGASKET', 'PARTS : TESTGASKET', 'part', 12.5, 5)");
  const uses = async () => (await loadPartUses(sql, {})).map((u) => [u.ticketKey, u.type, u.pieces]).sort();
  // One with no WO part line: its 2 gaskets count on the ticket, then on the install.
  const a = await ticket(pg, { ns_so: SO });
  await charge(pg, a, "PARTS : TESTGASKET", 2, 12.5, "part", 1);
  const ia = await install(pg);
  assert.deepEqual(await uses(), [[`service:${a}`, "service", 2]]);
  await mergeShown(sql, a, ia, await preview(sql, a, ia));
  assert.deepEqual(await uses(), [[`install:${ia}`, "install", 2]]);
  // One whose WO part line (Corrigo says 1) goes to the install with it: its charges (3) are the use there, once.
  const b = await ticket(pg, { call_id: "SC-202610-906", wo: "WO-4820", ns_so: "SO9002" });
  await charge(pg, b, "PARTS : TESTGASKET", 3, 12.5, "part", 1);
  await pg.query("insert into ticket_part_lines (wo, item, sku, qty, used_on, source, job_id) values ('WO-4820', 'PARTS : TESTGASKET', 'TESTGASKET', 1, current_date, 'corrigo', $1)", [b]);
  const ib = await install(pg, { wo: "WO-4820" });
  await mergeShown(sql, b, ib, await preview(sql, b, ib));
  assert.deepEqual(await uses(), [[`install:${ia}`, "install", 2], [`install:${ib}`, "install", 3]]);
  // One with QuickBooks history for the same part: its charges are the one use, before and after.
  const c = await ticket(pg, { call_id: "SC-202610-909", wo: "WO-4840", ns_so: "SO9003" });
  await charge(pg, c, "PARTS : TESTGASKET", 4, 12.5, "part", 1);
  const run = Number((await one(pg, "insert into wo_history_runs (filename) values ('test.xlsx') returning id")).id);
  const h = Number((await one(pg, "insert into wo_history (run_id, history_ref, wo, customer, completed, job_id) values ($1, 'QB-40', 'WO-4840', $2, $3, $4) returning id", [run, CAFE, TODAY, c])).id);
  await pg.query("insert into wo_history_lines (history_id, line_type, kind, item_code, qty) values ($1, 'Item', 'part', 'TESTGASKET', 4)", [h]);
  const ic = await install(pg, { wo: "WO-4840" });
  assert.deepEqual((await uses()).filter((u) => u[0].endsWith(`:${c}`) || u[0] === `install:${ic}`), [[`service:${c}`, "service", 4]]);
  await mergeShown(sql, c, ic, await preview(sql, c, ic));
  assert.deepEqual((await uses()).filter((u) => u[0].endsWith(`:${c}`) || u[0] === `install:${ic}`), [[`install:${ic}`, "install", 4]]);
});

test("the confirm, the merge's toast and the install's Invoice window say it (source)", () => {
  const confirm = readFileSync(new URL("../src/components/desk/ticket-install-merge.tsx", import.meta.url), "utf8");
  assert.ok(confirm.includes("const charges = m.billed\n    ? `${m.chargeLines ? `${count(m.chargeLines, \"line\")}, ${money(m.chargeTotal)}. ` : \"\"}${m.billed.text}`"));
  assert.ok(confirm.includes("toast.success(`Merged into install #${r.installId}${r.billedOn ? ` · its charges stay billed on ${r.billedOn}` : \"\"}`);"));
  const win = readFileSync(new URL("../src/components/desk/invoice-window.tsx", import.meta.url), "utf8");
  assert.ok(win.includes('{v.billedElsewhere.length ? (\n              <section className="rounded-lg border border-dashed border-border p-3" data-testid="invoice-billed">'));
  assert.ok(win.includes("Already billed (not on this invoice)"));
  assert.ok(win.includes("These charges were billed on the Sales Order shown and are not billed again."));
  // The invoice's totals come from its own lines only.
  assert.ok(win.includes("const totals = invoiceTotals(\n    draft.map("));
  // The merged ticket's banner: billed on its SO, or its charges on the install.
  assert.ok(confirm.includes("{job.mergedBilledOn\n          ? `Its charges stay billed on ${job.mergedBilledOn} (the install lists them as billed);"));
  const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  assert.ok(api.includes('mergedBilledOn: r.merged_install_id != null && String(r.ns_so ?? "").trim() ? String(r.ns_so).trim() : null,'));
  // The confirm sends the Sales Order it showed; the sheet shows the billed banner at once.
  assert.ok(confirm.includes('mutationFn: () => mergeTicketIntoInstall({ data: { jobId: job.id, installId: installId!, stamps: p!.stamps, billedSo: p!.moves.billed?.so ?? "" } }),'));
  const sheet = readFileSync(new URL("../src/components/desk/job-sheet.tsx", import.meta.url), "utf8");
  assert.ok(sheet.includes("mergedInstallBy: r.mergedBy, mergedBilledOn: r.billedOn, done: true"));
  // A billed ticket's discount, and one with no charge lines.
  assert.ok(win.includes('{off > 0.004 ? (\n            <li className="flex justify-between gap-3" data-testid="invoice-billed-discount">'));
  assert.ok(win.includes("No charge lines were on the ticket."));
});
