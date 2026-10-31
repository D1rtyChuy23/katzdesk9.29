// Merge into install (Grok through Chuy, 2026-10-30): an Admin folds a service ticket whose WO is on an install into
// that install, after a confirm that names the install kept and what moves. The ticket's charges go on the install's
// invoice (waiting for approval), its Ping notes, pings, units, part lines and rebuilds go to the install, its text goes
// under the install's notes, and the ticket is hidden, never deleted. A later Corrigo import updates the install.
// All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const M = await import("../src/lib/ops/ticket-install-merge.ts");
const { mergedTicketRefusal } = await import("../src/lib/ops/merged-ticket.ts");
const { applyCorrigoRows, previewCorrigoRecords } = await import("../src/lib/ops/corrigo-import.ts");
const { parseCorrigoMatrix } = await import("../src/lib/ops/corrigo.ts");
const { mergeServiceJobs, reconcileServiceDuplicates, tryMergeServiceDuplicate } = await import("../src/lib/ops/wo-duplicates.ts");
const { approveInvoiceFor, getInvoiceFor, listAccountInvoicesFor } = await import("../src/lib/ops/invoice-api.ts");
const { writeTicketCharges } = await import("../src/lib/ops/charges-api.ts");
const { stackRefusal } = await import("../src/lib/ops/pm-stack.ts");
const { planBackfill } = await import("../src/lib/ops/billing-backfill.ts");
const { loadBackfillContext } = await import("../src/lib/ops/billing-backfill-api.ts");
const { loadWindowRows } = await import("../src/lib/ops/billing-report-api.ts");
const { formatLongDate, todayChicago, addDays } = await import("../src/lib/ops/clock.ts");
const { updateInstallFor, assignAssetToServiceFor, moveBoardBlockFor } = await import("../src/lib/ops/api.ts");
const { saveRepairQuoteFor } = await import("../src/lib/ops/repair-quote-api.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

const CAFE = "Test Sushi - Bayfront";
const OTHER = "Other Test Cafe";
const WO = "WO-4792";
const TODAY = formatLongDate(todayChicago());

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'boss', true, true, 'admin'),
       ('u-role', 'ana', true, false, 'admin'),
       ('u-tech', 'tess', true, false, 'service'),
       ('u-unapproved', 'nora', false, true, 'admin')`,
  );
  await pg.query("insert into directory_customers (name, account_number) values ($1, 'TEST-1'), ($2, 'TEST-2')", [CAFE, OTHER]);
  const query = async (text, params) => (await pg.query(text, params)).rows;
  // The install window's save (api.ts) writes with tagged queries.
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}

const one = async (pg, text, params) => (await pg.query(text, params)).rows[0];

async function ticket(pg, fields = {}) {
  const f = { kind: "service", call_id: "SC-202610-901", customer: CAFE, issue: "1 Test Way", status: "Open", wo: WO, received: addDays(todayChicago(), -18), technician: "Test Tech", ...fields };
  const cols = Object.keys(f);
  const r = await one(pg, `insert into service_jobs (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f));
  return Number(r.id);
}

async function install(pg, fields = {}) {
  const f = { received: addDays(todayChicago(), -21), customer: CAFE, equip_status: "Installed", complete: true, wo: WO, completed_at: addDays(todayChicago(), -3), technician: "Test Tech", ...fields };
  const cols = Object.keys(f);
  const r = await one(pg, `insert into installs (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f));
  return Number(r.id);
}

const charge = (pg, jobId, item, qty, rate, kind, sort) =>
  pg.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, $2, $3, $4, $5, $6, $7)", [jobId, item, `${item} line`, qty, rate, kind, sort]);

const preview = (sql, jobId, installId, userId = "u-owner") => M.previewTicketInstallMergeFor(sql, userId, { jobId, installId });
const merge = (sql, jobId, installId, stamps, userId = "u-owner") => M.mergeTicketIntoInstallFor(sql, userId, { jobId, installId, stamps });
async function mergeNow(sql, jobId, installId, userId = "u-owner") {
  const p = await preview(sql, jobId, installId, userId);
  assert.equal(p.refusal, null, p.refusal ?? "");
  return merge(sql, jobId, installId, p.stamps, userId);
}
const refusalOf = async (sql, jobId, installId) => (await preview(sql, jobId, installId)).refusal;
const tick = () => new Promise((r) => setTimeout(r, 5));

/** Every row a merge could touch, to show a refused merge wrote nothing. */
async function snapshot(pg) {
  const t = async (q) => JSON.stringify((await pg.query(q)).rows);
  return [
    await t("select id, duplicate_of, merged_install_id, done, status, updated_at from service_jobs order by id"),
    await t("select id, notes, updated_at from installs order by id"),
    await t("select * from invoices order by id"),
    await t("select * from invoice_lines order by id"),
    await t("select id, entity_type, entity_id from comments order by id"),
    await t("select id, entity_type, entity_id from desk_notifications order by id"),
    await t("select id, job_id, install_id, purpose, sold_to from assets order by id"),
    await t("select id, job_id, install_id from ticket_part_lines order by id"),
    await t("select count(*) from activity"),
    await t("select count(*) from ticket_install_merges"),
  ].join("\n");
}

test("rules: the same run of WO numbers, the installs a WO is on, the note and the discount", () => {
  assert.ok(M.sameWoRun("2026-10-12", "2026-10-09") && M.sameWoRun(null, "2026-10-09") && M.sameWoRun("2026-10-12", null));
  assert.ok(M.sameWoRun("2026-10-12", "2025-10-13") && !M.sameWoRun("2026-10-12", "2025-10-11"));
  const rows = [
    { id: 7, customer: CAFE, equip_status: "Installed", complete: true, completed_at: "2026-10-27", duplicate_of: null, wo: "WO-4792", came_in: "2026-10-09" },
    { id: 7, customer: CAFE, equip_status: "Installed", complete: true, completed_at: "2026-10-27", duplicate_of: null, wo: "4792", came_in: "2026-10-09" },
    { id: 8, customer: CAFE, equip_status: "Ready", complete: false, completed_at: null, duplicate_of: 7, wo: "WO-47920", came_in: "2026-10-09" },
    { id: 9, customer: OTHER, equip_status: null, complete: false, completed_at: null, duplicate_of: null, wo: "WO-04792", came_in: "2024-01-02" },
    { id: 10, customer: OTHER, equip_status: "Ready", complete: false, completed_at: null, duplicate_of: 3, wo: "ST# 4792", came_in: null },
  ];
  // Exact number (any spelling), this run only, one entry per install; a flagged install is still listed.
  assert.deepEqual(
    M.matchInstalls({ wo: "wo 4792", came_in: "2026-10-12" }, rows).map((m) => [m.installId, m.status, m.possibleDuplicateOf]),
    [
      [7, "Installed", null],
      [10, "Ready", 3],
    ],
  );
  assert.deepEqual(M.matchInstalls({ wo: "", came_in: null }, rows), []);
  assert.equal(M.installStatusLabel({ complete: false, equip_status: null }), "Not Ready");

  const t = { id: 3, call_id: "SC-1", wo: "WO-4792", issue: " 1 Test Way ", equipment: "Test Brewer\nTest Grinder", work_done: "Swapped the valve", notes: "Line one\nLine two", po: "PO-9", contact: "Ana", phone: "555-0100", technician: "Test Tech", technician2: "Second Tech" };
  assert.equal(
    M.installMergeNote(t, "boss", "2026-10-30"),
    "From ticket SC-1 (WO-4792), merged Oct 30, 2026 by boss:\nIssue: 1 Test Way\nEquipment: Test Brewer, Test Grinder\nWork done: Swapped the valve\nNotes: Line one\nLine two\nP.O.: PO-9\nContact: Ana · 555-0100\nTech: Test Tech + Second Tech",
  );
  assert.equal(
    M.installMergeNote({ id: 3, call_id: "SC-1", wo: null }, "boss", "2026-10-30"),
    "From ticket SC-1, merged Oct 30, 2026 by boss. The ticket had nothing written on it.",
  );

  const names = { ticket: "SC-1 (WO-4792)", install: "Install #7" };
  const pct = (v) => ({ kind: "percent", value: v });
  assert.deepEqual(M.invoiceDiscountAfter(null, null, 3, names), { discount: null });
  assert.deepEqual(M.invoiceDiscountAfter(pct(10), null, 0, names), { discount: pct(10) });
  assert.deepEqual(M.invoiceDiscountAfter(pct(10), pct(10), 2, names), { discount: pct(10) });
  assert.match(M.invoiceDiscountAfter(pct(10), pct(5), 2, names).refusal, /^SC-1 \(WO-4792\) has a 10% discount and Install #7's invoice has 5%; merged, only one would apply/);
  assert.match(M.invoiceDiscountAfter({ kind: "amount", value: 20 }, null, 2, names).refusal, /^SC-1 \(WO-4792\) has a \$20\.00 discount that Install #7's invoice doesn't/);
  assert.match(M.invoiceDiscountAfter(null, pct(5), 2, names).refusal, /^Install #7's invoice has a 5% discount that SC-1 \(WO-4792\) doesn't/);
  assert.match(M.invoiceDiscountAfter({ kind: "amount", value: 20 }, { kind: "amount", value: 20 }, 2, names).refusal, /only one would apply/);

  assert.equal(mergedTicketRefusal({ duplicate_of: 5, merged_install_id: 9 }, "Add charges there."), "This ticket was merged into install #9. Its work is on the install now.");
  assert.equal(mergedTicketRefusal({ duplicate_of: 5, merged_install_id: null }, "Add charges there."), "This ticket was merged into #5. Add charges there.");
  assert.equal(mergedTicketRefusal({ duplicate_of: 5 }), "This ticket was merged into #5.");
  assert.equal(mergedTicketRefusal({ duplicate_of: null }), null);
  assert.equal(mergedTicketRefusal(undefined), null);

  const stackTicket = { id: 3, customer: CAFE, status: "Open", nsSo: null, duplicateOf: 3, mergedInstallId: 7, phoneResolved: false, wo: WO, callId: "SC-1" };
  assert.equal(stackRefusal({ id: 2, customer: CAFE, status: "Open", stackedJobId: null }, stackTicket, 0, false), "Ticket #3 was merged into install #7. A PM stacks on a ticket, not an install.");
});

test("a ticket and an install with one WO: the confirm names the install kept and what moves; the merge moves it, adds the note and hides the ticket", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg);
  const installId = await install(pg);
  // A ticket merged into this one earlier, with its own Corrigo id.
  const kid = await ticket(pg, { call_id: "SC-202610-900", duplicate_of: jobId, corrigo_id: "CG-77", status: "Open" });
  await charge(pg, jobId, "Service : SERVICELABOR", 2, 150, "labor", 1);
  await charge(pg, jobId, "PARTS : TESTGASKET", 1, 12.5, "part", 2);
  await pg.query("insert into comments (entity_type, entity_id, author_name, body) values ('service', $1, 'tess', 'Called ahead'), ('service', $1, 'ana', 'Gate code 1234')", [jobId]);
  await pg.query("insert into desk_notifications (user_id, from_name, body, entity_type, entity_id, customer) values ('u-owner', 'tess', 'Note on the ticket', 'service', $1, $2)", [jobId, CAFE]);
  const unit = Number((await one(pg, "insert into assets (kind, model, serial, site, status, purpose, sold_to, job_id) values ('equip', 'Test Brewer', 'TB-1', 'field', 'assigned', 'Service', $1, $2) returning id", [CAFE, jobId])).id);
  const loaner = Number((await one(pg, "insert into assets (kind, model, serial, site, status, purpose, sold_to, job_id, customer_owned) values ('equip', 'Test Grinder', null, 'field', 'assigned', 'Customer-owned / service loaner', $1, $2, 'yes') returning id", [CAFE, jobId])).id);
  await pg.query("insert into ticket_part_lines (job_id, wo, item, sku, qty, used_on, source) values ($1, $2, 'PARTS : TESTGASKET', 'TESTGASKET', 1, '2026-10-20', 'corrigo')", [jobId, WO]);
  // A part line still on the ticket merged into this one (a ticket merge leaves part lines where they are).
  await pg.query("insert into ticket_part_lines (job_id, wo, item, sku, qty, used_on, source) values ($1, 'WO-4791', 'PARTS : TESTVALVE', 'TESTVALVE', 1, '2026-10-19', 'netsuite')", [kid]);
  const reb = Number((await one(pg, "insert into rebuilds (title, account, job_id) values ('Test brewer rebuild', $1, $2) returning id", [CAFE, jobId])).id);

  // The ticket's panel offers the merge to an Admin only.
  const matches = await M.ticketInstallMatchesFor(sql, "u-owner", jobId);
  assert.deepEqual(matches.map((m) => [m.installId, m.customer, m.status, m.wo]), [[installId, CAFE, "Installed", WO]]);
  assert.deepEqual(await M.ticketInstallMatchesFor(sql, "u-role", jobId).then((m) => m.length), 1);
  assert.deepEqual(await M.ticketInstallMatchesFor(sql, "u-tech", jobId), []);
  assert.deepEqual(await M.ticketInstallMatchesFor(sql, "u-unapproved", jobId), []);
  const pairs = await M.listTicketInstallPairsFor(sql, "u-owner", "service");
  assert.deepEqual(pairs.pairs.map((p) => [p.jobId, p.callId, p.install.installId]), [[jobId, "SC-202610-901", installId]]);
  assert.deepEqual(await M.listTicketInstallPairsFor(sql, "u-tech", "service"), { admin: false, pairs: [], merged: [] });
  assert.deepEqual((await M.listTicketInstallPairsFor(sql, "u-owner", "tlc")).pairs, []);

  const p = await preview(sql, jobId, installId);
  assert.equal(p.refusal, null);
  assert.deepEqual(p.install, { id: installId, customer: CAFE, status: "Installed", completedAt: addDays(todayChicago(), -3), invoice: "none" });
  assert.deepEqual(p.ticket, { id: jobId, kind: "service", callId: "SC-202610-901", wo: WO, customer: CAFE, status: "Open", received: addDays(todayChicago(), -18) });
  assert.deepEqual(p.moves, {
    chargeLines: 2,
    chargeTotal: 312.5,
    invoiceTotal: 312.5,
    notes: 2,
    pings: 1,
    units: ["Test Brewer SN TB-1", "Test Grinder"],
    partLines: 2,
    rebuilds: [`Test brewer rebuild (#${reb})`],
    mergedTickets: 1,
    invoicePo: null,
    billed: null,
  });
  assert.deepEqual(p.stays, [
    "Its own record and history",
    "A copy of its charge lines (only the install's invoice is billed)",
  ]);
  assert.equal(p.note, `From ticket SC-202610-901 (${WO}), merged ${TODAY} by boss:\nIssue: 1 Test Way\nTech: Test Tech`);
  assert.deepEqual(p.warnings, []);
  // Anyone but an Admin is refused before anything is read.
  for (const u of ["u-tech", "u-unapproved"]) {
    await assert.rejects(() => preview(sql, jobId, installId, u), { message: M.ADMIN_ONLY });
    await assert.rejects(() => merge(sql, jobId, installId, p.stamps, u), { message: M.ADMIN_ONLY });
  }

  const r = await merge(sql, jobId, installId, p.stamps);
  assert.deepEqual(r, { jobId, installId, chargeLines: 2, notes: 2, pings: 1, units: 2, partLines: 2, rebuilds: 1, mergedTickets: 1, mergedBy: "boss", billedOn: null });

  // The ticket: hidden (its own duplicate), marked merged and done, its record kept as it was.
  const t = await one(pg, "select duplicate_of, merged_install_id, merged_install_by, merged_install_at, done, status, issue, wo, customer from service_jobs where id = $1", [jobId]);
  assert.deepEqual([t.duplicate_of, t.merged_install_id, t.merged_install_by, !!t.merged_install_at, t.done, t.status, t.issue, t.wo, t.customer], [jobId, installId, "boss", true, true, "Open", "1 Test Way", WO, CAFE]);
  const k = await one(pg, "select duplicate_of, merged_install_id from service_jobs where id = $1", [kid]);
  assert.deepEqual([k.duplicate_of, k.merged_install_id], [jobId, installId]);
  // The install: the note, its own fields unchanged.
  const i = await one(pg, "select notes, equip_status, complete, customer, wo from installs where id = $1", [installId]);
  assert.deepEqual([i.notes, i.equip_status, i.complete, i.customer, i.wo], [p.note, "Installed", true, CAFE, WO]);
  // The charges: on the install's invoice, waiting for an Admin; the ticket keeps its copy.
  const h = await one(pg, "select id, customer, total, approved_at, submitted_by, submitted_at, discount_kind from invoices where entity_type = 'install' and entity_id = $1", [installId]);
  assert.deepEqual([h.customer, h.total, h.approved_at, h.submitted_by, !!h.submitted_at, h.discount_kind], [CAFE, "312.50", null, "boss", true, null]);
  assert.deepEqual(
    (await pg.query("select item, qty::text as qty, rate::text as rate, kind, sort from invoice_lines where invoice_id = $1 order by sort", [h.id])).rows,
    [
      { item: "Service : SERVICELABOR", qty: "2.00", rate: "150.00", kind: "labor", sort: 1 },
      { item: "PARTS : TESTGASKET", qty: "1.00", rate: "12.50", kind: "part", sort: 2 },
    ],
  );
  assert.equal(Number((await one(pg, "select count(*) from ticket_charges where job_id = $1", [jobId])).count), 2);
  // Notes and pings open the install now.
  assert.deepEqual((await pg.query("select entity_type, entity_id from comments order by id")).rows, [
    { entity_type: "install", entity_id: installId },
    { entity_type: "install", entity_id: installId },
  ]);
  assert.deepEqual((await pg.query("select entity_type, entity_id, customer from desk_notifications")).rows, [{ entity_type: "install", entity_id: installId, customer: CAFE }]);
  // Units, part lines and the rebuild are the install's.
  assert.deepEqual((await pg.query("select id, job_id, install_id, purpose, sold_to, status from assets order by id")).rows, [
    { id: unit, job_id: null, install_id: installId, purpose: "Install", sold_to: CAFE, status: "assigned" },
    { id: loaner, job_id: null, install_id: installId, purpose: "Customer-owned / loaner", sold_to: CAFE, status: "assigned" },
  ]);
  assert.deepEqual((await pg.query("select job_id, install_id from ticket_part_lines order by id")).rows, [
    { job_id: null, install_id: installId },
    { job_id: null, install_id: installId },
  ]);
  assert.deepEqual((await pg.query("select job_id, install_id from rebuilds")).rows, [{ job_id: null, install_id: installId }]);
  // Logged on both records, each unit, and in the merge log.
  const moved = " · moved 2 charge lines (waiting for approval), 2 Ping notes, 1 ping, 2 units, 2 part lines, 1 rebuild, 1 ticket merged into it";
  assert.deepEqual((await pg.query("select entity_type, entity_id, actor_name, action, detail from activity where action = 'merged' order by id")).rows, [
    { entity_type: "install", entity_id: installId, actor_name: "boss", action: "merged", detail: `Merged ticket SC-202610-901 (${WO}) into this install${moved}` },
    { entity_type: "service", entity_id: jobId, actor_name: "boss", action: "merged", detail: `Merged into install #${installId} (${CAFE})${moved}` },
    { entity_type: "asset", entity_id: unit, actor_name: "boss", action: "merged", detail: `Moved from ticket SC-202610-901 to install #${installId} (the ticket was merged into it)` },
    { entity_type: "asset", entity_id: loaner, actor_name: "boss", action: "merged", detail: `Moved from ticket SC-202610-901 to install #${installId} (the ticket was merged into it)` },
  ]);
  const log = await one(pg, "select job_id, install_id, merged_by, note, moved from ticket_install_merges");
  assert.deepEqual([log.job_id, log.install_id, log.merged_by, log.note], [jobId, installId, "boss", p.note]);
  assert.deepEqual(Object.keys(log.moved).sort(), ["billedInvoices", "billedLines", "billedOn", "billedSo", "billedTotal", "charges", "invoiceId", "invoiceLines", "notes", "partLines", "pings", "rebuilds", "ticketPo", "tickets", "units"]);
  // Not billed on a Sales Order: nothing billed is kept for the install to list.
  assert.deepEqual([log.moved.billedOn, log.moved.billedSo, log.moved.billedInvoices, log.moved.billedLines, log.moved.billedTotal], [null, null, null, null, null]);
  assert.deepEqual([log.moved.charges.length, log.moved.invoiceId, log.moved.invoiceLines.length, log.moved.units, log.moved.tickets], [2, h.id, 2, [unit, loaner], [kid]]);

  // Hidden: not a pair any more, listed as merged; not offered again; a second merge is refused.
  const after = await M.listTicketInstallPairsFor(sql, "u-owner", "service");
  assert.deepEqual(after.pairs, []);
  assert.deepEqual(after.merged.map((m) => [m.jobId, m.callId, m.installId, m.installCustomer, m.mergedBy]), [[jobId, "SC-202610-901", installId, CAFE, "boss"]]);
  assert.deepEqual(await M.ticketInstallMatchesFor(sql, "u-owner", jobId), []);
  assert.equal(await refusalOf(sql, jobId, installId), `SC-202610-901 (${WO}) was already merged into install #${installId}.`);
  assert.equal(await refusalOf(sql, kid, installId), `SC-202610-900 (${WO}) was already merged into install #${installId}.`);
});

test("the note goes under the install's own notes; nothing linked moves nothing; no charges leave the invoice alone", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg, { issue: null, technician: null, notes: "Customer asked for a call first." });
  const installId = await install(pg, { notes: "Install by 3rd party.\n" });
  const r = await mergeNow(sql, jobId, installId);
  assert.deepEqual([r.chargeLines, r.notes, r.pings, r.units, r.partLines, r.rebuilds, r.mergedTickets], [0, 0, 0, 0, 0, 0, 0]);
  const notes = (await one(pg, "select notes from installs where id = $1", [installId])).notes;
  assert.equal(notes, `Install by 3rd party.\n\nFrom ticket SC-202610-901 (${WO}), merged ${TODAY} by boss:\nNotes: Customer asked for a call first.`);
  assert.equal(Number((await one(pg, "select count(*) from invoices")).count), 0);
  const detail = (await one(pg, "select detail from activity where entity_type = 'install' and action = 'merged'")).detail;
  assert.equal(detail, `Merged ticket SC-202610-901 (${WO}) into this install · nothing else was on the ticket`);
  // Notes that are only blank lines count as none.
  const other = await install(pg, { wo: "WO-4800", notes: " \n\n " });
  const second = await ticket(pg, { call_id: "SC-202610-902", wo: "WO-4800" });
  await mergeNow(sql, second, other);
  assert.equal((await one(pg, "select notes from installs where id = $1", [other])).notes, `From ticket SC-202610-902 (WO-4800), merged ${TODAY} by boss:\nIssue: 1 Test Way\nTech: Test Tech`);
});

test("an install window opened before the merge keeps the merged ticket's note when it saves", async () => {
  const { pg, sql } = await fresh();
  // The rule on its own, for an install two tickets were merged into.
  const ruled = await install(pg, { wo: "WO-4890" });
  const other = await install(pg, { wo: "WO-4891" });
  const from = await ticket(pg, { call_id: "SC-202610-990", wo: "WO-4890" });
  for (const note of ["NOTE one\nIssue: x", "NOTE two"]) {
    await pg.query("insert into ticket_install_merges (job_id, install_id, merged_by, note) values ($1, $2, 'boss', $3)", [from, ruled, note]);
  }
  const after = async (stored, base, sent, id = ruled) => (await one(pg, "select notes_after_window_save($1, $2, $3, $4) as v", [id, stored, base, sent])).v;
  const ONE = "NOTE one\nIssue: x";
  // The window didn't change the notes: they stay as stored, whatever the server has.
  assert.equal(await after(`A\n\n${ONE}`, "A", "A"), `A\n\n${ONE}`);
  assert.equal(await after("Rewritten elsewhere", "A", "A  \r\n"), "Rewritten elsewhere");
  assert.equal(await after("A", "", null), "A");
  assert.equal(await after("A", null, ""), "A");
  // It did: its text, then each merged text it never had, in the order merged.
  assert.equal(await after(`A\n\n${ONE}`, "A", "A edited"), `A edited\n\n${ONE}`);
  assert.equal(await after("A\r\n\r\nNOTE one\r\nIssue: x\r\n\r\nNOTE two", "A", "A edited  "), `A edited\n\n${ONE}\n\nNOTE two`);
  assert.equal(await after(ONE, null, "Typed"), `Typed\n\n${ONE}`);
  // ... one it has already (opened after that merge) isn't added twice; one it took out on purpose stays out.
  assert.equal(await after(`A\n\n${ONE}\n\nNOTE two`, `A\n\n${ONE}`, `A edited\n\n${ONE}`), `A edited\n\n${ONE}\n\nNOTE two`);
  assert.equal(await after(`A\n\n${ONE}`, `A\n\n${ONE}`, "A"), "A");
  assert.equal(await after(`A\n\n${ONE}`, "A", `A\n\n${ONE}\nmore`), `A\n\n${ONE}\nmore`);
  // ... it cleared its notes: what it never had stays.
  assert.equal(await after(`A\n\n${ONE}`, "A", ""), ONE);
  assert.equal(await after(`A\n\n${ONE}`, "A", null), ONE);
  // Nothing merged since, or a merged text taken out of the notes since: the window's, as before (the last save wins).
  assert.equal(await after("Rewritten elsewhere", "A", "A edited"), "A edited");
  assert.equal(await after("A", "A", null), null);
  assert.equal(await after("A, the note fixed", "A", "A edited"), "A edited");
  // Another install's merges don't count.
  assert.equal(await after(`A\n\n${ONE}`, "A", "A edited", other), "A edited");
  // Read fresh: a save (or a merge) that waited for a lock sees what committed meanwhile. PGlite has one connection, so
  // that was checked on a real Postgres; here the functions must stay volatile.
  const kinds = await pg.query("select proname, provolatile from pg_proc where proname in ('notes_after_window_save', 'ticket_keeps_its_billing', 'ticket_has_quickbooks_history', 'notes_plain') order by proname");
  assert.deepEqual(kinds.rows.map((r) => [r.proname, r.provolatile]), [
    ["notes_after_window_save", "v"],
    ["notes_plain", "i"],
    ["ticket_has_quickbooks_history", "v"],
    ["ticket_keeps_its_billing", "v"],
  ]);

  const jobId = await ticket(pg);
  const installId = await install(pg, { notes: "Install by 3rd party." });
  await mergeNow(sql, jobId, installId);
  const merged = (await one(pg, "select notes from installs where id = $1", [installId])).notes;
  assert.match(merged, /^Install by 3rd party\.\n\nFrom ticket SC-202610-901/);
  const ctx = { userId: "u-owner" };
  // The window didn't touch the notes: the merged note stays.
  await updateInstallFor(sql, { id: installId, notes: "Install by 3rd party.", notesBase: "Install by 3rd party." }, ctx);
  assert.equal((await one(pg, "select notes from installs where id = $1", [installId])).notes, merged);
  // It did: its text, then the merged note.
  await updateInstallFor(sql, { id: installId, notes: "Install by 3rd party. Badge at the desk.", notesBase: "Install by 3rd party." }, ctx);
  const kept = (await one(pg, "select notes from installs where id = $1", [installId])).notes;
  assert.equal(kept, `Install by 3rd party. Badge at the desk.\n\n${merged.slice("Install by 3rd party.\n\n".length)}`);
  // The same window saves again (its base is what it last sent): the note isn't added twice, and its own text can go back.
  const note = merged.slice("Install by 3rd party.\n\n".length);
  await updateInstallFor(sql, { id: installId, notes: "Install by 3rd party. Badge at the desk.\nCall first.", notesBase: "Install by 3rd party. Badge at the desk." }, ctx);
  assert.equal((await one(pg, "select notes from installs where id = $1", [installId])).notes, `Install by 3rd party. Badge at the desk.\nCall first.\n\n${note}`);
  await updateInstallFor(sql, { id: installId, notes: "Install by 3rd party. Badge at the desk.", notesBase: "Install by 3rd party. Badge at the desk.\nCall first." }, ctx);
  assert.equal((await one(pg, "select notes from installs where id = $1", [installId])).notes, kept);
  // A ticket merged into an install that was then merged into this one: a window on this one opened before keeps the
  // ticket's text. (The install merge's own "From install #…" line is the window's to keep: it now reads the board first.)
  const keepK = await install(pg, { wo: "WO-4892", notes: "K old" });
  const dropB = await install(pg, { wo: "WO-4893", notes: "B notes" });
  const intoB = await ticket(pg, { call_id: "SC-202610-993", wo: "WO-4893" });
  await mergeNow(sql, intoB, dropB);
  const block = (await one(pg, "select note from ticket_install_merges where job_id = $1", [intoB])).note;
  await mergeInstallsFor(sql, "u-owner", { keepId: keepK, dropId: dropB });
  assert.ok((await one(pg, "select notes from installs where id = $1", [keepK])).notes.includes(block));
  await updateInstallFor(sql, { id: keepK, notes: "K old\nGate code 9", notesBase: "K old" }, ctx);
  assert.equal((await one(pg, "select notes from installs where id = $1", [keepK])).notes, `K old\nGate code 9\n\n${block}`);
  // A save that sends no notes leaves them; one that sends no base is stored as sent, as before.
  await updateInstallFor(sql, { id: installId, technician: "Other Tech" }, ctx);
  assert.equal((await one(pg, "select notes from installs where id = $1", [installId])).notes, kept);
  await updateInstallFor(sql, { id: installId, notes: "Only this." }, ctx);
  assert.equal((await one(pg, "select notes from installs where id = $1", [installId])).notes, "Only this.");
});

test("a save that read the install before a merge committed still keeps the merged note: the notes are worked out on the row it writes", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg);
  const installId = await install(pg, { notes: "Install by 3rd party." });
  const p = await preview(sql, jobId, installId);
  // The window's save reads the install, then the merge commits, then the save writes.
  let raced = false;
  const racing = Object.assign(
    async (strings, ...values) => {
      const text = strings.reduce((a, s, i) => `${a}$${i}${s}`);
      if (!raced && /^\s*update installs set/.test(text)) {
        raced = true;
        await merge(sql, jobId, installId, p.stamps);
      }
      return sql.query(text, values);
    },
    { query: sql.query },
  );
  await updateInstallFor(racing, { id: installId, notes: "Install by 3rd party. Badge at the desk.", notesBase: "Install by 3rd party." }, { userId: "u-owner" });
  assert.ok(raced);
  assert.equal(
    (await one(pg, "select notes from installs where id = $1", [installId])).notes,
    `Install by 3rd party. Badge at the desk.\n\n${p.note}`,
  );
});

test("refused, with the reason, and nothing written: the ticket's billing, the install, the WO, the account", async () => {
  const cases = [
    ["merged into another ticket", async (pg) => ({ jobId: await ticket(pg, { duplicate_of: await ticket(pg, { call_id: "SC-K" }) }) }), (c) => `SC-202610-901 (${WO}) was merged into ticket #${c.jobId - 1}. Merge that ticket into the install instead.`],
    ["no WO", async (pg) => ({ jobId: await ticket(pg, { wo: null }) }), () => "SC-202610-901 has no WO number."],
    ["archived install", async (pg) => ({ installId: await install(pg, { archived: true }) }), (c) => `Install #${c.installId} was archived.`],
    ["install merged into another", async (pg) => { const keep = await install(pg, { wo: "WO-1" }); return { keep, installId: await install(pg, { archived: true, duplicate_of: keep }) }; }, (c) => `Install #${c.installId} was merged into install #${c.keep}. Merge into that one.`],
    ["install flagged as a possible duplicate", async (pg) => { const other = await install(pg, { wo: "WO-1" }); return { other, installId: await install(pg, { duplicate_of: other }) }; }, (c) => `Install #${c.installId} is flagged as a possible duplicate of install #${c.other}. Merge those installs or clear the flag first.`],
    ["install without the WO", async (pg) => ({ installId: await install(pg, { wo: "WO-4793" }) }), (c) => `Install #${c.installId} doesn't carry ${WO} (this run of WO numbers).`],
    ["the WO from another run of numbers", async (pg) => ({ installId: await install(pg, { received: "2024-01-05", completed_at: "2024-02-01" }) }), (c) => `Install #${c.installId} doesn't carry ${WO} (this run of WO numbers).`],
    ["another account", async (pg) => ({ installId: await install(pg, { customer: OTHER }) }), (c) => `SC-202610-901 (${WO}) is for ${CAFE} and Install #${c.installId} is for ${OTHER}. If they're the same place, fix the ticket's customer first.`],
    ["billed on a Sales Order, with a repair quote", async (pg) => { const jobId = await ticket(pg, { ns_so: "SO-1001" }); await pg.query("insert into repair_quotes (job_id) values ($1)", [jobId]); return { jobId }; }, () => `SC-202610-901 (${WO}) has a repair quote, and installs don't keep repair quotes. Finish or take off the quote first.`],
    ["billed on a Sales Order, with a stacked PM", async (pg) => { const jobId = await ticket(pg, { ns_so: "SO-1001" }); const pm = Number((await one(pg, "insert into pm_jobs (customer, status, stacked_job_id) values ($1, 'Open', $2) returning id", [CAFE, jobId])).id); return { jobId, pm }; }, (c) => `PM #${c.pm} is billed on SC-202610-901 (${WO}). Unstack it first: installs don't carry PMs.`],
    // NetSuite invoices that stand carry over as billed (10/30, ticket-install-merge-invoiced.test.mjs); all Voided, no.
    ["NetSuite invoices, all Voided", async (pg) => { const jobId = await ticket(pg); await pg.query("insert into ticket_invoices (job_id, ns_invoice, status) values ($1, 'INV-1', 'Voided'), ($1, 'INV-2', 'VOID')", [jobId]); return { jobId }; }, () => `SC-202610-901 (${WO}) has NetSuite invoices (INV-1, INV-2), all Voided. An invoiced ticket stays as it is.`],
    ["a repair quote", async (pg) => { const jobId = await ticket(pg); await pg.query("insert into repair_quotes (job_id) values ($1)", [jobId]); return { jobId }; }, () => `SC-202610-901 (${WO}) has a repair quote, and installs don't keep repair quotes. Finish or take off the quote first.`],
    ["a stacked PM", async (pg) => { const jobId = await ticket(pg); const pm = Number((await one(pg, "insert into pm_jobs (customer, status, stacked_job_id) values ($1, 'Open', $2) returning id", [CAFE, jobId])).id); return { jobId, pm }; }, (c) => `PM #${c.pm} is billed on SC-202610-901 (${WO}). Unstack it first: installs don't carry PMs.`],
  ];
  for (const [name, setup, reason] of cases) {
    const { pg, sql } = await fresh();
    const c = await setup(pg);
    const jobId = c.jobId ?? (await ticket(pg));
    const installId = c.installId ?? (await install(pg));
    const want = reason({ ...c, jobId, installId });
    const p = await preview(sql, jobId, installId);
    assert.equal(p.refusal, want, name);
    const before = await snapshot(pg);
    await assert.rejects(() => merge(sql, jobId, installId, p.stamps), { message: want }, name);
    assert.equal(await snapshot(pg), before, name);
  }
});

test("another account's name for the same place: a Walk-In ticket merges, with a warning that the install keeps its account", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg, { customer: "Walk-In" });
  const installId = await install(pg);
  await pg.query("insert into assets (kind, model, serial, site, status, purpose, sold_to, job_id) values ('equip', 'Test Brewer', 'TB-2', 'field', 'assigned', 'Service', 'Walk-In', $1)", [jobId]);
  const p = await preview(sql, jobId, installId);
  assert.equal(p.refusal, null);
  assert.deepEqual(p.warnings, [`The ticket is on Walk-In; the install keeps ${CAFE}.`]);
  await merge(sql, jobId, installId, p.stamps);
  // The unit is at the install's account now.
  assert.deepEqual(await one(pg, "select install_id, job_id, sold_to, purpose from assets"), { install_id: installId, job_id: null, sold_to: CAFE, purpose: "Install" });
});

test("the install's invoice: an approved one takes no charges, a waiting one takes more with a matching discount, 200 lines at most", async () => {
  {
    const { pg, sql } = await fresh();
    const jobId = await ticket(pg);
    const installId = await install(pg);
    await charge(pg, jobId, "PARTS : TESTGASKET", 1, 12.5, "part", 1);
    await pg.query("insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('install', $1, $2, 900, 'ana', now())", [installId, CAFE]);
    const p = await preview(sql, jobId, installId);
    assert.equal(p.install.invoice, "approved");
    assert.equal(
      p.refusal,
      `Install #${installId}'s invoice is already approved, so SC-202610-901 (${WO})'s 1 charge line can't go on it. Add them to the install's invoice by hand and take them off the ticket, then merge.`,
    );
    // With the charges taken off the ticket, it merges and the approved invoice is left as it was.
    await pg.query("delete from ticket_charges where job_id = $1", [jobId]);
    await mergeNow(sql, jobId, installId);
    const h = await one(pg, "select total, approved_by, submitted_at from invoices where entity_type = 'install'");
    assert.deepEqual([h.total, h.approved_by, h.submitted_at], ["900.00", "ana", null]);
  }
  {
    // Two tickets on one install: the second one's lines go after the first's, at the first's discount.
    const { pg, sql } = await fresh();
    const installId = await install(pg);
    const a = await ticket(pg, { discount_kind: "percent", discount_value: 10 });
    const b = await ticket(pg, { call_id: "SC-202610-902", discount_kind: "percent", discount_value: 10 });
    const c = await ticket(pg, { call_id: "SC-202610-903" });
    await charge(pg, a, "Service : SERVICELABOR", 1, 150, "labor", 1);
    await charge(pg, b, "PARTS : TESTGASKET", 2, 12.5, "part", 1);
    await charge(pg, c, "PARTS : TESTVALVE", 1, 80, "part", 1);
    await mergeNow(sql, a, installId);
    const first = await one(pg, "select discount_kind, discount_value, total from invoices where entity_type = 'install'");
    assert.deepEqual([first.discount_kind, first.discount_value, first.total], ["percent", "10.00", "135.00"]);
    const pc = await preview(sql, c, installId);
    assert.equal(pc.install.invoice, "waiting");
    assert.equal(pc.refusal, `Install #${installId}'s invoice has a 10% discount that SC-202610-903 (${WO}) doesn't. Make them match first.`);
    const pb = await preview(sql, b, installId);
    assert.deepEqual([pb.refusal, pb.moves.chargeTotal, pb.moves.invoiceTotal], [null, 22.5, 157.5]);
    const savedFirst = (await one(pg, "select submitted_at::text as at from invoices where entity_type = 'install'")).at;
    await tick();
    await merge(sql, b, installId, pb.stamps);
    const h = await one(pg, "select id, total, submitted_by, submitted_at::text as at from invoices where entity_type = 'install'");
    assert.deepEqual([h.total, h.submitted_by], ["157.50", "boss"]);
    // Saved for approval again: an Invoice window opened in between approves nothing until it reads the new lines.
    assert.notEqual(h.at, savedFirst);
    assert.deepEqual((await pg.query("select item, sort from invoice_lines where invoice_id = $1 order by sort", [h.id])).rows, [
      { item: "Service : SERVICELABOR", sort: 1 },
      { item: "PARTS : TESTGASKET", sort: 2 },
    ]);
  }
  {
    const { pg, sql } = await fresh();
    const jobId = await ticket(pg);
    const installId = await install(pg);
    for (let n = 1; n <= 201; n += 1) await charge(pg, jobId, `PARTS : T${n}`, 1, 1, "part", n);
    assert.equal(await refusalOf(sql, jobId, installId), `Together that's more than 200 lines on Install #${installId}'s invoice.`);
  }
});

test("what the confirm read is what merges: a ticket, install or invoice changed since is refused, and nothing is written", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg);
  const installId = await install(pg);
  await charge(pg, jobId, "PARTS : TESTGASKET", 1, 12.5, "part", 1);
  const p = await preview(sql, jobId, installId);
  await tick();
  await pg.query("update service_jobs set notes = 'Typed after the confirm opened', updated_at = now() + interval '1 second' where id = $1", [jobId]);
  let before = await snapshot(pg);
  await assert.rejects(() => merge(sql, jobId, installId, p.stamps), { message: M.CHANGED_SINCE_OPENED });
  assert.equal(await snapshot(pg), before);

  const p2 = await preview(sql, jobId, installId);
  assert.match(p2.note, /Notes: Typed after the confirm opened/);
  await pg.query("update installs set technician = 'Other Tech', updated_at = now() + interval '1 second' where id = $1", [installId]);
  before = await snapshot(pg);
  await assert.rejects(() => merge(sql, jobId, installId, p2.stamps), { message: M.CHANGED_SINCE_OPENED });
  assert.equal(await snapshot(pg), before);

  // The install's invoice approved after the confirm: refused with why.
  const p3 = await preview(sql, jobId, installId);
  await pg.query("insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('install', $1, $2, 50, 'ana', now())", [installId, CAFE]);
  before = await snapshot(pg);
  await assert.rejects(() => merge(sql, jobId, installId, p3.stamps), /invoice is already approved/);
  assert.equal(await snapshot(pg), before);
});

test("the statement's own guards: stale stamps, a check that came true after the read, an invoice saved meanwhile", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg);
  const installId = await install(pg);
  await charge(pg, jobId, "PARTS : TESTGASKET", 1, 12.5, "part", 1);
  const p = await preview(sql, jobId, installId);
  const run = (stamps, extra = {}) =>
    sql.query(M.mergeTicketIntoInstallSql(), [jobId, installId, "boss", stamps.job, stamps.install, stamps.head, p.note, extra.total ?? 12.5, null, null, null, extra.so ?? "", null, extra.so ?? "", ""]);
  const before = await snapshot(pg);
  for (const bad of [{ ...p.stamps, job: "x" }, { ...p.stamps, install: "x" }, { ...p.stamps, head: "1:x:y" }]) {
    assert.deepEqual(await run(bad), []);
    assert.equal(await snapshot(pg), before);
  }
  // A PM stacked, a NetSuite invoice synced or a quote added after the read: the fresh-snapshot check still sees it.
  const pm = Number((await one(pg, "insert into pm_jobs (customer, status, stacked_job_id) values ($1, 'Open', $2) returning id", [CAFE, jobId])).id);
  assert.deepEqual(await run(p.stamps), []);
  await pg.query("update pm_jobs set stacked_job_id = null where id = $1", [pm]);
  await pg.query("insert into repair_quotes (job_id) values ($1)", [jobId]);
  assert.deepEqual(await run(p.stamps), []);
  await pg.query("delete from repair_quotes");
  await pg.query("insert into ticket_invoices (job_id, ns_invoice, status) values ($1, 'INV-9', 'Open')", [jobId]);
  assert.deepEqual(await run(p.stamps), []);
  await pg.query("delete from ticket_invoices");
  // QuickBooks history imported after the read, with charges on the ticket: they may be billed already.
  const qbRun = Number((await one(pg, "insert into wo_history_runs (filename) values ('test.xlsx') returning id")).id);
  await pg.query("insert into wo_history (run_id, history_ref, wo, customer, job_id) values ($1, 'QB-9', $2, $3, $4)", [qbRun, WO, CAFE, jobId]);
  assert.deepEqual(await run(p.stamps), []);
  await pg.query("delete from wo_history");
  assert.equal(await snapshot(pg), before);
  // A Sales Order entered after the read (its stamp left as it was): the charges are billed now, so nothing goes on.
  await pg.query("update service_jobs set ns_so = 'SO-LATE' where id = $1", [jobId]);
  assert.deepEqual(await run(p.stamps), []);
  await pg.query("update service_jobs set ns_so = null where id = $1", [jobId]);
  assert.equal(await snapshot(pg), before);
  // An invoice made for the install meanwhile (another merge, say) takes none of these lines: the confirm read none.
  await pg.query("insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at) values ('install', $1, $2, 80, 'ana', now())", [installId, CAFE]);
  const head = await one(pg, "select id::text || ':' || ':' || submitted_at::text as stamp from invoices");
  assert.deepEqual(await run({ ...p.stamps, head: "" }), []);
  // Read as it is now, it goes on after that invoice's lines.
  assert.equal((await run({ ...p.stamps, head: head.stamp }, { total: 92.5 })).length, 1);
  assert.equal((await one(pg, "select total from invoices")).total, "92.50");
  assert.equal(Number((await one(pg, "select merged_install_id from service_jobs where id = $1", [jobId])).merged_install_id), installId);
  // The database refuses a ticket that points at itself without an install, or an install merge that isn't hidden.
  const other = await ticket(pg, { call_id: "SC-X" });
  await assert.rejects(() => pg.query("update service_jobs set duplicate_of = id where id = $1", [other]), /service_jobs_merged_install_check/);
  await assert.rejects(() => pg.query("update service_jobs set merged_install_id = $2 where id = $1", [other, installId]), /service_jobs_merged_install_check/);
});

test("after the merge: its Invoice window points at the install, charges and ticket merges refuse it, and the install's invoice approves", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg);
  const installId = await install(pg);
  const live = await ticket(pg, { call_id: "SC-202610-950", wo: "WO-4950" });
  await charge(pg, jobId, "PARTS : TESTGASKET", 2, 12.5, "part", 1);
  // The ticket's own approved invoice: the confirm says it needs approving again on the install.
  await pg.query("insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('service', $1, $2, 25, 'ana', now())", [jobId, CAFE]);
  const p = await preview(sql, jobId, installId);
  assert.equal(p.warnings.length, 1);
  assert.match(p.warnings[0], new RegExp(`^SC-202610-901 \\(${WO}\\)'s invoice was approved by ana on .+\\. On the install it waits for an Admin to approve it again\\.$`));
  // The install's Invoice window opened before the merge.
  const opened = await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner");
  assert.deepEqual([opened.state, opened.version, opened.lines.length], ["none", null, 0]);
  await merge(sql, jobId, installId, p.stamps);

  const ticketInvoice = await getInvoiceFor(sql, { type: "service", id: jobId }, "u-owner");
  assert.equal(ticketInvoice.locked, `This ticket was merged into install #${installId}. Its charges are on the install's invoice.`);
  await assert.rejects(
    () => writeTicketCharges(sql, jobId, "u-owner", { lines: [{ item: "PARTS : TESTGASKET", description: "x", qty: 1, rate: 1 }] }),
    { message: `This ticket was merged into install #${installId}. Its work is on the install now.` },
  );
  assert.deepEqual(await mergeServiceJobs(sql, live, jobId, "boss"), { refused: `Ticket #${jobId} was merged into install #${installId}.` });
  assert.deepEqual(await mergeServiceJobs(sql, jobId, live, "boss"), { refused: `Ticket #${jobId} was merged into install #${installId}. Merge ticket #${live} into that install instead.` });
  assert.equal(await tryMergeServiceDuplicate(sql, live, jobId, "boss"), "skipped");
  assert.equal(await tryMergeServiceDuplicate(sql, jobId, live, "boss"), "skipped");

  // The account's Invoices: the install's lines waiting for approval, not the merged ticket's own invoice.
  const listed = await listAccountInvoicesFor(sql, CAFE, "u-owner");
  assert.deepEqual(listed.map((x) => [x.type, x.id, x.status, x.total, x.submittedBy]), [["install", installId, "Waiting for approval", 25, "boss"]]);

  // The window opened before the merge approves nothing; a tech can't approve it; read again, an Admin approves it.
  const lines = [{ item: "PARTS : TESTGASKET", description: "PARTS : TESTGASKET line", qty: 2, rate: 12.5 }];
  await assert.rejects(
    () => approveInvoiceFor(sql, { type: "install", id: installId, lines, lineIds: [], discount: null, seen: opened.version }, "u-owner"),
    { message: "Lines were saved for approval on this invoice after you opened it (a ticket or another install was merged into this one), so nothing was approved. Look over the new lines, then approve." },
  );
  const now = await getInvoiceFor(sql, { type: "install", id: installId }, "u-owner");
  assert.deepEqual([now.state, now.total, now.submittedBy, now.lines.map((l) => [l.item, l.qty, l.rate])], ["waiting", 25, "boss", [["PARTS : TESTGASKET", 2, 12.5]]]);
  await assert.rejects(
    () => approveInvoiceFor(sql, { type: "install", id: installId, lines, lineIds: [], discount: null, seen: now.version }, "u-tech"),
    { message: "This invoice is waiting for an Admin to approve it." },
  );
  const approved = await approveInvoiceFor(sql, { type: "install", id: installId, lines, lineIds: [], discount: null, seen: now.version }, "u-owner");
  assert.deepEqual([approved.state, approved.total, approved.approvedBy], ["approved", 25, "boss"]);
});

test("a later Corrigo import puts the ticket's WO on the install, whether matched by number, by Corrigo id or from a preview read before", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg, { corrigo_id: "CG-1" });
  const installId = await install(pg);
  // Before the merge the import's preview goes on the ticket (the install is the other one with the number).
  const file = (rows) => parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "Date Completed", "Work Order Id", "Primary Service Tech"], ...rows]).records;
  const stale = await previewCorrigoRecords(sql, file([["4792", "Completed", CAFE, "10/29/2026", "CG-1", "Second Tech"]]));
  assert.deepEqual(stale.rows.map((r) => [r.action, r.board, r.jobId]), [["update", "service", jobId]]);
  await mergeNow(sql, jobId, installId);
  const ticketBefore = await one(pg, "select status, technician, completed_at, updated_at from service_jobs where id = $1", [jobId]);

  // By number, and by Corrigo's own id under another number: the install, never the ticket.
  const fresh1 = await previewCorrigoRecords(sql, file([["4792", "Completed", CAFE, "10/29/2026", "", "Second Tech"], ["9999", "Open", CAFE, "", "CG-1", ""]]));
  assert.deepEqual(fresh1.rows.map((r) => [r.action, r.board, r.jobId, r.conflictIds]), [
    ["update", "install", installId, null],
    ["update", "install", installId, null],
  ]);
  assert.equal(fresh1.createCount, 0);

  // The preview read before the merge: it goes on the install too, and opens nothing.
  const res = await applyCorrigoRows(sql, stale.rows, "boss");
  assert.deepEqual([res.updated, res.created, res.refused], [1, 0, []]);
  assert.deepEqual(await one(pg, "select status, technician, completed_at, updated_at from service_jobs where id = $1", [jobId]), ticketBefore);
  const i = await one(pg, "select technician, equip_status, complete from installs where id = $1", [installId]);
  assert.deepEqual([i.technician, i.equip_status, i.complete], ["Second Tech", "Installed", true]);
  assert.match((await one(pg, "select detail from activity where entity_type = 'install' and action = 'corrigo' order by id desc limit 1")).detail, new RegExp(`^Corrigo import · ${WO}`));
  // A row the import would have opened as new finds the install as well.
  const created = await applyCorrigoRows(sql, [{ ...stale.rows[0], action: "create", jobId: null, board: "service" }], "boss");
  assert.deepEqual([created.updated, created.created], [1, 0]);
  assert.equal(Number((await one(pg, "select count(*) from service_jobs")).count), 1);
});

test("after the install it went into is merged into another, the import follows it; removed, the import writes nothing and says so", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg, { corrigo_id: "CG-1" });
  const installId = await install(pg);
  await mergeNow(sql, jobId, installId);
  const file = parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "Work Order Id"], ["4792", "Completed", CAFE, "CG-1"]]).records;
  const matched = async () => (await previewCorrigoRecords(sql, file)).rows.map((r) => [r.action, r.board, r.jobId]);

  // Merge installs: the ticket now points at the install kept (10/30), and the import follows it there, and on again.
  const keep = await install(pg, { wo: "WO-4000" });
  await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: installId });
  assert.deepEqual(await matched(), [["update", "install", keep]]);
  assert.deepEqual(await M.mergedInstallTarget(sql, jobId), { installId: keep, liveInstallId: keep });
  const last = await install(pg, { wo: "WO-4001" });
  await mergeInstallsFor(sql, "u-owner", { keepId: last, dropId: keep });
  assert.deepEqual(await M.mergedInstallTarget(sql, jobId), { installId: last, liveInstallId: last });
  assert.deepEqual(await matched(), [["update", "install", last]]);
  // A ticket merged before this release still points at the install it went into: that one is followed.
  await pg.query("update service_jobs set merged_install_id = $2 where id = $1", [jobId, installId]);
  assert.deepEqual(await M.mergedInstallTarget(sql, jobId), { installId, liveInstallId: last });

  // A link no install merge made isn't followed: one removed while flagged as a possible duplicate keeps the flag.
  const flagged = await install(pg, { wo: "WO-4002" });
  await pg.query("update installs set duplicate_of = $2 where id = $1", [last, flagged]);
  await pg.query("update installs set archived = true where id = $1", [last]);
  assert.deepEqual(await M.mergedInstallTarget(sql, jobId), { installId, liveInstallId: null });
  // A loop ends, and an install that isn't there has none.
  const [x, y] = [await install(pg, { wo: "WO-4003", archived: true }), await install(pg, { wo: "WO-4004", archived: true })];
  await pg.query("update installs set duplicate_of = case id when $1 then $2 else $1 end where id in ($1, $2)", [x, y]);
  await pg.query("insert into activity (entity_type, entity_id, action, detail) values ('install', $1::int, 'merged', 'merged into install #' || $2::text), ('install', $2::int, 'merged', 'merged into install #' || $1::text)", [x, y]);
  assert.deepEqual(await M.liveInstallIds(sql, [x, jobId + 100]), new Map());

  const gone = await previewCorrigoRecords(sql, file);
  assert.deepEqual(gone.rows.map((r) => [r.action, r.board, r.jobId]), [["update", "service", jobId]]);
  assert.match(gone.rows[0].matchNote, new RegExp(`merged into install #${installId}, which was archived: not imported`));
  const before = await snapshot(pg);
  const res = await applyCorrigoRows(sql, gone.rows, "boss");
  assert.deepEqual([res.updated, res.created], [0, 0]);
  assert.deepEqual(res.refused, [{ wo: WO, customer: CAFE, reason: `Its ticket was merged into install #${installId}, which was archived: nothing written` }]);
  assert.equal(await snapshot(pg), before);
});

test("the hidden ticket stays out of the duplicate merge, billing backfill and the window report says where it went", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg);
  const installId = await install(pg);
  await mergeNow(sql, jobId, installId);
  // A later ticket typed with the same number is not folded into the hidden one.
  const later = await ticket(pg, { call_id: "SC-202610-990" });
  assert.deepEqual(await reconcileServiceDuplicates(sql, "boss"), { merged: 0, flagged: 0, held: [] });
  assert.equal((await one(pg, "select duplicate_of from service_jobs where id = $1", [later])).duplicate_of, null);
  // That later ticket shows up as a pair to merge too.
  assert.deepEqual((await M.listTicketInstallPairsFor(sql, "u-owner", "service")).pairs.map((p) => p.jobId), [later]);

  const ctx = await loadBackfillContext(sql, ["4792"]);
  const hidden = { ...ctx, tickets: ctx.tickets.filter((t) => t.id === jobId) };
  const plan = planBackfill({ lines: [{ key: "4792", wo: WO }], invoices: [] }, hidden);
  assert.equal(plan[0].reason, `Merged into install #${installId}. Billing Backfill covers service and TLC tickets.`);

  const rows = await loadWindowRows(sql, ["service"]);
  assert.equal(rows.find((r) => r.id === jobId).note, `Merged into install #${installId}`);
  assert.equal(rows.find((r) => r.id === later).note, null);
});

test("a ticket QuickBooks invoiced: refused while it has charges (they may be billed already); without them it merges and the history stays", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg);
  const installId = await install(pg);
  await charge(pg, jobId, "PARTS : TESTGASKET", 1, 12.5, "part", 1);
  const run = Number((await one(pg, "insert into wo_history_runs (filename) values ('test.xlsx') returning id")).id);
  await pg.query("insert into wo_history (run_id, history_ref, wo, customer, job_id) values ($1, 'QB-1', $2, $3, $4)", [run, WO, CAFE, jobId]);
  assert.equal(
    await refusalOf(sql, jobId, installId),
    `SC-202610-901 (${WO}) has QuickBooks history, so its charges may be billed already. Take its charges off the ticket first, or keep the ticket.`,
  );
  await pg.query("delete from ticket_charges where job_id = $1", [jobId]);
  const p = await preview(sql, jobId, installId);
  assert.equal(p.refusal, null);
  assert.deepEqual(p.stays, ["Its own record and history", "1 QuickBooks history row"]);
  await merge(sql, jobId, installId, p.stamps);
  assert.equal(Number((await one(pg, "select job_id from wo_history")).job_id), jobId);

  // History left on a ticket merged into this one before: a ticket merge moved its charges here and left the history.
  const keeper = await ticket(pg, { call_id: "SC-202610-905", wo: "WO-4805" });
  const kid = await ticket(pg, { call_id: "SC-202610-906", wo: "WO-4805", duplicate_of: keeper });
  const other = await install(pg, { wo: "WO-4805" });
  await charge(pg, keeper, "PARTS : TESTGASKET", 1, 12.5, "part", 1);
  await pg.query("insert into wo_history (run_id, history_ref, wo, customer, job_id) values ($1, 'QB-2', 'WO-4805', $2, $3)", [run, CAFE, kid]);
  assert.equal(
    await refusalOf(sql, keeper, other),
    "SC-202610-905 (WO-4805) has QuickBooks history, so its charges may be billed already. Take its charges off the ticket first, or keep the ticket.",
  );
  // The statement checks it too.
  const before = await snapshot(pg);
  const { stamps } = await preview(sql, keeper, other);
  assert.deepEqual(await sql.query(M.mergeTicketIntoInstallSql(), [keeper, other, "boss", stamps.job, stamps.install, stamps.head, "note", 12.5, null, null, null, "", null, "", ""]), []);
  assert.equal(await snapshot(pg), before);
});

test("writes that come late to a merged ticket are refused: an import row merged meanwhile, a repair quote", async () => {
  const { pg, sql } = await fresh();
  const jobId = await ticket(pg);
  const installId = await install(pg);
  const file = parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "Primary Service Tech"], ["4792", "Completed", CAFE, "Second Tech"]]).records;
  const rows = (await previewCorrigoRecords(sql, file)).rows;
  assert.deepEqual(rows.map((r) => [r.board, r.jobId]), [["service", jobId]]);
  const p = await preview(sql, jobId, installId);
  // The import checks the ticket, then an Admin's merge commits, then the import writes the ticket.
  let raced = false;
  const racing = Object.assign((strings, ...values) => sql(strings, ...values), {
    query: async (text, params) => {
      if (!raced && /update service_jobs set\s+technician = \$2/.test(text)) {
        raced = true;
        await merge(sql, jobId, installId, p.stamps);
      }
      return sql.query(text, params);
    },
  });
  const res = await applyCorrigoRows(racing, rows, "boss");
  assert.ok(raced);
  assert.deepEqual([res.updated, res.created], [0, 0]);
  assert.deepEqual(res.refused, [{ wo: WO, customer: CAFE, reason: `Its ticket was merged into install #${installId} during the import: import the file again` }]);
  const t = await one(pg, "select status, technician, done, merged_install_id from service_jobs where id = $1", [jobId]);
  assert.deepEqual([t.status, t.technician, t.done, t.merged_install_id], ["Open", "Test Tech", true, installId]);
  // Imported again, the row goes on the install.
  const again = await applyCorrigoRows(sql, (await previewCorrigoRecords(sql, file)).rows, "boss");
  assert.deepEqual([again.updated, again.created, again.refused], [1, 0, []]);
  assert.equal((await one(pg, "select technician from installs where id = $1", [installId])).technician, "Second Tech");

  await assert.rejects(
    () => saveRepairQuoteFor(sql, { jobId, rebuildId: null, status: "Draft", note: "", lines: [] }, "u-owner"),
    { message: `This ticket was merged into install #${installId}, so it takes no repair quote.` },
  );
  assert.equal(Number((await one(pg, "select count(*) from repair_quotes")).count), 0);
});

test("after the merge: a unit pulled for the account goes on a live ticket, never a hidden one; the planner doesn't move the ticket", async () => {
  const { pg, sql } = await fresh();
  const ctx = { userId: "u-owner" };
  const jobId = await ticket(pg);
  const installId = await install(pg);
  // A ticket merged into this one before: the merge to the install marks it too, and touches it last.
  const kid = await ticket(pg, { call_id: "SC-202610-900", duplicate_of: jobId });
  await mergeNow(sql, jobId, installId);
  const shelf = async (serial) =>
    Number((await one(pg, "insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status) values ('equip', 'Test Brewer', $1, 1, 'barn-back', 'A', 1, 1, 'ready') returning id", [serial])).id);
  const first = await shelf("TB-31");
  await assignAssetToServiceFor(sql, { assetId: first, customer: CAFE }, ctx);
  assert.equal((await one(pg, "select job_id from assets where id = $1", [first])).job_id, null);
  // A live open ticket for the account takes it, even with the hidden one touched later.
  const live = await ticket(pg, { call_id: "SC-202610-907", wo: "WO-4810" });
  await pg.query("update service_jobs set updated_at = now() + interval '1 hour' where id = $1", [kid]);
  const second = await shelf("TB-32");
  await assignAssetToServiceFor(sql, { assetId: second, customer: CAFE }, ctx);
  assert.equal(Number((await one(pg, "select job_id from assets where id = $1", [second])).job_id), live);

  // A planner opened before the merge: the drag is refused and nothing moves.
  const drag = { type: "service", id: jobId, date: "2026-11-02", time: "09:00", technician: "Other Tech" };
  await assert.rejects(() => moveBoardBlockFor(sql, drag, ctx), { message: `This ticket was merged into install #${installId}. Plan the install instead.` });
  // The drag reads the ticket, then a merge commits, then the drag writes: still refused, nothing written.
  const other = await ticket(pg, { call_id: "SC-202610-908", wo: "WO-4811" });
  const otherInstall = await install(pg, { wo: "WO-4811" });
  const p = await preview(sql, other, otherInstall);
  let raced = false;
  const racing = Object.assign((strings, ...values) => sql(strings, ...values), {
    query: async (text, params) => {
      if (!raced && /^update service_jobs set scheduled/.test(text)) {
        raced = true;
        await merge(sql, other, otherInstall, p.stamps);
      }
      return sql.query(text, params);
    },
  });
  const before = await one(pg, "select scheduled, technician from service_jobs where id = $1", [other]);
  await assert.rejects(() => moveBoardBlockFor(racing, { ...drag, id: other }, ctx), { message: `This ticket was merged into install #${otherInstall}. Plan the install instead.` });
  assert.ok(raced);
  assert.deepEqual(await one(pg, "select scheduled, technician from service_jobs where id = $1", [other]), before);
  // A live ticket still moves.
  assert.deepEqual(await moveBoardBlockFor(sql, { ...drag, id: live }, ctx), { ok: true, date: "2026-11-02", time: "09:00", technician: "Other Tech" });
});

test("the install window: one notes slot per opening, its base sent when each save runs; Merge installs reads the board first", () => {
  const src = readFileSync(new URL("../src/components/desk/entity-sheets.tsx", import.meta.url), "utf8");
  const start = src.indexOf("export function InstallSheet(");
  const sheet = src.slice(start, src.indexOf("\nexport function ", start + 1));
  // A new slot for each opening, and again when the board's notes change while nothing is typed in the box.
  assert.match(sheet, /if \(\(row\?\.id \?\? null\) !== \(notesSlot\?\.id \?\? null\)\) setNotesSlot\(row \? seedNotes\(row\) : null\);/);
  assert.match(sheet, /else if \(row && notesSlot && !notesSlot\.touched && \(row\.notes \?\? ""\) !== notesSlot\.shown\) setNotesSlot\(seedNotes\(row\)\);/);
  // The box shows the slot (a new slot, a new box) and marks it typed in.
  assert.match(sheet, /key=\{notesSlot\?\.id === row\.id \? notesSlot\.seq : "notes"\}[\s\S]{0,160}defaultValue=\{notesSlot\?\.id === row\.id \? notesSlot\.shown : \(row\.notes \?\? ""\)\}[\s\S]{0,120}notesSlot\.touched = true/);
  // Each save carries its own opening's slot. The base is read when the save runs, and moves on only when it goes through.
  assert.match(sheet, /notesSlot: notesSlot\?\.id === row\.id \? notesSlot : undefined,/);
  assert.match(sheet, /mutationFn: \(vars: SaveVars\) => \{[\s\S]*?notesSlot: slot[\s\S]*?notesBase: slot\.base[\s\S]*?return updateInstall\(/);
  assert.match(sheet, /onSuccess: \(saved, vars\) => \{\s*\/\/[^\n]*\n\s*if \(vars\.notes !== undefined && vars\.notesSlot\) vars\.notesSlot\.base = vars\.notes \?\? null;/);
  assert.doesNotMatch(sheet.slice(sheet.indexOf("onError: (e, vars) => {"), sheet.indexOf("onSettled:")), /notesSlot/);
  // Closed, the queue keeps the last install's name, so a save queued at close still runs.
  assert.match(sheet, /const queue = \{ id: `install-sheet-\$\{row\?\.id \?\? lastQueued\.current\}` \};/);
  const fields = readFileSync(new URL("../src/components/desk/install-project-fields.tsx", import.meta.url), "utf8");
  assert.match(fields, /await qc\.refetchQueries\(\{ queryKey: \["installs"\] \}\)[^\n]*\n\s*onMerged\(res\.keepId\);/);
});
