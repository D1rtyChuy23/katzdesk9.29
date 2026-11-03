// A Customer P.O. and a Vendor P.O. on every ticket (Chuy, 11/2): "can you add PO to all tickets? this will help match
// some up like the TLCs or Installs or Repos. Even ones that a vendor provides their PO number to use for reference."
// Both are typed on each record's Details (service and TLC tickets, PMs, installs, rebuilds, deals), shown on its card
// and found by search. The Customer P.O. goes on the record's invoice; the Vendor P.O. is for reference only.
// All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const P = await import("../src/lib/ops/ticket-po.ts");
const api = await import("../src/lib/ops/api.ts");
const R = await import("../src/lib/ops/rebuilds.ts");
const { approveInvoiceFor, getInvoiceFor, listAccountInvoicesFor } = await import("../src/lib/ops/invoice-api.ts");
const { writeTicketCharges } = await import("../src/lib/ops/charges-api.ts");
const M = await import("../src/lib/ops/ticket-install-merge.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
const { mergeServiceJobs } = await import("../src/lib/ops/wo-duplicates.ts");
const { buildTlc } = await import("../src/lib/ops/export-reports.ts");
const { loadTicketBillingRows } = await import("../src/lib/ops/billing-report-api.ts");
const { ticketFilterRow } = await import("../src/lib/ops/billing-report.ts");
const { matchesBillingFilters } = await import("../src/lib/ops/billing-rules.ts");
const { addDays, todayChicago } = await import("../src/lib/ops/clock.ts");
const { QueryClient } = await import("@tanstack/react-query");
const { holdSavedPo } = await import("../src/components/desk/po-form.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const CAFE = "Test Bean Cafe - Uptown";
const LABOR = { item: "Service : SERVICELABOR", description: "Service Labor Hour", qty: 1, rate: 150 };
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function fresh(upTo = null) {
  const pg = new PGlite();
  for (const name of files.filter((n) => !upTo || n < upTo)) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  if (upTo) return { pg, sql };
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'boss', true, true, 'admin'),
       ('u-tech', 'tess', true, false, 'service'),
       ('u-wh', 'wade', true, false, 'warehouse')`,
  );
  await pg.query("insert into seed_meta (k, v) values ('rebuilds', 'v1') on conflict (k) do update set v = 'v1'");
  await pg.query("insert into directory_customers (name, account_number, address) values ($1, 'TEST-PO-1', '1 Test Way')", [CAFE]);
  return { pg, sql };
}
const one = async (pg, text, params) => (await pg.query(text, params)).rows[0];
const insertRow = async (pg, table, f) => {
  const cols = Object.keys(f);
  return Number((await one(pg, `insert into ${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f))).id);
};
let n = 0;
const ticket = (pg, f = {}) => insertRow(pg, "service_jobs", { kind: "service", call_id: `SC-PO-${++n}`, customer: CAFE, status: "Open", wo: `WO-${7100 + n}`, received: addDays(todayChicago(), -5), ...f });
const pm = (pg, f = {}) => insertRow(pg, "pm_jobs", { customer: CAFE, equipment: "Test brewer", status: "Pending Scheduling", ...f });
const install = (pg, f = {}) => insertRow(pg, "installs", { received: addDays(todayChicago(), -9), customer: CAFE, equip_status: "Not Ready", wo: `WO-${7300 + ++n}`, ...f });
const deal = (pg, f = {}) => insertRow(pg, "deals", { customer: CAFE, ...f });
const rebuild = (pg, f = {}) => insertRow(pg, "rebuilds", { title: "Test grinder refurb", account: CAFE, ...f });
const poOf = async (pg, table, id) => one(pg, `select po, vendor_po from ${table} where id = $1`, [id]);
const history = async (pg, type, id) => (await pg.query("select detail from activity where entity_type = $1 and entity_id = $2 order by id", [type, id])).rows.map((r) => r.detail);
/**
 * A sql handle that runs `meanwhile` once, right after the first query whose text matches `after`: another person's
 * write landing between a save's read and its write.
 */
function sqlWithInterleave(pg, after, meanwhile) {
  let fired = false;
  const query = async (text, params) => {
    const rows = (await pg.query(text, params)).rows;
    if (!fired && after.test(text)) {
      fired = true;
      await meanwhile();
    }
    return rows;
  };
  return Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
}
const sql0 = (pg) => sqlWithInterleave(pg, /^$/, async () => undefined);
const liveInvoice = (pg, jobId, status = "Open") =>
  pg.query("insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source) values ($1, 'INV-PO-1', null, '2026-10-28', $2, 150, 150, 'standalone')", [jobId, status]);

/* ------------------------------------------------------------------ the plain rules */

test("a P.O. box: trimmed, blank is none, 120 characters at most; sent only when it was changed on the form", () => {
  assert.deepEqual(P.cleanPoBox("  4455 ", "Customer P.O."), { value: "4455" });
  assert.deepEqual(P.cleanPoBox("   ", "Vendor P.O."), { value: null });
  assert.deepEqual(P.cleanPoBox("x".repeat(121), "Vendor P.O."), { error: "The Vendor P.O. is too long: 120 characters at most." });
  assert.equal(P.sentPo(undefined, "Customer P.O."), undefined);
  assert.equal(P.sentPo("", "Customer P.O."), null);
  assert.equal(P.sentPo(" TLC-9 ", "Vendor P.O."), "TLC-9");
  assert.throws(() => P.sentPo("x".repeat(121), "Customer P.O."), /The Customer P.O. is too long/);
  // A box reading what it was given sends nothing; a change (or a box emptied) is sent.
  assert.equal(P.poToSend("4455", "4455"), undefined);
  assert.equal(P.poToSend(" 4455 ", "4455"), undefined);
  assert.equal(P.poToSend("4456", "4455"), "4456");
  assert.equal(P.poToSend("", "4455"), "");
  assert.equal(P.poToSend("4455", ""), "4455");
});

test("a box on a Details tab follows its record until it is changed there, and then keeps what was typed", () => {
  const opened = { key: "job-1", value: "PO-A", base: "PO-A" };
  // Set elsewhere (the Invoice window) while the box was left alone: it shows the new one, and has nothing to send.
  const moved = P.syncPoBox(opened, "job-1", "PO-B");
  assert.deepEqual(moved, { key: "job-1", value: "PO-B", base: "PO-B" });
  assert.equal(P.poToSend(moved.value, moved.base), undefined);
  // Typed here, then set elsewhere to something else: what was typed stays and is sent.
  const typed = { ...opened, value: "PO-T" };
  const kept = P.syncPoBox(typed, "job-1", "PO-B");
  assert.equal(kept, typed);
  assert.equal(P.poToSend(kept.value, kept.base), "PO-T");
  // Typed here and saved: the record has it now, so nothing is left to send.
  const saved = P.syncPoBox(typed, "job-1", "PO-T");
  assert.deepEqual(saved, { key: "job-1", value: "PO-T", base: "PO-T" });
  assert.equal(P.poToSend(saved.value, saved.base), undefined);
  // Emptied here and saved as blank.
  assert.deepEqual(P.syncPoBox({ ...opened, value: " " }, "job-1", ""), { key: "job-1", value: " ", base: "" });
  // Another record starts it over; nothing new keeps the same state (no render loop).
  assert.deepEqual(P.syncPoBox(typed, "job-2", "PO-Z"), { key: "job-2", value: "PO-Z", base: "PO-Z" });
  assert.equal(P.syncPoBox(opened, "job-1", "PO-A"), opened);
  // Locked (billed or invoiced meanwhile): what was typed goes, and the box shows the record's, with nothing to send.
  const locked = P.syncPoBox(typed, "job-1", "PO-A", true);
  assert.deepEqual(locked, { key: "job-1", value: "PO-A", base: "PO-A" });
  assert.equal(P.syncPoBox(locked, "job-1", "PO-A", true), locked);
  assert.equal(P.poToSend(locked.value, locked.base), undefined);
});

test("after a Details save, the saved P.O.s go at once into every list its sheet may have been opened from", () => {
  const qc = new QueryClient();
  qc.setQueryData(["installs"], [{ id: 1, po: "OLD", vendorPo: null, customer: "A" }, { id: 2, po: "X", vendorPo: "Y" }]);
  qc.setQueryData(["customer-history", 7], { jobs: [], pms: [], installs: [{ id: 1, po: "OLD", vendorPo: null }], deals: [] });
  holdSavedPo(qc, "install", { id: 1, po: "NEW", vendorPo: "V" });
  assert.deepEqual(qc.getQueryData(["installs"]), [{ id: 1, po: "NEW", vendorPo: "V", customer: "A" }, { id: 2, po: "X", vendorPo: "Y" }]);
  assert.deepEqual(qc.getQueryData(["customer-history", 7]).installs, [{ id: 1, po: "NEW", vendorPo: "V" }]);
  // A PM opened from its ticket reads its own cache.
  qc.setQueryData(["pms"], [{ id: 3, po: null, vendorPo: null }]);
  qc.setQueryData(["pm", 3], { id: 3, po: null, vendorPo: null });
  holdSavedPo(qc, "pm", { id: 3, po: "PM-1", vendorPo: null });
  assert.equal(qc.getQueryData(["pms"])[0].po, "PM-1");
  assert.equal(qc.getQueryData(["pm", 3]).po, "PM-1");
  // The rebuild board keeps its rows with what the viewer may do.
  qc.setQueryData(["rebuilds"], { rows: [{ id: 5, po: "R-OLD", vendorPo: null }], canEdit: true, accountLock: null });
  holdSavedPo(qc, "rebuild", { id: 5, po: "R-NEW", vendorPo: "R-V" });
  assert.deepEqual(qc.getQueryData(["rebuilds"]), { rows: [{ id: 5, po: "R-NEW", vendorPo: "R-V" }], canEdit: true, accountLock: null });
  // Nothing is made up where nothing was read, and another record's row is left alone.
  holdSavedPo(qc, "deal", { id: 9, po: "D-1", vendorPo: null });
  assert.equal(qc.getQueryData(["deals"]), undefined);
  assert.deepEqual(qc.getQueryData(["customer-history", 7]).deals, []);
  // The three sheets do it after a save that sent a P.O.
  const sheets = src("src/components/desk/entity-sheets.tsx");
  for (const kind of ["pm", "install", "deal"]) {
    assert.ok(sheets.includes(`if (vars.po !== undefined || vars.vendorPo !== undefined) holdSavedPo(qc, "${kind}", saved);`), kind);
  }
  // The rebuild sheet saves explicitly: it holds what each Save stored, and saves a changed P.O. before its Invoice window.
  const rebuildSheet = src("src/components/desk/rebuild-sheet.tsx");
  assert.match(rebuildSheet, /onSuccess: \(next\) => \{\n\s+\/\/ The P\.O\.s as saved, at once, so the boxes take them before the board reads again\.\n\s+holdSavedPo\(qc, "rebuild", next\);/);
  assert.ok(rebuildSheet.includes("beforeOpen={savePoBeforeInvoice}"));
  assert.match(rebuildSheet, /const saved = await updateRebuild\(\{ data: \{ id: row\.id, \.\.\.changed \} \}\);\n\s+holdSavedPo\(qc, "rebuild", saved\);/);
});

test("the card line, the board search and the top search's note", () => {
  assert.equal(P.poCardLine({ po: "4455", vendorPo: "TLC-889" }), "P.O. 4455 · Vendor P.O. TLC-889");
  assert.equal(P.poCardLine({ po: " ", vendorPo: "TLC-889" }), "Vendor P.O. TLC-889");
  assert.equal(P.poCardLine({ po: "Repo 12", vendorPo: null }), "P.O. Repo 12");
  assert.equal(P.poCardLine({}), null);
  assert.equal(P.poMatches("tlc-8", { po: null, vendorPo: "TLC-889" }), true);
  assert.equal(P.poMatches("4455", { po: "PO4455", vendorPo: null }), true);
  assert.equal(P.poMatches(" ", { po: "4455" }), false);
  assert.equal(P.poSearchNote("445", { po: "4455", vendor_po: "4459" }), " · P.O. 4455");
  assert.equal(P.poSearchNote("tlc", { po: "4455", vendor_po: "TLC-9" }), " · Vendor P.O. TLC-9");
  assert.equal(P.poSearchNote("Uptown", { po: "4455" }), "");

  // An exact P.O. finds its row whatever the view shows (as a WO number does); part of one doesn't reach past the view.
  const rows = [
    { id: 1, po: "REPO-2001", vendorPo: null },
    { id: 2, po: null, vendorPo: "TLC-77" },
    { id: 3, po: "4455", vendorPo: null },
  ];
  assert.deepEqual(P.withPoMatches([rows[2]], rows, " repo-2001 ").map((r) => r.id), [1, 3]);
  assert.deepEqual(P.withPoMatches([], rows, "tlc-77").map((r) => r.id), [2]);
  assert.deepEqual(P.withPoMatches([rows[2]], rows, "REPO").map((r) => r.id), [3]);
  assert.deepEqual(P.withPoMatches([rows[2]], rows, "4").map((r) => r.id), [3]);
});

test("a ticket's Customer P.O. is locked once it is billed or invoiced in NetSuite", () => {
  assert.equal(P.ticketPoLock({ nsSo: null, invoice: null }), null);
  assert.equal(P.ticketPoLock({ nsSo: " ", invoice: null }), null);
  assert.equal(
    P.ticketPoLock({ nsSo: "SO-7001", invoice: null }),
    "Billed on SO-7001, so its Customer P.O. stays as billed. Clear the Sales Order number in the ticket's Charges to change it.",
  );
  assert.equal(
    P.ticketPoLock({ nsSo: null, invoice: { invoice: "INV-9", status: "Open" } }),
    "Invoiced in NetSuite on INV-9 (Open), so its Customer P.O. is locked. An Admin can unlock the ticket's Charges and change it there.",
  );
});

test("every board reads both P.O.s off its rows, trimmed, blank as none", () => {
  const today = todayChicago();
  const row = { id: 1, customer: CAFE, status: "Open", po: " 4455 ", vendor_po: "  " };
  assert.deepEqual((({ po, vendorPo }) => ({ po, vendorPo }))(api.mapJob({ ...row, kind: "service", call_id: "SC-1" }, today)), { po: "4455", vendorPo: null });
  assert.deepEqual((({ po, vendorPo }) => ({ po, vendorPo }))(api.mapPm({ ...row, vendor_po: "TLC-9" }, today)), { po: "4455", vendorPo: "TLC-9" });
  const week = { start: today, end: today };
  assert.deepEqual((({ po, vendorPo }) => ({ po, vendorPo }))(api.mapInstall({ ...row, po: null, vendor_po: " VEN-1 " }, today, week)), { po: null, vendorPo: "VEN-1" });
  assert.deepEqual((({ po, vendorPo }) => ({ po, vendorPo }))(api.mapDeal({ ...row, machines: null }, null)), { po: "4455", vendorPo: null });
});

/* ------------------------------------------------------------------ migration 0112 */

test("migration 0112 adds both P.O.s to every ticket table and moves each install's invoice P.O. onto the install", async () => {
  const { pg } = await fresh("0112");
  try {
    const a = await insertRow(pg, "installs", { customer: CAFE, received: "2026-10-01" });
    const b = await insertRow(pg, "installs", { customer: CAFE, received: "2026-10-01" });
    const c = await insertRow(pg, "installs", { customer: CAFE, received: "2026-10-01" });
    await pg.query("insert into invoices (entity_type, entity_id, customer, po) values ('install', $1, $3, ' PO-881 '), ('install', $2, $3, '  ')", [a, b, CAFE]);
    // A rebuild's or a deal's invoice never had a P.O. of its own; nothing to move.
    await pg.exec(readFileSync(new URL("0112_ticket_po.sql", MIGRATIONS), "utf8"));
    for (const t of ["service_jobs", "pm_jobs", "installs", "rebuilds", "deals"]) {
      const cols = (await pg.query("select column_name from information_schema.columns where table_name = $1 and column_name in ('po', 'vendor_po') order by 1", [t])).rows.map((r) => r.column_name);
      assert.deepEqual(cols, ["po", "vendor_po"], t);
    }
    assert.deepEqual(await poOf(pg, "installs", a), { po: "PO-881", vendor_po: null });
    assert.deepEqual(await poOf(pg, "installs", b), { po: null, vendor_po: null });
    assert.deepEqual(await poOf(pg, "installs", c), { po: null, vendor_po: null });
    // The invoice keeps its own copy (the site before this reads it while the publish builds).
    assert.equal((await one(pg, "select po from invoices where entity_id = $1", [a])).po, " PO-881 ");
    // Running it again changes nothing, and never overwrites a P.O. typed on the install since.
    await pg.query("update installs set po = 'PO-882' where id = $1", [a]);
    await pg.exec(readFileSync(new URL("0112_ticket_po.sql", MIGRATIONS), "utf8"));
    assert.equal((await poOf(pg, "installs", a)).po, "PO-882");
  } finally {
    await pg.close();
  }
});

/* ------------------------------------------------------------------ the Details saves */

test("a ticket's Details save writes each P.O. it sends and keeps the ones it leaves out", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await ticket(pg, { kind: "tlc" });
    assert.deepEqual(await api.updateJobFor(sql, { id, issue: "Grinder jam", po: " 4455 ", vendorPo: "TLC-889" }, "u-tech"), { notice: null });
    assert.deepEqual(await poOf(pg, "service_jobs", id), { po: "4455", vendor_po: "TLC-889" });
    assert.ok((await history(pg, "tlc", id)).includes("Customer P.O.: 4455 · Vendor P.O.: TLC-889"));
    // Set elsewhere meanwhile (the Invoice window): a save that doesn't send it (the box wasn't changed) keeps it.
    await pg.query("update service_jobs set po = '4460' where id = $1", [id]);
    await api.updateJobFor(sql, { id, issue: "Grinder jam, again" }, "u-tech");
    assert.deepEqual(await poOf(pg, "service_jobs", id), { po: "4460", vendor_po: "TLC-889" });
    assert.equal((await one(pg, "select issue from service_jobs where id = $1", [id])).issue, "Grinder jam, again");
    // Blank clears; too long is refused before anything is saved.
    await api.updateJobFor(sql, { id, vendorPo: "" }, "u-tech");
    assert.deepEqual(await poOf(pg, "service_jobs", id), { po: "4460", vendor_po: null });
    await assert.rejects(() => api.updateJobFor(sql, { id, issue: "Never saved", po: "x".repeat(121) }, "u-tech"), /The Customer P.O. is too long: 120 characters at most\./);
    assert.equal((await one(pg, "select issue from service_jobs where id = $1", [id])).issue, "Grinder jam, again");
    // A save that sends nothing new writes no history line about P.O.s.
    const lines = (await history(pg, "tlc", id)).length;
    await api.updateJobFor(sql, { id, po: "4460" }, "u-tech");
    assert.equal((await history(pg, "tlc", id)).length, lines);
  } finally {
    await pg.close();
  }
});

test("a ticket billed on a Sales Order, invoiced in NetSuite or merged into another keeps its Customer P.O.; the rest saves", async () => {
  const { pg, sql } = await fresh();
  try {
    const billed = await ticket(pg, { po: "4455", ns_so: "SO-7001" });
    const r1 = await api.updateJobFor(sql, { id: billed, notes: "Called back", po: "9999", vendorPo: "VEN-1" }, "u-tech");
    assert.equal(r1.notice, "Billed on SO-7001, so its Customer P.O. stays as billed. Clear the Sales Order number in the ticket's Charges to change it.");
    assert.deepEqual(await poOf(pg, "service_jobs", billed), { po: "4455", vendor_po: "VEN-1" });
    assert.equal((await one(pg, "select notes from service_jobs where id = $1", [billed])).notes, "Called back");

    const invoiced = await ticket(pg, { po: "5500" });
    await liveInvoice(pg, invoiced);
    const r2 = await api.updateJobFor(sql, { id: invoiced, po: "" }, "u-owner");
    assert.equal(r2.notice, "Invoiced in NetSuite on INV-PO-1 (Open), so its Customer P.O. is locked. An Admin can unlock the ticket's Charges and change it there.");
    assert.equal((await poOf(pg, "service_jobs", invoiced)).po, "5500");
    // A Voided invoice doesn't lock it.
    const voided = await ticket(pg, { po: "5600" });
    await liveInvoice(pg, voided, "Voided");
    assert.equal((await api.updateJobFor(sql, { id: voided, po: "5601" }, "u-tech")).notice, null);
    assert.equal((await poOf(pg, "service_jobs", voided)).po, "5601");

    const keeper = await ticket(pg, { po: "6600" });
    const merged = await ticket(pg, { po: "6601", duplicate_of: keeper });
    assert.equal((await api.updateJobFor(sql, { id: merged, po: "6602" }, "u-tech")).notice, `This ticket was merged into #${keeper}, so its Customer P.O. stays. The P.O. is on that ticket.`);
    assert.equal((await poOf(pg, "service_jobs", merged)).po, "6601");
    // Merged into an install: nothing is saved at all, as before.
    const intoInstall = await ticket(pg, { po: "6700" });
    const inst = await install(pg);
    await pg.query("update service_jobs set duplicate_of = id, merged_install_id = $2 where id = $1", [intoInstall, inst]);
    await assert.rejects(() => api.updateJobFor(sql, { id: intoInstall, po: "6701" }, "u-tech"), /merged into install/);
    assert.equal((await poOf(pg, "service_jobs", intoInstall)).po, "6700");
  } finally {
    await pg.close();
  }
});

test("the ticket's Charges no longer send its P.O.: a Charges save keeps the one on its Details", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await ticket(pg, { po: "4455" });
    await writeTicketCharges(sql, id, "u-tech", { lines: [LABOR], lineIds: [] });
    assert.equal((await poOf(pg, "service_jobs", id)).po, "4455");
    assert.equal(Number((await one(pg, "select count(*)::int as n from ticket_charges where job_id = $1", [id])).n), 1);
  } finally {
    await pg.close();
  }
});

test("a PM's, an install's, a deal's and a rebuild's Details save their P.O.s the same way", async () => {
  const { pg, sql } = await fresh();
  try {
    const p = await pm(pg);
    const i = await install(pg);
    const d = await deal(pg);
    const r = await rebuild(pg);
    await api.updatePmFor(sql, { id: p, po: "PM-1", vendorPo: "VEN-PM" }, "u-tech");
    await api.updateInstallFor(sql, { id: i, po: "IN-1", vendorPo: "VEN-IN" }, { userId: "u-tech" });
    await api.updateDealFor(sql, { id: d, po: "DL-1", vendorPo: "VEN-DL" }, "u-owner");
    await R.updateRebuildFor(sql, { id: r, po: "RB-1", vendorPo: "VEN-RB" }, "u-owner");
    assert.deepEqual(await poOf(pg, "pm_jobs", p), { po: "PM-1", vendor_po: "VEN-PM" });
    assert.deepEqual(await poOf(pg, "installs", i), { po: "IN-1", vendor_po: "VEN-IN" });
    assert.deepEqual(await poOf(pg, "deals", d), { po: "DL-1", vendor_po: "VEN-DL" });
    assert.deepEqual(await poOf(pg, "rebuilds", r), { po: "RB-1", vendor_po: "VEN-RB" });
    for (const [type, id, po] of [["pm", p, "PM-1"], ["install", i, "IN-1"], ["deal", d, "DL-1"], ["rebuild", r, "RB-1"]]) {
      assert.ok((await history(pg, type, id)).some((l) => l === `Customer P.O.: ${po} · Vendor P.O.: VEN-${po.slice(0, 2)}`), type);
    }

    // Changed elsewhere since (the Invoice window), then a save that leaves the boxes out: each keeps the newer one.
    await pg.query("update pm_jobs set po = 'PM-2'");
    await pg.query("update installs set po = 'IN-2'");
    await pg.query("update deals set po = 'DL-2'");
    await pg.query("update rebuilds set po = 'RB-2'");
    await api.updatePmFor(sql, { id: p, notes: "Filters in" }, "u-tech");
    await api.updateInstallFor(sql, { id: i, notes: "Dock at back" }, { userId: "u-tech" });
    await api.updateDealFor(sql, { id: d, notes: "Signed" }, "u-owner");
    await R.updateRebuildFor(sql, { id: r, notes: "Burrs ordered" }, "u-owner");
    for (const [t, id, po] of [["pm_jobs", p, "PM-2"], ["installs", i, "IN-2"], ["deals", d, "DL-2"], ["rebuilds", r, "RB-2"]]) {
      assert.equal((await poOf(pg, t, id)).po, po, t);
    }
    // Blank clears; too long is refused with nothing saved.
    await api.updatePmFor(sql, { id: p, vendorPo: " " }, "u-tech");
    assert.equal((await poOf(pg, "pm_jobs", p)).vendor_po, null);
    await assert.rejects(() => api.updateInstallFor(sql, { id: i, notes: "Never", vendorPo: "x".repeat(121) }, { userId: "u-tech" }), /The Vendor P.O. is too long/);
    assert.equal((await one(pg, "select notes from installs where id = $1", [i])).notes, "Dock at back");
    await assert.rejects(() => R.updateRebuildFor(sql, { id: r, po: "x".repeat(121) }, "u-owner"), /The Customer P.O. is too long/);
    await assert.rejects(() => api.updateDealFor(sql, { id: d, po: "x".repeat(121) }, "u-owner"), /The Customer P.O. is too long/);
    // The boards read them.
    const rb = (await R.loadRebuilds(sql)).find((x) => x.id === r);
    assert.equal(rb.po, "RB-2");
    assert.equal(rb.vendorPo, "VEN-RB");
  } finally {
    await pg.close();
  }
});

test("a save that leaves a P.O. out keeps the one the record has as it writes, not the one it read (another person's change in between)", async () => {
  const { pg } = await fresh();
  try {
    const t = await ticket(pg, { po: "OLD-T", vendor_po: "OLD-TV" });
    const p = await pm(pg, { po: "OLD-P" });
    const i = await install(pg, { po: "OLD-I" });
    const d = await deal(pg, { po: "OLD-D" });
    const r = await rebuild(pg, { po: "OLD-R" });
    const between = (table, id, po) => async () => pg.query(`update ${table} set po = $2, updated_at = now() where id = $1`, [id, po]);
    const firstRead = (table) => new RegExp(`^\\s*select \\* from ${table} where id = \\$1`);
    await api.updateJobFor(sqlWithInterleave(pg, firstRead("service_jobs"), between("service_jobs", t, "NEW-T")), { id: t, notes: "x", vendorPo: "NEW-TV" }, "u-tech");
    await api.updatePmFor(sqlWithInterleave(pg, firstRead("pm_jobs"), between("pm_jobs", p, "NEW-P")), { id: p, notes: "x" }, "u-tech");
    await api.updateInstallFor(sqlWithInterleave(pg, firstRead("installs"), between("installs", i, "NEW-I")), { id: i, notes: "x" }, { userId: "u-tech" });
    await api.updateDealFor(sqlWithInterleave(pg, firstRead("deals"), between("deals", d, "NEW-D")), { id: d, notes: "x" }, "u-owner");
    await R.updateRebuildFor(sqlWithInterleave(pg, firstRead("rebuilds"), between("rebuilds", r, "NEW-R")), { id: r, notes: "x" }, "u-owner");
    assert.deepEqual(await poOf(pg, "service_jobs", t), { po: "NEW-T", vendor_po: "NEW-TV" });
    for (const [table, id, po] of [["pm_jobs", p, "NEW-P"], ["installs", i, "NEW-I"], ["deals", d, "NEW-D"], ["rebuilds", r, "NEW-R"]]) {
      assert.equal((await poOf(pg, table, id)).po, po, table);
    }
  } finally {
    await pg.close();
  }
});

test("the ticket's Charges, an Admin's unlocked save and an Approve that send no P.O. keep the ticket's as it is when they write", async () => {
  const { pg } = await fresh();
  try {
    const chargesRead = /^\s*select po, ns_so, billed_at/;
    const between = (id, po) => async () => pg.query("update service_jobs set po = $2, updated_at = now() where id = $1", [id, po]);
    const a = await ticket(pg, { po: "OLD-A" });
    await writeTicketCharges(sqlWithInterleave(pg, chargesRead, between(a, "NEW-A")), a, "u-tech", { lines: [LABOR], lineIds: [] });
    assert.equal((await poOf(pg, "service_jobs", a)).po, "NEW-A");
    const b = await ticket(pg, { po: "OLD-B" });
    await approveInvoiceFor(sqlWithInterleave(pg, chargesRead, between(b, "NEW-B")), { type: "service", id: b, lines: [LABOR], lineIds: [], discount: null, seen: null }, "u-owner");
    assert.equal((await poOf(pg, "service_jobs", b)).po, "NEW-B");
    // An invoiced ticket an Admin unlocked: the save that leaves the P.O. out keeps it; one that sends it changes it.
    const c = await ticket(pg, { po: "OLD-C" });
    await liveInvoice(pg, c);
    await pg.query("update service_jobs set billing_unlocked_at = now(), billing_unlocked_by = 'boss', billing_unlock_reason = 'Fix the lines' where id = $1", [c]);
    await writeTicketCharges(sqlWithInterleave(pg, chargesRead, between(c, "NEW-C")), c, "u-owner", { lines: [LABOR], unlocked: { nsSo: null, billedAt: null } });
    assert.equal((await poOf(pg, "service_jobs", c)).po, "NEW-C");
    await pg.query("update service_jobs set billing_unlocked_at = now() where id = $1", [c]);
    await writeTicketCharges(sql0(pg), c, "u-owner", { po: " FIX-C ", lines: [LABOR], unlocked: { nsSo: null, billedAt: null } });
    assert.equal((await poOf(pg, "service_jobs", c)).po, "FIX-C");
  } finally {
    await pg.close();
  }
});

test("a ticket's Customer P.O. write reads the row again before it writes: one that waited for a Billing Backfill writes nothing", () => {
  // Postgres re-reads a row an UPDATE waited for, but not the invoices: the write goes only while the row is as the
  // statement first saw it (the same guard as the Charges' save and the Corrigo import).
  assert.match(src("src/lib/ops/api.ts"), /and not \$\{LIVE_INVOICE_SQL\("s\.id"\)\}\n\s+and \$\{UNCHANGED_SINCE_READ\("s", "\$1"\)\}\n\s+then \$3::text else s\.po end,/);
});

/* ------------------------------------------------------------------ the invoice */

test("every invoice carries its record's Customer P.O., and Approve saves a P.O. changed in the window on the record", async () => {
  const { pg, sql } = await fresh();
  try {
    const t = await ticket(pg, { po: "TK-1" });
    const p = await pm(pg, { po: "PM-1" });
    const i = await install(pg, { po: "IN-1" });
    const r = await rebuild(pg, { po: "RB-1" });
    const d = await deal(pg, { po: "DL-1" });
    for (const [type, id, po] of [["service", t, "TK-1"], ["pm", p, "PM-1"], ["install", i, "IN-1"], ["rebuild", r, "RB-1"], ["deal", d, "DL-1"]]) {
      const v = await getInvoiceFor(sql, { type, id }, "u-owner");
      assert.equal(v.hasPo, true, type);
      assert.equal(v.po, po, type);
    }
    const approve = (type, id, extra = {}) => approveInvoiceFor(sql, { type, id, lines: [LABOR], lineIds: [], discount: null, seen: null, ...extra }, "u-owner");

    // Left out (not changed in the window): the record keeps its own, and the invoice is approved with it.
    await approve("install", i);
    assert.equal((await poOf(pg, "installs", i)).po, "IN-1");
    assert.equal((await one(pg, "select po from invoices where entity_type = 'install' and entity_id = $1", [i])).po, "IN-1");
    const keepPm = await pm(pg, { po: "PM-KEEP" });
    await approve("pm", keepPm);
    assert.equal((await poOf(pg, "pm_jobs", keepPm)).po, "PM-KEEP");
    assert.equal((await one(pg, "select po from invoices where entity_type = 'pm' and entity_id = $1", [keepPm])).po, "PM-KEEP");
    // Changed in the window: saved on the record, and the invoice keeps it as approved.
    for (const [type, table, id, po] of [["pm", "pm_jobs", p, "PM-9"], ["rebuild", "rebuilds", r, "RB-9"], ["deal", "deals", d, "DL-9"]]) {
      await approve(type, id, { po: ` ${po} ` });
      assert.equal((await poOf(pg, table, id)).po, po, type);
      assert.equal((await one(pg, "select po from invoices where entity_type = $1 and entity_id = $2", [type, id])).po, po, type);
    }
    const seen = (await getInvoiceFor(sql, { type: "install", id: i }, "u-owner")).version;
    await approve("install", i, { seen, po: "" });
    assert.equal((await poOf(pg, "installs", i)).po, null);
    // A ticket's goes on the ticket (its Charges and the NetSuite billing export read it there).
    await approve("service", t, { po: "TK-2" });
    assert.equal((await poOf(pg, "service_jobs", t)).po, "TK-2");
    assert.ok((await history(pg, "deal", d)).some((l) => /invoice approved: 1 line, total \$150\.00 · P\.O\. DL-9/.test(l)));

    // An Approve that writes nothing (the invoice changed since the window opened) changes no P.O. either.
    await assert.rejects(() => approve("install", i, { seen: null, po: "IN-X" }), /changed after you opened it/);
    assert.equal((await poOf(pg, "installs", i)).po, null);
    // A stacked PM bills on its ticket: its window is locked, and its P.O. stays.
    const stacked = await pm(pg, { po: "PM-S", stacked_job_id: t });
    await assert.rejects(() => approve("pm", stacked, { po: "PM-T" }), /billed on ticket/);
    assert.equal((await poOf(pg, "pm_jobs", stacked)).po, "PM-S");
    // A ticket billed on a Sales Order is locked: nothing is approved and its P.O. stays.
    await pg.query("update service_jobs set ns_so = 'SO-7002' where id = $1", [t]);
    await assert.rejects(() => approve("service", t, { po: "TK-3" }), /billed on SO-7002/);
    assert.equal((await poOf(pg, "service_jobs", t)).po, "TK-2");

    // The account's Invoices list shows each record's P.O. as it is now.
    await pg.query("update rebuilds set po = 'RB-10' where id = $1", [r]);
    const list = await listAccountInvoicesFor(sql, CAFE, "u-owner");
    const poFor = (type, id) => list.find((x) => x.type === type && x.id === id)?.po;
    assert.equal(poFor("rebuild", r), "RB-10");
    assert.equal(poFor("deal", d), "DL-9");
    assert.equal(poFor("pm", p), "PM-9");
    assert.equal(poFor("service", t), "TK-2");
  } finally {
    await pg.close();
  }
});

/* ------------------------------------------------------------------ merges */

const mergeIntoInstall = async (sql, jobId, installId) => {
  const p = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId, installId });
  if (p.refusal) return { refusal: p.refusal, p };
  // As this release's window sends it: the stamps, and what the confirm showed a billed ticket billed on.
  const billed = { billedSo: p.moves.billed?.so ?? "", billedOn: p.moves.billed?.on ?? "" };
  return { p, r: await M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId, installId, stamps: p.stamps, ...billed }) };
};

test("a ticket merged into an install: its Customer P.O. goes onto the install with its charges, its Vendor P.O. fills a blank one", async () => {
  const { pg, sql } = await fresh();
  try {
    const wo = "WO-7801";
    const i = await install(pg, { wo, vendor_po: null });
    const t = await ticket(pg, { wo, po: "PO-T1", vendor_po: "TLC-1" });
    await pg.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : SERVICELABOR', 'labor', 1, 150, 'labor', 1)", [t]);
    const m = await mergeIntoInstall(sql, t, i);
    assert.equal(m.refusal, undefined, m.refusal);
    assert.equal(m.p.moves.invoicePo, "PO-T1");
    assert.match(m.p.note, /\nP\.O\.: PO-T1\nVendor P\.O\.: TLC-1/);
    assert.deepEqual(await poOf(pg, "installs", i), { po: "PO-T1", vendor_po: "TLC-1" });
    assert.equal((await getInvoiceFor(sql, { type: "install", id: i }, "u-owner")).po, "PO-T1");

    // The install's own P.O.s stay; a different Customer P.O. stops a merge whose charges would go on its invoice.
    const wo2 = "WO-7802";
    const i2 = await install(pg, { wo: wo2, po: "PO-OWN", vendor_po: "VEN-OWN" });
    const clash = await ticket(pg, { wo: wo2, po: "PO-T2", vendor_po: "TLC-2" });
    await pg.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : SERVICELABOR', 'labor', 1, 150, 'labor', 1)", [clash]);
    const refused = await mergeIntoInstall(sql, clash, i2);
    assert.match(refused.refusal, /has P\.O\. PO-T2 and .* invoice has P\.O\. PO-OWN\. One invoice takes one P\.O\.: make them match first\./);
    // With no charges it merges; the install keeps both of its own.
    await pg.query("delete from ticket_charges where job_id = $1", [clash]);
    const ok = await mergeIntoInstall(sql, clash, i2);
    assert.equal(ok.refusal, undefined, ok.refusal);
    assert.equal(ok.p.moves.invoicePo, null);
    assert.deepEqual(await poOf(pg, "installs", i2), { po: "PO-OWN", vendor_po: "VEN-OWN" });

    // A billed ticket's Customer P.O. stays with its billing (the note keeps it); its Vendor P.O. still fills a blank one.
    const wo3 = "WO-7803";
    const i3 = await install(pg, { wo: wo3 });
    const billed = await ticket(pg, { wo: wo3, po: "PO-B", vendor_po: "VEN-B", ns_so: "SO-7003" });
    await pg.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : SERVICELABOR', 'labor', 1, 150, 'labor', 1)", [billed]);
    const b = await mergeIntoInstall(sql, billed, i3);
    assert.equal(b.refusal, undefined, b.refusal);
    assert.deepEqual(await poOf(pg, "installs", i3), { po: null, vendor_po: "VEN-B" });
  } finally {
    await pg.close();
  }
});

test("Merge installs: one install takes one Customer P.O.; the keeper's P.O.s, else the dropped one's", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await install(pg, { po: null, vendor_po: "VEN-K" });
    const drop = await install(pg, { po: "PO-D", vendor_po: "VEN-D" });
    await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    assert.deepEqual(await poOf(pg, "installs", keep), { po: "PO-D", vendor_po: "VEN-K" });

    const a = await install(pg, { po: "PO-A" });
    const b = await install(pg, { po: " po-a " });
    await mergeInstallsFor(sql, "u-owner", { keepId: a, dropId: b });
    assert.equal((await poOf(pg, "installs", a)).po, "PO-A");

    const x = await install(pg, { po: "PO-X" });
    const y = await install(pg, { po: "PO-Y" });
    await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: x, dropId: y }), {
      message: `Install #${x} has P.O. PO-X and #${y} has P.O. PO-Y. One install takes one P.O.: make them match first.`,
    });
    assert.equal((await one(pg, "select archived from installs where id = $1", [y])).archived, false);
  } finally {
    await pg.close();
  }
});

test("merging two tickets: the keeper's Vendor P.O., else the extra's, and the history names a second one", async () => {
  const { pg, sql } = await fresh();
  try {
    const keeper = await ticket(pg, { wo: "WO-7901", vendor_po: null, po: null });
    const extra = await ticket(pg, { wo: "WO-7901", vendor_po: "TLC-5", po: "PO-E" });
    await mergeServiceJobs(sql, keeper, extra, "Chuy");
    assert.deepEqual(await poOf(pg, "service_jobs", keeper), { po: "PO-E", vendor_po: "TLC-5" });

    const k2 = await ticket(pg, { wo: "WO-7902", vendor_po: "TLC-6" });
    const e2 = await ticket(pg, { wo: "WO-7902", vendor_po: "TLC-7" });
    await mergeServiceJobs(sql, k2, e2, "Chuy");
    assert.equal((await poOf(pg, "service_jobs", k2)).vendor_po, "TLC-6");
    assert.ok((await history(pg, "service", k2)).some((l) => /extra Vendor P\.O\. TLC-7/.test(l)));
    // A keeper billed on a Sales Order keeps its Customer P.O. too, even a blank one (it went to NetSuite as it was).
    const k4 = await ticket(pg, { wo: "WO-7904", po: null, ns_so: "SO-7904" });
    const e4 = await ticket(pg, { wo: "WO-7904", po: "PO-LATE" });
    await mergeServiceJobs(sql, k4, e4, "Chuy");
    assert.equal((await poOf(pg, "service_jobs", k4)).po, null);
    // The keeper's history names the P.O. it didn't take.
    assert.ok((await history(pg, "service", k4)).some((l) => / · extra P\.O\. PO-LATE/.test(l)));
    // An invoiced keeper's Vendor P.O. still fills (it's reference only); its Customer P.O. stays locked as before.
    const k3 = await ticket(pg, { wo: "WO-7903", po: null, vendor_po: null });
    await liveInvoice(pg, k3);
    const e3 = await ticket(pg, { wo: "WO-7903", po: "PO-E3", vendor_po: "TLC-8" });
    await mergeServiceJobs(sql, k3, e3, "Chuy");
    assert.deepEqual(await poOf(pg, "service_jobs", k3), { po: null, vendor_po: "TLC-8" });
  } finally {
    await pg.close();
  }
});

/* ------------------------------------------------------------------ search, billing and the TLC export */

test("the top search finds every kind of ticket by either P.O., and says so", async () => {
  const { pg, sql } = await fresh();
  try {
    const t = await ticket(pg, { kind: "tlc", po: "REPO-ALPHA" });
    const p = await pm(pg, { vendor_po: "VEN-PM-BRAVO" });
    const i = await install(pg, { po: "INST-CHARLIE" });
    const d = await deal(pg, { vendor_po: "VEN-DL-DELTA" });
    const r = await rebuild(pg, { po: "RB-ECHO" });
    const archived = await rebuild(pg, { po: "RB-ECHO-2", archived: true });
    const find = async (q) => api.searchAllFor(sql, { q }, { userId: "u-owner" });
    const hit = (hits, type, id) => hits.find((h) => h.entityType === type && h.id === id);

    assert.match(hit(await find("repo-al"), "tlc", t).subtitle, / · P\.O\. REPO-ALPHA$/);
    assert.match(hit(await find("ven-pm"), "pm", p).subtitle, / · Vendor P\.O\. VEN-PM-BRAVO$/);
    assert.match(hit(await find("INST-CHARLIE"), "install", i).subtitle, / · P\.O\. INST-CHARLIE$/);
    assert.match(hit(await find("VEN-DL"), "deal", d).subtitle, / · Vendor P\.O\. VEN-DL-DELTA$/);
    const rb = hit(await find("rb-ec"), "rebuild", r);
    assert.equal(rb.title, "Test grinder refurb");
    assert.equal(rb.subtitle, `${CAFE} · Rebuilds · Queued · P.O. RB-ECHO`);
    assert.equal(hit(await find("rb-ec"), "rebuild", archived), undefined);
    // Found by something else: no note.
    assert.doesNotMatch(hit(await find("Uptown"), "tlc", t).subtitle, /P\.O\./);

    // A sales rep sees only their accounts' rebuilds, and theirs are found even when others' match first.
    await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('u-rep', 'Riley Rep', 'riley@example.com', true)`);
    await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role, email) values ('u-rep', 'riley', true, false, 'sales', 'riley@example.com')");
    await pg.query("insert into directory_customers (name, account_rep) values ('Rep Test Cafe', 'Riley Rep'), ('Other Test Cafe', 'Someone Else')");
    // More newer rebuilds of other accounts match than any one read would take (21; the first version read 20).
    const mine = await rebuild(pg, { title: "Rep grinder", account: "Rep Test Cafe", po: "PO-REPX-MINE" });
    for (let k = 0; k < 21; k++) await rebuild(pg, { title: `Other ${k}`, account: "Other Test Cafe", po: `PO-REPX-OTHER-${k}` });
    const repHits = (await api.searchAllFor(sql, { q: "PO-REPX" }, { userId: "u-rep" })).filter((h) => h.entityType === "rebuild");
    assert.deepEqual(repHits.map((h) => h.id), [mine]);
    assert.equal((await find("PO-REPX")).filter((h) => h.entityType === "rebuild").length, 5);
  } finally {
    await pg.close();
  }
});

test("the Invoices page's search finds a ticket by its P.O.s, and the TLC export's P.O. # is the ticket's own", async () => {
  const { pg, sql } = await fresh();
  try {
    const t = await ticket(pg, { kind: "tlc", po: "TLC-PO-77", vendor_po: "VEN-77", completed_at: todayChicago() });
    const rows = await loadTicketBillingRows(sql, { kind: "tlc" });
    const row = rows.find((x) => x.id === t);
    assert.equal(row.po, "TLC-PO-77");
    assert.equal(row.vendorPo, "VEN-77");
    assert.equal(matchesBillingFilters(ticketFilterRow(row), { q: "tlc-po-7" }), true);
    assert.equal(matchesBillingFilters(ticketFilterRow(row), { q: "ven-77" }), true);
    assert.equal(matchesBillingFilters(ticketFilterRow(row), { q: "nothing-like-it" }), false);

    // The TLC & Factors sheet: the ticket's own P.O., else one written in its text.
    const written = await ticket(pg, { kind: "tlc", notes: "Customer P.O. # 55-12 on file", completed_at: todayChicago() });
    const sheet = await buildTlc(sql, {}, new Set());
    const col = sheet.columns.indexOf("P.O. #");
    const woOf = async (id) => (await one(pg, "select wo from service_jobs where id = $1", [id])).wo;
    const byWo = new Map(sheet.rows.map((x) => [x[0], x[col]]));
    assert.equal(byWo.get(await woOf(t)), "TLC-PO-77");
    assert.equal(byWo.get(await woOf(written)), "55-12");
  } finally {
    await pg.close();
  }
});

/* ------------------------------------------------------------------ the screens */

test("each Details tab has both P.O. boxes and sends a box only when it was changed there", () => {
  const job = src("src/components/desk/job-sheet.tsx");
  const sheets = src("src/components/desk/entity-sheets.tsx");
  const rebuildSheet = src("src/components/desk/rebuild-sheet.tsx");
  assert.match(job, /<PoFields idPrefix=\{`job-\$\{j\.id\}`\} po=\{j\.po\} vendorPo=\{j\.vendorPo\} lock=\{poLock\}/);
  assert.match(job, /\.\.\.poFromForm\(el\),/);
  // The ticket's lock is its Charges' billing (the same read), and a notice is shown even when the save closes the sheet.
  assert.match(job, /ticketPoLock\(\{ nsSo: billing\.data\?\.nsSo, invoice: billing\.data\?\.invoiceLock \}\)/);
  assert.match(job, /if \(notice\) toast\.warning\(notice\);/);
  for (const prefix of ["pm-${pm.id}", "install-${row.id}", "deal-${deal.id}"]) assert.ok(sheets.includes("idPrefix={`" + prefix + "`}"), prefix);
  // The install's form submit, and the PM's and the deal's patch builders (their saves before the Invoice window use them too).
  assert.equal((sheets.match(/\.\.\.poFromForm\(e\.currentTarget\),/g) ?? []).length, 1);
  assert.equal((sheets.match(/\.\.\.poFromForm\(form\),/g) ?? []).length, 2);
  assert.match(sheets, /save\.mutate\(pmPatchOf\(e\.currentTarget, pm\.id\)\);/);
  assert.match(sheets, /save\.mutate\(dealPatchOf\(e\.currentTarget, deal\.id\)\);/);
  assert.match(rebuildSheet, /const po = useSyncedPo\(row\?\.po, row\?\.id \?\? null\);/);
  assert.match(rebuildSheet, /\.\.\.\(po\.toSend\(\) !== undefined \? \{ po: po\.toSend\(\) \} : \{\}\),/);
  // The boxes read what each box was given: a box left as it was sends nothing.
  // Each box keeps its base in state (React writes a box's starting value into the input, which counts as typed in it,
  // so the input's own defaultValue can't tell what was typed here from what changed elsewhere).
  const form = src("src/components/desk/po-form.ts");
  assert.match(form, /return poToSend\(el\.value, el\.getAttribute\("data-base"\) \?\? ""\);/);
  assert.match(form, /if \(!\(el instanceof HTMLInputElement\) \|\| el\.disabled\) return undefined;/);
  const fields = src("src/components/desk/po-fields.tsx");
  assert.match(fields, /const vendor = useSyncedPo\(vendorPo, idPrefix\);/);
  assert.match(fields, /value=\{customer\.value\}\n\s+onChange=\{\(e\) => customer\.set\(e\.target\.value\)\}\n\s+data-base=\{customer\.base\}/);
});

test("a sheet that saves as it closes saves before its Invoice window opens, so a P.O. approved there isn't put back", () => {
  const win = src("src/components/desk/invoice-window.tsx");
  assert.match(win, /if \(beforeOpen\) \{\n\s+setOpening\(true\);\n\s+const saved = await beforeOpen\(\)\.catch\(\(\) => false\);\n\s+setOpening\(false\);\n\s+if \(!saved\) return;\n\s+\}\n\s+setOpen\(true\);/);
  const job = src("src/components/desk/job-sheet.tsx");
  assert.equal((job.match(/beforeOpen=\{saveBeforeInvoice\}/g) ?? []).length, 2);
  assert.match(job, /await save\.mutateAsync\(formPatch\(formRef\.current, j\.id\)\);\n\s+return true;/);
  const sheets = src("src/components/desk/entity-sheets.tsx");
  assert.ok(sheets.includes('<InvoiceButton type="pm" id={pm.id} key={`invoice-pm-${pm.id}`} beforeOpen={saveBeforeInvoice} />'));
  assert.ok(sheets.includes('<InvoiceButton type="install" id={row.id} key={`invoice-install-${row.id}`} beforeOpen={saveInstallBeforeInvoice} />'));
  // Each runs the form's own checks first (a required customer, a half-typed date), as Save does.
  assert.equal((sheets.match(/!form\.checkValidity\(\)/g) ?? []).length, 2);
  assert.match(sheets, /if \(!formRef\.current\.reportValidity\(\)\) return false;/);
  assert.match(job, /if \(!form\.checkValidity\(\)\) \{\n\s+pickTab\("ticket"\);/);
  assert.ok(sheets.includes('<InvoiceButton type="deal" id={deal.id} key={`invoice-deal-${deal.id}`} beforeOpen={saveDealBeforeInvoice} />'));
  assert.match(sheets, /await save\.mutateAsync\(pmPatchOf\(formRef\.current, pm\.id\)\);/);
  assert.match(sheets, /await save\.mutateAsync\(dealPatchOf\(formRef\.current, deal\.id\)\);/);
  // After an Approve, the sheets opened from an account and a PM opened from its ticket read the record again.
  assert.match(win, /void qc\.invalidateQueries\(\{ queryKey: \["customer-history"\] \}\);\n\s+void qc\.invalidateQueries\(\{ queryKey: \["pm"\] \}\);/);
  // A locked box shows the record's P.O. and holds nothing typed.
  assert.match(src("src/components/desk/po-fields.tsx"), /const customer = useSyncedPo\(po, idPrefix, !!lock\);/);
});

test("the Charges show the ticket's P.O. and change it only in an Admin's unlocked save; the Invoice window sends one only when changed", () => {
  const charges = src("src/components/desk/charges-panel.tsx");
  // A save starts the panel over from the server, the P.O. too, and the ticket's Details and the account's invoices read it again.
  assert.match(charges, /loaded\.current = null;\n\s+setDirty\(false\);\n\s+setPoDirty\(false\);\n\s+qc\.setQueryData\(\["charges", jobId\], next\);/);
  assert.match(charges, /void qc\.invalidateQueries\(\{ queryKey: \["job", jobId\] \}\);/);
  assert.match(charges, /saveTicketCharges\(\{ data: \{ jobId, lines, lineIds:/);
  assert.match(charges, /\.\.\.\(poDirty \? \{ po \} : \{\}\),/);
  assert.match(charges, /id="charge-po"\n\s+value=\{po\}\n\s+disabled=\{!unlocked\}/);
  const win = src("src/components/desk/invoice-window.tsx");
  assert.match(win, /\.\.\.\(v\?\.hasPo && po\.trim\(\) !== poOpened\.trim\(\) \? \{ po \} : \{\}\)/);
  assert.match(win, /disabled=\{locked \|\| !v\.canApprove\}/);
});

test("every board's card shows the P.O.s, and every board's search finds them", () => {
  const cards = [
    ["src/components/desk/jobs-page.tsx", "<PoLine po={job.po} vendorPo={job.vendorPo} />"],
    ["src/routes/_app/pms.tsx", "<PoLine po={p.po} vendorPo={p.vendorPo} />"],
    ["src/routes/_app/installs.tsx", '<PoLine po={i.po} vendorPo={i.vendorPo} className="sm:pl-20" />'],
    ["src/components/desk/rebuild-board.tsx", "<PoLine po={r.po} vendorPo={r.vendorPo}"],
    ["src/routes/_app/pipeline.tsx", "<PoLine po={d.po} vendorPo={d.vendorPo} />"],
  ];
  for (const [file, line] of cards) assert.ok(src(file).includes(line), file);
  // An account's history rows (and a ticket's Schedules) carry them too.
  const history = src("src/components/desk/account-history.tsx");
  for (const r of ["j", "p", "i", "d"]) assert.ok(history.includes(`poCardLine(${r})].filter(Boolean).join(" · ")`), r);
  for (const [file, row] of [
    ["src/components/desk/jobs-page.tsx", "j"],
    ["src/routes/_app/pms.tsx", "p"],
    ["src/routes/_app/installs.tsx", "i"],
    ["src/routes/_app/rebuilds.tsx", "r"],
    ["src/routes/_app/pipeline.tsx", "d"],
  ]) {
    const s = src(file);
    assert.ok(s.includes(`${row}.po, ${row}.vendorPo`), `${file}: search reads both P.O.s`);
    assert.match(s, /withPoMatches\(/, file);
  }
});
