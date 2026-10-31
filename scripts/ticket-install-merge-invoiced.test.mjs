// Merge into install for a ticket billed on NetSuite invoices with no Sales Order (Chuy, 10/30: "Those should be carried
// over if it applies to the same work order"). Its charges stay billed on those invoices, the way an SO ticket's stay on
// the SO: never on the install's invoice, listed as billed on the install, never in Export Billing, counted once. The
// Billing Backfill takes only rows on its own invoices. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const M = await import("../src/lib/ops/ticket-install-merge.ts");
const { BILLED_ON_INSTALL, BILLED_ON_INSTALL_SO } = await import("../src/lib/ops/merged-ticket.ts");
const { approveInvoiceFor, getInvoiceFor, listAccountInvoicesFor } = await import("../src/lib/ops/invoice-api.ts");
const { exportBillingFor, invoicedPartLines, recordTicketSalesOrder } = await import("../src/lib/ops/charges-api.ts");
const { loadTicketBillingRows } = await import("../src/lib/ops/billing-report-api.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
const { previewBillingBackfillFor, applyBillingBackfillFor, APPLY_BACKFILL_SQL } = await import("../src/lib/ops/billing-backfill-api.ts");
const { loadPartUses } = await import("../src/lib/ops/part-usage-api.ts");
const { todayChicago, addDays, formatLongDate } = await import("../src/lib/ops/clock.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

const CAFE = "Test Sushi - Bayfront";
const WO = "WO-4792";
const INV = "INV9001";
const ON = `NetSuite invoice ${INV}`;
const BILLED = `Billed on ${ON}: charges carry over as billed, not re-billed.`;
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
const invoice = (pg, jobId, ns, status = "Open", total = 500, date = null) =>
  pg.query("insert into ticket_invoices (job_id, ns_invoice, status, total, invoice_date, source) values ($1, $2, $3, $4, $5, 'standalone')", [jobId, ns, status, total, date]);
const preview = (sql, jobId, installId) => M.previewTicketInstallMergeFor(sql, "u-owner", { jobId, installId });
// billedSo / billedOn: what the confirm showed; left out, as windows from before 10/30 (and 10/30 evening) send them.
const merge = (sql, jobId, installId, stamps, billedSo, billedOn) =>
  M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId, installId, stamps, ...(billedSo === undefined ? {} : { billedSo }), ...(billedOn === undefined ? {} : { billedOn }) });
/** Merge as the confirm `p` showed it, from this release's window. */
const mergeShown = (sql, jobId, installId, p) => merge(sql, jobId, installId, p.stamps, p.moves.billed?.so ?? "", p.moves.billed?.on ?? "");
/** No Sales Order, one $500.00 line, and NetSuite invoice INV9001 (Open). */
async function invoicedTicket(pg, fields = {}) {
  const jobId = await ticket(pg, fields);
  await charge(pg, jobId, LABOR_500.item, 1, 500, "labor", 1);
  await invoice(pg, jobId, INV);
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
const csv = (rows) => rows.map((r) => r.join(",")).join("\n") + "\n";
const file = (name, rows) => ({ name, base64: Buffer.from(csv(rows)).toString("base64") });
const INVOICES_HEAD = ["WO", "SO #", "SO status", "Invoice #", "Invoice date", "Invoice status", "Invoice total", "Amount remaining", "Charges source", "Corrigo net (reference)"];
const invoicesFile = (...rows) => file("invoices.csv", [INVOICES_HEAD, ...rows]);
const invRow = (ns, status = "Open", so = "") => [WO, so, so ? "Billed" : "", ns, TODAY, status, "500", status === "Paid In Full" ? "0" : "500", "", ""];

test("a ticket billed on a NetSuite invoice with no Sales Order merges: its charges stay billed there, never on the install's invoice, and the install lists them as billed", async () => {
  const { pg, sql } = await fresh();
  const jobId = await invoicedTicket(pg, { po: "PO-T9" });
  const installId = await install(pg);
  // Before: invoiced, so Export Billing takes it only when asked for billed tickets too.
  assert.deepEqual([(await exportBillingFor(sql, { ...RANGE })).tickets, (await exportBillingFor(sql, { ...RANGE, includeBilled: true })).tickets], [0, 1]);

  const p = await preview(sql, jobId, installId);
  assert.equal(p.refusal, null);
  assert.deepEqual(p.moves.billed, { so: null, invoices: INV, on: ON, text: BILLED });
  assert.deepEqual([p.moves.chargeLines, p.moves.chargeTotal, p.moves.invoiceTotal, p.moves.invoicePo], [1, 500, 0, null]);
  assert.deepEqual(p.stays, ["Its own record and history", `Its ${ON}`, `Its charge lines, billed on ${ON} (the install lists them as billed)`]);
  assert.ok(p.note.includes("\nP.O.: PO-T9\n") && p.note.endsWith(`\n${BILLED}`), p.note);

  const r = await mergeShown(sql, jobId, installId, p);
  assert.deepEqual([r.chargeLines, r.billedOn], [0, ON]);

  // No invoice was made for the install; the ticket kept its invoice and its charges, and still has no Sales Order.
  assert.equal(Number((await one(pg, "select count(*)::int as n from invoices where entity_type = 'install'")).n), 0);
  const t = await one(pg, "select duplicate_of, merged_install_id, ns_so from service_jobs where id = $1", [jobId]);
  assert.deepEqual([t.duplicate_of, t.merged_install_id, t.ns_so], [jobId, installId, null]);
  assert.equal(Number((await one(pg, "select count(*)::int as n from ticket_charges where job_id = $1", [jobId])).n), 1);
  // The merge log keeps what it was billed on, its invoice and a copy of the lines billed there.
  const log = (await one(pg, "select moved from ticket_install_merges where job_id = $1", [jobId])).moved;
  assert.deepEqual([log.billedOn, log.billedSo, log.billedInvoices, Number(log.billedTotal), log.invoiceId, log.invoiceLines], [ON, null, INV, 500, null, []]);
  assert.deepEqual(log.billedLines.map((l) => ({ ...l, qty: Number(l.qty), rate: Number(l.rate) })), [LABOR_500]);
  assert.deepEqual(await one(pg, `select ${BILLED_ON_INSTALL("j.id")} as on_, ${BILLED_ON_INSTALL_SO("j.id")} as so from service_jobs j where j.id = $1`, [jobId]), { on_: ON, so: null });
  assert.ok((await one(pg, "select notes from installs where id = $1", [installId])).notes.endsWith(`\n${BILLED}`));

  // The install's Invoice window: its own invoice empty, the ticket's charges listed as billed on the invoice.
  const iv = await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner");
  assert.deepEqual([iv.state, iv.lines.length, iv.total], ["none", 0, 0]);
  assert.deepEqual(iv.billedElsewhere, [{ jobId, ticket: `SC-202610-901 (${WO})`, on: ON, so: null, invoices: INV, voided: null, lines: [LABOR_500], total: 500 }]);
  assert.equal(
    (await getInvoiceFor(sql, { type: "service", id: jobId }, "u-owner")).locked,
    `This ticket was merged into install #${installId}. Its charges were billed on ${ON} and stay billed there; the install lists them as billed.`,
  );
  assert.deepEqual(
    (await listAccountInvoicesFor(sql, CAFE, "u-owner")).map((x) => [x.type, x.id, x.total, x.status]),
    [["service", jobId, 500, `Billed on ${ON} · merged into install #${installId}`]],
  );
  for (const includeBilled of [false, true]) assert.equal((await exportBillingFor(sql, { ...RANGE, includeBilled })).tickets, 0, String(includeBilled));
  const acts = (await pg.query("select entity_type, detail from activity where action = 'merged' order by id")).rows;
  assert.deepEqual(acts.map((a) => a.entity_type), ["install", "service"]);
  for (const a of acts) assert.ok(a.detail.includes(` · its charges stay billed on ${ON}, not billed again`), a.detail);
});

test("only the NetSuite invoices that stand are its billing; an approved install invoice, a P.O., a discount or QuickBooks history don't stop it", async () => {
  const { pg, sql } = await fresh();
  // A Voided one and one that stands: billed on the one that stands.
  const a = await ticket(pg, { po: "PO-T1", discount_kind: "percent", discount_value: 10 });
  await charge(pg, a, "PARTS : TESTGASKET", 2, 12.5, "part", 1);
  await invoice(pg, a, "INV-1", "Voided");
  await invoice(pg, a, "INV-2", "Paid In Full", 22.5, addDays(TODAY, -1));
  const qbRun = Number((await one(pg, "insert into wo_history_runs (filename) values ('test.xlsx') returning id")).id);
  await pg.query("insert into wo_history (run_id, history_ref, wo, customer, job_id) values ($1, 'QB-9', $2, $3, $4)", [qbRun, WO, CAFE, a]);
  const ia = await install(pg);
  const own = await approveInvoiceFor(
    sql,
    { type: "install", id: ia, lines: [{ item: "Service : SERVICELABOR", description: "Install labor", qty: 3, rate: 150 }], lineIds: [], discount: { kind: "amount", value: "20" }, seen: null, po: "PO-OWN" },
    "u-owner",
  );
  const p = await preview(sql, a, ia);
  assert.equal(p.refusal, null);
  assert.deepEqual(p.moves.billed, { so: null, invoices: "INV-2", on: "NetSuite invoice INV-2", text: "Billed on NetSuite invoice INV-2: charges carry over as billed, not re-billed." });
  assert.deepEqual([p.moves.chargeTotal, p.moves.invoiceTotal, p.moves.invoicePo, p.warnings], [22.5, 430, null, []]);
  await mergeShown(sql, a, ia, p);
  const after = await getInvoiceFor(sql, { type: "install", id: ia }, "u-owner");
  assert.deepEqual([after.version, after.state, after.total, after.po, after.lines.length], [own.version, "approved", 430, "PO-OWN", 1]);
  assert.deepEqual(after.billedElsewhere.map((b) => [b.on, b.so, b.invoices, b.voided, b.total]), [["NetSuite invoice INV-2", null, "INV-2", null, 22.5]]);
  // The install's invoice saved after the confirm read it: nothing goes on it, so the merge still goes ahead.
  const c = await invoicedTicket(pg, { call_id: "SC-202610-904", wo: "WO-4832" });
  const ic = await install(pg, { wo: "WO-4832" });
  const pc = await preview(sql, c, ic);
  await approveInvoiceFor(sql, { type: "install", id: ic, lines: [{ item: "Service : SERVICELABOR", description: "Install labor", qty: 1, rate: 150 }], lineIds: [], discount: null, seen: null }, "u-owner");
  const ownC = await getInvoiceFor(sql, { type: "install", id: ic }, "u-owner");
  assert.equal((await mergeShown(sql, c, ic, pc)).billedOn, ON);
  assert.deepEqual([(await getInvoiceFor(sql, { type: "install", id: ic }, "u-owner")).version], [ownC.version]);
  // In the statement too: the install invoice's stamp it is given counts only for an unbilled ticket.
  const d = await invoicedTicket(pg, { call_id: "SC-202610-905", wo: "WO-4833" });
  const id = await install(pg, { wo: "WO-4833" });
  const pd = await preview(sql, d, id);
  const ran = await sql.query(M.mergeTicketIntoInstallSql(), [d, id, "boss", pd.stamps.job, pd.stamps.install, "1:stale:stamp", "note", 0, null, null, null, "", 500, ON, INV]);
  assert.equal(ran.length, 1);
  // Two that stand: both named.
  const b = await ticket(pg, { call_id: "SC-202610-902", wo: "WO-4830" });
  await charge(pg, b, LABOR_500.item, 1, 500, "labor", 1);
  await invoice(pg, b, "INV-3", "Open", 300);
  await invoice(pg, b, "INV-4", "Paid In Full", 200);
  const pb = await preview(sql, b, await install(pg, { wo: "WO-4830" }));
  assert.deepEqual([pb.refusal, pb.moves.billed.on, pb.stays[1]], [null, "NetSuite invoices INV-3, INV-4", "Its NetSuite invoices INV-3, INV-4"]);
});

test("an invoice that doesn't fit the ticket isn't taken as its billing: dated far from it, or not its charges' total", async () => {
  const { pg, sql } = await fresh();
  const refusal = async (fields, invoices, charges = [[LABOR_500.item, 1, 500, "labor"]], installFields = {}) => {
    const jobId = await ticket(pg, fields);
    for (const [i, c] of charges.entries()) await charge(pg, jobId, c[0], c[1], c[2], c[3], i + 1);
    for (const inv of invoices) await invoice(pg, jobId, ...inv);
    const p = await preview(sql, jobId, await install(pg, { wo: fields.wo, ...installFields }));
    return p.refusal;
  };
  const done = addDays(TODAY, -2);
  // Another job with this WO number (the numbers started over): an invoice from months before the ticket was done.
  assert.equal(
    await refusal({ call_id: "SC-202610-911", wo: "WO-4911", completed_at: done }, [["INV5000", "Paid In Full", 500, addDays(TODAY, -200)]]),
    `SC-202610-911 (WO-4911)'s NetSuite invoice INV5000 is dated ${formatLongDate(addDays(TODAY, -200))}, too far from the ticket's ${formatLongDate(done)} to be its billing: it may be another job with this WO number. An invoiced ticket stays as it is.`,
  );
  // A week before the ticket was done still fits (the Billing Backfill's window); eight days doesn't.
  assert.equal(await refusal({ call_id: "SC-202610-912", wo: "WO-4912", completed_at: done }, [["INV5001", "Open", 500, addDays(done, -7)]]), null);
  assert.match(await refusal({ call_id: "SC-202610-913", wo: "WO-4913", completed_at: done }, [["INV5002", "Open", 500, addDays(done, -8)]]), /too far from the ticket's/);
  // A year after it still fits; more than that doesn't.
  const old_ = addDays(TODAY, -400);
  const then = { received: old_, completed_at: old_ };
  assert.equal(await refusal({ call_id: "SC-202610-920", wo: "WO-4920", ...then }, [["INV5011", "Open", 500, addDays(old_, 365)]], undefined, then), null);
  assert.match(await refusal({ call_id: "SC-202610-921", wo: "WO-4921", ...then }, [["INV5012", "Open", 500, addDays(old_, 366)]], undefined, then), /too far from the ticket's/);
  // The install's own invoice on the WO, say: its total isn't the ticket's charges.
  assert.equal(
    await refusal({ call_id: "SC-202610-914", wo: "WO-4914" }, [["INV5003", "Open", 18450]]),
    "SC-202610-914 (WO-4914)'s NetSuite invoice INV5003 comes to $18450.00 and its charges to $500.00, so it may not be this ticket's billing. If it is, an Admin can unlock the ticket's Charges and make them match, then merge.",
  );
  assert.equal(
    await refusal({ call_id: "SC-202610-915", wo: "WO-4915" }, [["INV5004", "Open", 300], ["INV5005", "Open", 150]]),
    "SC-202610-915 (WO-4915)'s NetSuite invoices INV5004, INV5005 come to $450.00 and its charges to $500.00, so they may not be this ticket's billing. If they are, an Admin can unlock the ticket's Charges and make them match, then merge.",
  );
  assert.match(await refusal({ call_id: "SC-202610-916", wo: "WO-4916" }, [["INV5006", "Open", 500.01]]), /comes to \$500\.01 and its charges to \$500\.00/);
  assert.match(await refusal({ call_id: "SC-202610-917", wo: "WO-4917" }, [["INV5007", "Open", 500]], []), /comes to \$500\.00 and its charges to \$0\.00/);
  // No total recorded (a blank cell in the Backfill's file): it can't be checked, so it isn't taken as $0.00.
  assert.equal(
    await refusal({ call_id: "SC-202610-922", wo: "WO-4922" }, [["INV5013", "Open", null]]),
    "SC-202610-922 (WO-4922)'s NetSuite invoice INV5013 has no total in KatzDesk, so it can't be checked against the ticket's charges. Run the Billing Backfill with the invoices' totals, then merge.",
  );
  // Its discount counts, and a Voided invoice beside it doesn't, whatever its date.
  assert.equal(
    await refusal({ call_id: "SC-202610-918", wo: "WO-4918", discount_kind: "amount", discount_value: 50 }, [["INV5008", "Voided", 500, addDays(TODAY, -200)], ["INV5009", "Open", 450, done]]),
    null,
  );
  // A ticket billed on a Sales Order isn't held to this: its SO is its billing (PR #104).
  assert.equal(await refusal({ call_id: "SC-202610-919", wo: "WO-4919", ns_so: "SO9001" }, [["INV5010", "Open", 18450, addDays(TODAY, -200)]]), null);
});

test("what the confirm showed is what merges: windows from before, and invoices recorded, voided or an SO entered since", async () => {
  const { pg, sql } = await fresh();
  const jobId = await invoicedTicket(pg);
  const installId = await install(pg);
  const p = await preview(sql, jobId, installId);
  const before = await snapshot(pg);
  // Windows from before this release: 10/30's sends the SO it showed (none) and nothing else; one from before that, nothing.
  await assert.rejects(() => merge(sql, jobId, installId, p.stamps, ""), { message: M.RELOAD_FOR_BILLED(ON) });
  await assert.rejects(() => merge(sql, jobId, installId, p.stamps), { message: M.RELOAD_FOR_BILLED(ON) });
  // One that showed it billed on something else, or not billed.
  await assert.rejects(() => merge(sql, jobId, installId, p.stamps, "", ""), { message: M.CHANGED_SINCE_OPENED });
  await assert.rejects(() => merge(sql, jobId, installId, p.stamps, "", "NetSuite invoice INV9002"), { message: M.CHANGED_SINCE_OPENED });
  // Another invoice recorded since, straight on the table (the ticket's stamp didn't move): the confirm named one.
  await invoice(pg, jobId, "INV9002", "Open", 0);
  await assert.rejects(() => mergeShown(sql, jobId, installId, p), { message: M.CHANGED_SINCE_OPENED });
  await pg.query("delete from ticket_invoices where ns_invoice = 'INV9002'");
  // Its invoice Voided since: not billed now, so refused with the reason.
  await pg.query("update ticket_invoices set status = 'Voided' where job_id = $1", [jobId]);
  await assert.rejects(() => mergeShown(sql, jobId, installId, p), { message: `SC-202610-901 (${WO}) has NetSuite invoices (${INV}), all Voided. An invoiced ticket stays as it is.` });
  await pg.query("update ticket_invoices set status = 'Open' where job_id = $1", [jobId]);
  // A Sales Order entered since: billed on the SO now, which the confirm didn't show.
  await pg.query("update service_jobs set ns_so = 'SO9100' where id = $1", [jobId]);
  await assert.rejects(() => mergeShown(sql, jobId, installId, p), { message: M.CHANGED_SINCE_OPENED });
  await pg.query("update service_jobs set ns_so = null where id = $1", [jobId]);
  assert.equal(await snapshot(pg), before);

  // A confirm read before its invoice was recorded showed the charges going on the install's invoice.
  const j2 = await ticket(pg, { call_id: "SC-202610-903", wo: "WO-4831" });
  await charge(pg, j2, LABOR_500.item, 1, 500, "labor", 1);
  const i2 = await install(pg, { wo: "WO-4831" });
  const unbilled = await preview(sql, j2, i2);
  assert.equal(unbilled.moves.billed, null);
  // Before that, the statement never merges it as billed on invoices it doesn't have.
  const asBilled = (inv) =>
    sql.query(M.mergeTicketIntoInstallSql(), [j2, i2, "boss", unbilled.stamps.job, unbilled.stamps.install, unbilled.stamps.head, "note", 0, null, null, null, "", 500, "NetSuite invoice INV9050", inv]);
  assert.deepEqual(await asBilled(""), []);
  assert.deepEqual(await asBilled("INV9050"), []);
  await invoice(pg, j2, "INV9050");
  await assert.rejects(() => mergeShown(sql, j2, i2, unbilled), { message: M.CHANGED_SINCE_OPENED });

  // The statement checks it on the locked row: the invoices read fresh, and what it is billed on.
  const run = (on, inv, so = "") =>
    sql.query(M.mergeTicketIntoInstallSql(), [jobId, installId, "boss", p.stamps.job, p.stamps.install, p.stamps.head, "note", 0, null, null, null, so, on ? 500 : null, on, inv]);
  const now = await snapshot(pg);
  await invoice(pg, jobId, "INV9002");
  assert.deepEqual(await run(ON, INV), []);
  await pg.query("delete from ticket_invoices where ns_invoice = 'INV9002'");
  assert.deepEqual(await run(ON, ""), []); // billed on nothing: never
  assert.deepEqual(await run("", ""), []); // unbilled: an invoiced ticket never merges that way
  assert.deepEqual(await run("SO9100", INV, "SO9100"), []); // the SO it doesn't have
  await pg.query("insert into repair_quotes (job_id) values ($1)", [jobId]);
  assert.deepEqual(await run(ON, INV), []);
  await pg.query("delete from repair_quotes");
  assert.equal(await snapshot(pg), now);
  // Read again: it merges.
  assert.equal((await mergeShown(sql, jobId, installId, await preview(sql, jobId, installId))).billedOn, ON);
});

test("a ticket billed on a Sales Order still merges from a window of 10/30's release, which sends only the SO", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg, { ns_so: "SO9001" });
  await charge(pg, jobId, LABOR_500.item, 1, 500, "labor", 1);
  const installId = await install(pg);
  const p = await preview(sql, jobId, installId);
  assert.deepEqual([p.moves.billed.so, p.moves.billed.on], ["SO9001", "SO9001"]);
  await assert.rejects(() => merge(sql, jobId, installId, p.stamps, "SO9001", ""), { message: M.CHANGED_SINCE_OPENED });
  // The statement never takes it as billed on anything but its SO.
  const run = (on) => sql.query(M.mergeTicketIntoInstallSql(), [jobId, installId, "boss", p.stamps.job, p.stamps.install, p.stamps.head, "note", 0, null, null, null, "SO9001", 500, on, ""]);
  assert.deepEqual(await run(ON), []);
  await invoice(pg, jobId, "INV-71");
  assert.equal((await merge(sql, jobId, installId, (await preview(sql, jobId, installId)).stamps, "SO9001")).billedOn, "SO9001");
  const log = (await one(pg, "select moved from ticket_install_merges where job_id = $1", [jobId])).moved;
  assert.deepEqual([log.billedOn, log.billedSo, log.billedInvoices], ["SO9001", "SO9001", "INV-71"]);
  // Its NetSuite invoice Voided later: it stays billed on its SO, so the install doesn't warn.
  await pg.query("update ticket_invoices set status = 'Voided' where job_id = $1", [jobId]);
  assert.deepEqual((await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner")).billedElsewhere.map((b) => [b.on, b.invoices, b.voided]), [["SO9001", null, null]]);

  // A merge from 10/30's release logged billedSo alone (WO-0792's, if it merges before this one is out): still billed.
  await pg.query("update ticket_install_merges set moved = moved - 'billedOn' where job_id = $1", [jobId]);
  assert.deepEqual(await one(pg, `select ${BILLED_ON_INSTALL("j.id")} as on_ from service_jobs j where j.id = $1`, [jobId]), { on_: "SO9001" });
  assert.deepEqual((await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner")).billedElsewhere.map((b) => [b.on, b.so, b.total]), [["SO9001", "SO9001", 500]]);
  assert.match((await getInvoiceFor(sql, { type: "service", id: jobId }, "u-owner")).locked, /Its charges were billed on SO9001 and stay billed there/);
  assert.deepEqual((await listAccountInvoicesFor(sql, CAFE, "u-owner")).map((x) => x.status), [`Billed SO9001 · merged into install #${installId}`]);
  const backfill = (await previewBillingBackfillFor(sql, [invoicesFile([WO, "SO9001", "Billed", "INV-72", TODAY, "Open", "500", "500", "", ""])], "u-owner")).plans[0];
  assert.deepEqual([backfill.jobId, backfill.status, backfill.locked], [jobId, "invoices", true]);
});

test("the Billing Backfill records the merged ticket's own invoices only, and the install says when one is Voided since", async () => {
  const { pg, sql } = await fresh();
  const jobId = await invoicedTicket(pg);
  const installId = await install(pg);
  await mergeShown(sql, jobId, installId, await preview(sql, jobId, installId));
  const plan = async (f) => (await previewBillingBackfillFor(sql, [f], "u-owner")).plans[0];
  const apply = async (f) => applyBillingBackfillFor(sql, [f], "u-owner", { hash: (await previewBillingBackfillFor(sql, [f], "u-owner")).hash, skip: [] });
  const before = await one(pg, "select ns_so, discount_kind, (select count(*)::int from ticket_charges c where c.job_id = j.id) as lines from service_jobs j where id = $1", [jobId]);

  // Its own invoice, paid: recorded on it, locked (invoices only).
  const paid = invoicesFile(invRow(INV, "Paid In Full"));
  const pp = await plan(paid);
  assert.deepEqual([pp.jobId, pp.status, pp.locked, pp.charges.next], [jobId, "invoices", true, null]);
  assert.ok(pp.warnings.includes(`Merged into install #${installId} as billed on ${ON}: only its NetSuite invoices are recorded; its charges and Sales Order stay as they are.`), pp.warnings.join(" | "));
  await apply(paid);
  assert.deepEqual((await pg.query("select ns_invoice, status from ticket_invoices where job_id = $1", [jobId])).rows, [{ ns_invoice: INV, status: "Paid In Full" }]);
  assert.deepEqual(await one(pg, "select ns_so, discount_kind, (select count(*)::int from ticket_charges c where c.job_id = j.id) as lines from service_jobs j where id = $1", [jobId]), before);

  // Another invoice (the install's own billing on the WO, say), alone or with its own, never goes on it; nor an SO.
  const skip = async (f) => {
    const x = await plan(f);
    return [x.status, x.jobId, x.reason];
  };
  assert.deepEqual(await skip(invoicesFile(invRow("INV9500"))), ["skip", null, `Ticket #${jobId} was merged into install #${installId} as billed on ${ON}; these rows are on INV9500. Skipped.`]);
  assert.deepEqual(await skip(invoicesFile(invRow(INV), invRow("INV9500"))), [
    "skip",
    null,
    `The rows are on ${INV}, INV9500, and ticket #${jobId} was merged into install #${installId} as billed on ${ON}. Put the rows for ${INV} in a file of their own, then run the Billing Backfill on each.`,
  ]);
  const soOnly = [WO, "SO9500", "Pending Billing", "", "", "", "", "", "", ""];
  assert.deepEqual(await skip(invoicesFile(soOnly)), ["skip", null, `Ticket #${jobId} was merged into install #${installId} as billed on ${ON}; these rows are on SO9500. Skipped.`]);
  assert.equal((await plan(invoicesFile(invRow(INV), soOnly))).status, "skip");
  // Charges from another invoice, or from a Sales Order not invoiced yet, beside its own invoice: skipped too.
  const CHARGES_HEAD = ["WO", "Source invoice #", "Source SO #", "PO", "NetSuite customer", "Location", "Item", "Item type", "Description", "Qty", "Rate", "Amount", "Discount Item", "Discount Amount", "Record total (after discount)"];
  const chargesFrom = (inv, so) => file("charges.csv", [CHARGES_HEAD, [WO, inv, so, "", CAFE, "", "Service : SERVICELABOR", "Service", "Labor", "1", "80", "80", "", "", "80"]]);
  for (const [inv, so] of [["INV9500", ""], ["", "SO9500"]]) {
    const x = (await previewBillingBackfillFor(sql, [chargesFrom(inv, so), invoicesFile(invRow(INV))], "u-owner")).plans[0];
    assert.equal(x.status, "skip", `${inv}${so}`);
  }
  // Its own invoice's charges with it are its own.
  assert.equal((await previewBillingBackfillFor(sql, [chargesFrom(INV, ""), invoicesFile(invRow(INV, "Paid In Full"))], "u-owner")).plans[0].jobId, jobId);
  // A live ticket on the same WO: the other invoice goes to it; its own still go to the merged ticket.
  const live = await ticket(pg, { call_id: "SC-202610-907" });
  assert.equal((await plan(invoicesFile(invRow("INV9500")))).jobId, live);
  assert.equal((await plan(invoicesFile(invRow(INV, "Paid In Full")))).jobId, jobId);
  await pg.query("delete from service_jobs where id = $1", [live]);

  // The write takes invoices only for it: a locked plan goes, one that would write its charges or SO doesn't.
  const seen = (await one(pg, "select updated_at::text as u from service_jobs where id = $1", [jobId])).u;
  const row = (locked) => [{ job_id: jobId, seen, locked, write_charges: !locked, dk: null, dv: null, set_so: !locked, so: locked ? null : "SO9999", billed_on: null, log: "x" }];
  await pg.query("begin");
  assert.equal((await pg.query(APPLY_BACKFILL_SQL, [JSON.stringify(row(false)), "[]", "[]", "boss"])).rows[0].go, false);
  assert.equal((await pg.query(APPLY_BACKFILL_SQL, [JSON.stringify(row(true)), "[]", "[]", "boss"])).rows[0].go, true);
  await pg.query("rollback");

  // Voided in NetSuite since the merge: recorded, and the install's Invoice window says its charges may be billed on nothing.
  await apply(invoicesFile(invRow(INV, "Voided")));
  const iv = await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner");
  assert.deepEqual(iv.billedElsewhere.map((b) => [b.on, b.invoices, b.voided, b.total]), [[ON, null, INV, 500]]);
  // The ticket's window and the account's Invoices tab say so too.
  assert.equal(
    (await getInvoiceFor(sql, { type: "service", id: jobId }, "u-owner")).locked,
    `This ticket was merged into install #${installId}. Its charges were billed on ${ON}, which NetSuite has as Voided now, so they may not be billed anywhere. The install lists them.`,
  );
  assert.deepEqual((await listAccountInvoicesFor(sql, CAFE, "u-owner")).map((x) => x.status), [`Billed on ${ON}, Voided now · merged into install #${installId}`]);
});

test("one of its invoices Voided since the merge, beside one that stands: every place names it", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg);
  await charge(pg, jobId, LABOR_500.item, 1, 500, "labor", 1);
  await invoice(pg, jobId, "INV1", "Open", 300);
  await invoice(pg, jobId, "INV2", "Open", 200);
  const installId = await install(pg);
  await mergeShown(sql, jobId, installId, await preview(sql, jobId, installId));
  const on = "NetSuite invoices INV1, INV2";
  await pg.query("update ticket_invoices set status = 'Voided' where ns_invoice = 'INV1'");
  assert.deepEqual((await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner")).billedElsewhere.map((b) => [b.on, b.invoices, b.voided]), [[on, "INV2", "INV1"]]);
  assert.equal(
    (await getInvoiceFor(sql, { type: "service", id: jobId }, "u-owner")).locked,
    `This ticket was merged into install #${installId}. Its charges were billed on ${on}. NetSuite has INV1 as Voided now, so they may not all be billed. The install lists them.`,
  );
  assert.deepEqual((await listAccountInvoicesFor(sql, CAFE, "u-owner")).map((x) => x.status), [`Billed on ${on} (INV1 Voided now) · merged into install #${installId}`]);
  // Both Voided: billed on nothing that stands.
  await pg.query("update ticket_invoices set status = 'Voided' where ns_invoice = 'INV2'");
  assert.deepEqual((await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner")).billedElsewhere.map((b) => [b.invoices, b.voided]), [[null, "INV1, INV2"]]);
  assert.deepEqual((await listAccountInvoicesFor(sql, CAFE, "u-owner")).map((x) => x.status), [`Billed on ${on}, Voided now · merged into install #${installId}`]);
});

test("billing lists count it once: parts profit and the Invoices page as before, Part Usage on the install, Export Billing never", async () => {
  const { pg, sql } = await fresh();
  await pg.query("insert into billing_items (sku, item, kind, rate, cost) values ('TESTGASKET', 'PARTS : TESTGASKET', 'part', 12.5, 5)");
  const jobId = await ticket(pg);
  await charge(pg, jobId, "PARTS : TESTGASKET", 2, 12.5, "part", 1);
  await invoice(pg, jobId, INV, "Open", 25);
  const installId = await install(pg);
  const parts = async () => (await invoicedPartLines(sql, RANGE)).lines.map((l) => [l.sku, l.qty]);
  const page = async () => (await loadTicketBillingRows(sql, { kind: "service" })).map((r) => r.id);
  const uses = async () => (await loadPartUses(sql, {})).map((u) => [u.ticketKey, u.type, u.pieces]);
  assert.deepEqual([await parts(), await page(), await uses()], [[["TESTGASKET", 2]], [jobId], [[`service:${jobId}`, "service", 2]]]);
  await mergeShown(sql, jobId, installId, await preview(sql, jobId, installId));
  assert.deepEqual([await parts(), await page(), await uses()], [[["TESTGASKET", 2]], [jobId], [[`install:${installId}`, "install", 2]]]);
  for (const includeBilled of [false, true]) assert.equal((await exportBillingFor(sql, { ...RANGE, includeBilled })).tickets, 0, String(includeBilled));
  assert.equal((await listAccountInvoicesFor(sql, CAFE, "u-owner")).filter((x) => x.type === "install").length, 0);
});

test("after the merge: no Sales Order goes on it, and Merge installs takes it to the install kept", async () => {
  const { pg, sql } = await fresh();
  const jobId = await invoicedTicket(pg);
  const installId = await install(pg);
  await mergeShown(sql, jobId, installId, await preview(sql, jobId, installId));
  await assert.rejects(() => recordTicketSalesOrder(sql, jobId, "u-owner", "SO9002"), { message: `This ticket was merged into install #${installId}. Its work is on the install now.` });
  assert.equal((await one(pg, "select ns_so from service_jobs where id = $1", [jobId])).ns_so, null);
  const keep = await install(pg, { wo: "WO-4800" });
  await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: installId });
  assert.deepEqual((await getInvoiceFor(sql, { type: "install", id: keep }, "u-owner")).billedElsewhere.map((b) => [b.jobId, b.on, b.total]), [[jobId, ON, 500]]);
});

test("the confirm and the install's Invoice window say what it was billed on (source)", () => {
  const win = readFileSync(new URL("../src/components/desk/invoice-window.tsx", import.meta.url), "utf8");
  assert.ok(win.includes("{b.ticket} · billed on {b.on}\n        {b.so && b.invoices ? ` (NetSuite ${b.invoices})` : \"\"} · {money(b.total)}"));
  assert.ok(win.includes('NetSuite has {b.voided} as Voided now, so these charges may not {b.invoices ? "all be billed" : "be billed anywhere"}. Check them in NetSuite.'));
  // The ticket's banner and the pairs list say billed charges stay billed.
  const confirm = readFileSync(new URL("../src/components/desk/ticket-install-merge.tsx", import.meta.url), "utf8");
  assert.ok(confirm.includes("part lines and pings go to the install, its charges too unless they&apos;re billed in NetSuite already, and the ticket is hidden."));
  assert.ok(confirm.includes("Its notes, units, part lines and pings move there, its charges too unless they&apos;re billed in\n            NetSuite already, and the ticket is hidden."));
  const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  assert.ok(api.includes("const rows = await sql.query(`select j.*, ${BILLED_ON_INSTALL(\"j.id\")} as merged_billed_on from service_jobs j where j.id = $1`, [data.id]);"));
});
