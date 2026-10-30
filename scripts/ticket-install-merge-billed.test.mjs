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
const merge = (sql, jobId, installId, stamps) => M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId, installId, stamps });
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
  assert.equal(p.stamps.so, SO);
  assert.ok(p.note.includes("\nP.O.: PO-T9\n") && p.note.endsWith(`\n${BILLED}`), p.note);

  const r = await merge(sql, jobId, installId, p.stamps);
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
  await merge(sql, jobId, installId, p.stamps);

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
  await assert.rejects(() => merge(sql, jobId, installId, billed.stamps), { message: M.CHANGED_SINCE_OPENED });
  assert.equal(await snapshot(pg), before);
  // Read unbilled, then a Sales Order entered the same way: the confirm said the charges go on the invoice.
  const unbilled = await preview(sql, jobId, installId);
  assert.deepEqual([unbilled.moves.billed, unbilled.stamps.so], [null, ""]);
  await pg.query("update service_jobs set ns_so = $2 where id = $1", [jobId, SO]);
  before = await snapshot(pg);
  await assert.rejects(() => merge(sql, jobId, installId, unbilled.stamps), { message: M.CHANGED_SINCE_OPENED });
  // A window from before this release sends no Sales Order: it merges unbilled tickets only.
  await assert.rejects(() => merge(sql, jobId, installId, { job: billed.stamps.job, install: billed.stamps.install, head: billed.stamps.head }), { message: M.CHANGED_SINCE_OPENED });
  // The statement checks it too, on the locked row.
  const run = (so) => sql.query(M.mergeTicketIntoInstallSql(), [jobId, installId, "boss", billed.stamps.job, billed.stamps.install, billed.stamps.head, "note", 0, null, null, null, so, so ? 500 : null]);
  assert.deepEqual(await run(""), []);
  assert.deepEqual(await run("SO9002"), []);
  assert.equal(await snapshot(pg), before);
  // Read again, billed: it merges.
  assert.equal((await merge(sql, jobId, installId, (await preview(sql, jobId, installId)).stamps)).billedOn, SO);
});

test("a billed merge stays billed: its Sales Order can't be cleared or changed, and Merge installs takes it to the install kept", async () => {
  const { pg, sql } = await fresh();
  const jobId = await billedTicket(pg);
  const installId = await install(pg);
  await merge(sql, jobId, installId, (await preview(sql, jobId, installId)).stamps);
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

  await merge(sql, jobId, installId, (await preview(sql, jobId, installId)).stamps);
  assert.deepEqual(await parts(), partsBefore);
  assert.deepEqual(await page(), [[jobId, SO], [unbilledId, null]]);
  for (const includeBilled of [false, true]) assert.equal((await exportBillingFor(sql, { ...RANGE, includeBilled })).tickets, 0, String(includeBilled));
  // The install's invoice and the account's install row count none of it.
  assert.equal(Number((await one(pg, "select count(*)::int as n from invoices where entity_type = 'install'")).n), 0);
  assert.equal((await listAccountInvoicesFor(sql, CAFE, "u-owner")).filter((x) => x.type === "install").length, 0);
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
  assert.ok(confirm.includes("Its charges stay billed on ${job.mergedBilledOn} (the install lists them as billed)"));
  const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  assert.ok(api.includes('mergedBilledOn: r.merged_install_id != null && String(r.ns_so ?? "").trim() ? String(r.ns_so).trim() : null,'));
});
