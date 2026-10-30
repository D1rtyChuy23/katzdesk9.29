// A P.O. on an install's invoice (Chuy, 10/30): an approved install invoice is entered into NetSuite, which emails it to
// the customer, so it carries the customer's P.O. A ticket merged into the install brings its P.O.; Merge installs takes
// the dropped install's invoice to the install kept, so charges merged onto it are billed from there. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const M = await import("../src/lib/ops/ticket-install-merge.ts");
const { approveInvoiceFor, getInvoiceFor, listAccountInvoicesFor } = await import("../src/lib/ops/invoice-api.ts");
const { cleanPo, carriesPo } = await import("../src/lib/ops/invoice.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
const { addDays, todayChicago } = await import("../src/lib/ops/clock.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const CAFE = "Test Sushi - Bayfront";
const LABOR = { item: "Service : SERVICELABOR", description: "Service Labor Hour", qty: 2, rate: 150 };

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
async function install(pg, fields = {}) {
  const f = { received: addDays(todayChicago(), -21), customer: CAFE, equip_status: "Installed", complete: true, wo: "WO-4792", technician: "Test Tech", ...fields };
  const cols = Object.keys(f);
  return Number((await one(pg, `insert into installs (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f))).id);
}
async function ticket(pg, fields = {}) {
  const f = { kind: "service", call_id: "SC-202610-901", customer: CAFE, issue: "1 Test Way", status: "Open", wo: "WO-4792", received: addDays(todayChicago(), -18), technician: "Test Tech", ...fields };
  const cols = Object.keys(f);
  return Number((await one(pg, `insert into service_jobs (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f))).id);
}
const charge = (pg, jobId) =>
  pg.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : SERVICELABOR', 'labor', 2, 150, 'labor', 1)", [jobId]);
const approve = (sql, id, extra = {}) => approveInvoiceFor(sql, { type: "install", id, lines: [LABOR], lineIds: [], discount: null, seen: null, ...extra }, "u-owner");
// Approve as the window does: it sends the version of the invoice it opened.
const approveOpened = async (sql, id, extra = {}) => approve(sql, id, { seen: (await getInvoiceFor(sql, { type: "install", id }, "u-owner")).version, ...extra });
const CHANGED = "This invoice was changed after you opened it, so nothing was approved. Look over it as it is now, then approve.";
const bothInvoices = (drop, keep) =>
  `Install #${drop} and install #${keep} both have an invoice, and one install takes one invoice. Move #${drop}'s lines to #${keep}'s invoice by hand (take them off #${drop}'s and approve it), then merge.`;
const mergeNow = async (sql, jobId, installId) => {
  const p = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId, installId });
  assert.equal(p.refusal, null, p.refusal ?? "");
  return { p, r: await M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId, installId, stamps: p.stamps }) };
};

test("rules: an install's invoice carries a P.O.; trimmed, blank is none, 120 characters at most", () => {
  assert.ok(carriesPo("install"));
  for (const t of ["service", "tlc", "pm", "rebuild", "deal"]) assert.ok(!carriesPo(t), t);
  assert.deepEqual(cleanPo("  PO-77 "), { po: "PO-77" });
  assert.deepEqual(cleanPo("   "), { po: null });
  assert.deepEqual(cleanPo(null), { po: null });
  assert.deepEqual(cleanPo("x".repeat(120)), { po: "x".repeat(120) });
  assert.deepEqual(cleanPo("x".repeat(121)), { error: "The P.O. is too long: 120 characters at most." });
});

test("the Invoice window: an install invoice's P.O. is approved with it, shown, kept when not sent, and cleared when blank", async () => {
  const { pg, sql } = await fresh();
  const id = await install(pg);
  const opened = await getInvoiceFor(sql, { type: "install", id }, "u-owner");
  assert.deepEqual([opened.hasPo, opened.po], [true, null]);
  const v = await approve(sql, id, { po: " PO-77 " });
  assert.deepEqual([v.hasPo, v.po, v.total], [true, "PO-77", 300]);
  assert.equal((await one(pg, "select po from invoices where entity_type = 'install' and entity_id = $1", [id])).po, "PO-77");
  assert.match((await one(pg, "select detail from activity where entity_type = 'install' and entity_id = $1 order by id desc limit 1", [id])).detail, /· P\.O\. PO-77$/);
  // Approved again without one sent (an older window): it stays. Sent blank: cleared.
  assert.equal((await approveOpened(sql, id)).po, "PO-77");
  assert.equal((await approveOpened(sql, id, { po: "" })).po, null);
  await assert.rejects(() => approveOpened(sql, id, { po: "x".repeat(121) }), { message: "The P.O. is too long: 120 characters at most." });
  // The account's Invoices tab shows it, and a ticket's own P.O.
  await approveOpened(sql, id, { po: "PO-78" });
  const jobId = await ticket(pg, { wo: "WO-4800", po: "PO-T1" });
  await charge(pg, jobId);
  const rows = await listAccountInvoicesFor(sql, CAFE, "u-owner");
  assert.deepEqual(
    rows.map((r) => [r.type, r.id, r.po]).sort((a, b) => a[0].localeCompare(b[0])),
    [
      ["install", id, "PO-78"],
      ["service", jobId, "PO-T1"],
    ],
  );
  // Other invoices carry none of their own.
  const rebuild = Number((await one(pg, "insert into rebuilds (title, account) values ('R', $1) returning id", [CAFE])).id);
  const rv = await approveInvoiceFor(sql, { type: "rebuild", id: rebuild, lines: [LABOR], lineIds: [], discount: null, seen: null, po: "PO-X" }, "u-owner");
  assert.deepEqual([rv.hasPo, rv.po], [false, null]);
  assert.equal((await one(pg, "select po from invoices where entity_type = 'rebuild'")).po, null);
  const deal = Number((await one(pg, "insert into deals (customer) values ($1) returning id", [CAFE])).id);
  const dv = await approveInvoiceFor(sql, { type: "deal", id: deal, lines: [LABOR], lineIds: [], discount: null, seen: null, po: "PO-Y" }, "u-owner");
  assert.deepEqual([dv.hasPo, dv.po], [false, null]);
  assert.equal((await one(pg, "select po from invoices where entity_type = 'deal'")).po, null);
});

test("a ticket merged into an install brings its P.O. onto the install's invoice; a different one is refused", async () => {
  const { pg, sql } = await fresh();
  // A new invoice takes the ticket's P.O., and the confirm says so.
  const a = await install(pg);
  const ta = await ticket(pg, { po: "PO-500" });
  await charge(pg, ta);
  const { p } = await mergeNow(sql, ta, a);
  assert.equal(p.moves.invoicePo, "PO-500");
  assert.deepEqual(await one(pg, "select po, submitted_by from invoices where entity_type = 'install' and entity_id = $1", [a]), { po: "PO-500", submitted_by: "boss" });
  assert.equal((await getInvoiceFor(sql, { type: "install", id: a }, "u-owner")).po, "PO-500");
  assert.equal((await one(pg, "select moved->>'ticketPo' as po from ticket_install_merges where job_id = $1", [ta])).po, "PO-500");

  // An invoice waiting with no P.O. takes it; one with the same P.O. keeps it.
  const b = await install(pg, { wo: "WO-4801" });
  await pg.query("insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at) values ('install', $1, $2, 0, 'ana', now())", [b, CAFE]);
  const tb = await ticket(pg, { call_id: "SC-202610-902", wo: "WO-4801", po: "PO-501" });
  await charge(pg, tb);
  await mergeNow(sql, tb, b);
  assert.equal((await one(pg, "select po from invoices where entity_type = 'install' and entity_id = $1", [b])).po, "PO-501");
  const c = await install(pg, { wo: "WO-4802" });
  await pg.query("insert into invoices (entity_type, entity_id, customer, total, po) values ('install', $1, $2, 0, 'po-502')", [c, CAFE]);
  const tc = await ticket(pg, { call_id: "SC-202610-903", wo: "WO-4802", po: "PO-502" });
  await charge(pg, tc);
  const kept = await mergeNow(sql, tc, c);
  assert.equal(kept.p.moves.invoicePo, "po-502");
  assert.equal((await one(pg, "select po from invoices where entity_type = 'install' and entity_id = $1", [c])).po, "po-502");

  // A different P.O.: refused, nothing written. No charges: the invoice isn't touched, so there is nothing to clash.
  const d = await install(pg, { wo: "WO-4803" });
  await pg.query("insert into invoices (entity_type, entity_id, customer, total, po) values ('install', $1, $2, 0, 'PO-600')", [d, CAFE]);
  const td = await ticket(pg, { call_id: "SC-202610-904", wo: "WO-4803", po: "PO-601" });
  await charge(pg, td);
  const refused = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: td, installId: d });
  assert.equal(refused.refusal, `SC-202610-904 (WO-4803) has P.O. PO-601 and Install #${d}'s invoice has P.O. PO-600. One invoice takes one P.O.: make them match first.`);
  await assert.rejects(() => M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId: td, installId: d, stamps: refused.stamps }), { message: refused.refusal });
  assert.equal((await one(pg, "select merged_install_id from service_jobs where id = $1", [td])).merged_install_id, null);
  await pg.query("delete from ticket_charges where job_id = $1", [td]);
  const free = await mergeNow(sql, td, d);
  assert.equal(free.p.moves.invoicePo, null);
  assert.equal((await one(pg, "select po from invoices where entity_type = 'install' and entity_id = $1", [d])).po, "PO-600");
});

test("Merge installs takes the dropped install's invoice, part lines and merged tickets to the one kept; both with an invoice waits for the lines to be moved", async () => {
  const { pg, sql } = await fresh();
  const keep = await install(pg, { wo: "WO-4810" });
  const drop = await install(pg, { wo: "WO-4811" });
  const tj = await ticket(pg, { wo: "WO-4811", po: "PO-700" });
  await charge(pg, tj);
  await mergeNow(sql, tj, drop);
  await pg.query("insert into ticket_part_lines (wo, item, sku, qty, used_on, source, install_id) values ('WO-4811', 'PARTS : TESTGASKET', 'TESTGASKET', 1, current_date, 'corrigo', $1)", [drop]);
  const res = await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
  assert.deepEqual([res.invoiceMoved, res.partLines], [true, 1]);
  // The invoice is the keeper's now, as it was: lines, P.O. and waiting for approval.
  const inv = await getInvoiceFor(sql, { type: "install", id: keep }, "u-owner");
  assert.deepEqual([inv.state, inv.po, inv.lines.length, inv.total], ["waiting", "PO-700", 1, 300]);
  assert.equal(Number((await one(pg, "select count(*) from invoices where entity_type = 'install' and entity_id = $1", [drop])).count), 0);
  assert.equal(Number((await one(pg, "select install_id from ticket_part_lines")).install_id), keep);
  assert.equal(Number((await one(pg, "select merged_install_id from service_jobs where id = $1", [tj])).merged_install_id), keep);
  assert.deepEqual(await M.mergedInstallTarget(sql, tj), { installId: keep, liveInstallId: keep });
  assert.match((await one(pg, "select detail from activity where entity_type = 'install' and entity_id = $1 and action = 'merged' and detail like 'merged install #%'", [keep])).detail, / · its invoice/);
  assert.ok((await listAccountInvoicesFor(sql, CAFE, "u-owner")).some((r) => r.type === "install" && r.id === keep && r.po === "PO-700"));

  // Both with an invoice: refused while the dropped one has lines, before anything is written.
  const other = await install(pg, { wo: "WO-4812" });
  await approve(sql, other, { po: "PO-701" });
  await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: other }), { message: bothInvoices(other, keep) });
  assert.equal((await one(pg, "select archived from installs where id = $1", [other])).archived, false);
  // Its lines taken off (approved with none, as the message says): it merges, and its empty invoice stays on it.
  await approveOpened(sql, other, { lines: [] });
  const emptied = await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: other });
  assert.equal(emptied.invoiceMoved, false);
  assert.deepEqual(
    (await pg.query("select v.entity_id, v.total::text as total, (select count(*)::int from invoice_lines l where l.invoice_id = v.id) as lines from invoices v where v.entity_type = 'install' order by v.entity_id")).rows.map(
      (r) => [Number(r.entity_id), r.total, r.lines],
    ),
    [
      [keep, "300.00", 1],
      [other, "0.00", 0],
    ],
  );
  assert.doesNotMatch((await one(pg, "select detail from activity where entity_type = 'install' and entity_id = $1 and detail like $2", [keep, `merged install #${other}%`])).detail, /its invoice/);
  // Neither has one: nothing to move.
  const [k2, d2] = [await install(pg, { wo: "WO-4813" }), await install(pg, { wo: "WO-4814" })];
  assert.deepEqual(
    (({ invoiceMoved, partLines }) => [invoiceMoved, partLines])(await mergeInstallsFor(sql, "u-owner", { keepId: k2, dropId: d2 })),
    [false, 0],
  );
});

test("Merge installs moves an approved invoice as it is, on the kept install's spelling; a window opened before approves nothing over it", async () => {
  const { pg, sql } = await fresh();
  const keep = await install(pg, { wo: "WO-4820" });
  // The same account written another way, which Merge installs allows.
  const drop = await install(pg, { wo: "WO-4821", customer: "Test Sushi Bayfront" });
  const second = { item: "Service : SERVICELABOR", description: "Second visit", qty: 0.25, rate: 150 };
  const approved = await approve(sql, drop, { lines: [LABOR, second], po: "PO-D1" });
  assert.deepEqual([approved.state, approved.total], ["approved", 337.5]);
  // An Admin opens the kept install's Invoice window while it has no invoice.
  const stale = await getInvoiceFor(sql, { type: "install", id: keep }, "u-owner");
  assert.deepEqual([stale.state, stale.version], ["none", null]);

  assert.equal((await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop })).invoiceMoved, true);
  const moved = await getInvoiceFor(sql, { type: "install", id: keep }, "u-owner");
  assert.deepEqual([moved.state, moved.approvedBy, moved.po, moved.total, moved.lines.length], ["approved", "boss", "PO-D1", 337.5, 2]);
  // Listed on the kept install's account, under its spelling, and not under the other one.
  assert.equal((await one(pg, "select customer from invoices where entity_type = 'install'")).customer, CAFE);
  assert.deepEqual((await listAccountInvoicesFor(sql, CAFE, "u-owner")).map((r) => [r.type, r.id, r.po, r.status]), [["install", keep, "PO-D1", "Approved"]]);
  assert.deepEqual(await listAccountInvoicesFor(sql, "Test Sushi Bayfront", "u-owner"), []);

  // The window opened before the merge approves nothing over it: its lines, total and P.O. stay.
  await assert.rejects(() => approve(sql, keep, { seen: stale.version, po: "" }), { message: CHANGED });
  const after = await getInvoiceFor(sql, { type: "install", id: keep }, "u-owner");
  assert.deepEqual([after.po, after.total, after.lines.length, after.version], ["PO-D1", 337.5, 2, moved.version]);
  // A window on the dropped install can't approve: it is archived.
  await assert.rejects(() => approve(sql, drop, { seen: approved.version }), { message: "That install is no longer on the list." });

  // Two windows open on the same invoice: the first approval goes through; the second approves nothing over it.
  const again = await approve(sql, keep, { seen: after.version, po: "PO-D2" });
  assert.deepEqual([again.po, again.total], ["PO-D2", 300]);
  await assert.rejects(() => approve(sql, keep, { seen: after.version, lines: [], po: "" }), { message: CHANGED });
  assert.deepEqual(
    (({ po, total }) => [po, total])(await getInvoiceFor(sql, { type: "install", id: keep }, "u-owner")),
    ["PO-D2", 300],
  );
});

test("a merge and an invoice saved at the same moment: the merge checks the invoices again as it writes, and an approval writes nothing on the archived install", async () => {
  const { pg, sql } = await fresh();
  // The database with `before` run just ahead of one statement (Merge installs' guarded one, after the reads that check
  // the invoices, unless another is named); `fail` stands in for the error Postgres raises when it lands after the
  // statement read them.
  const meanwhile = (before, fail = null, statement = "with lk as (") => {
    let fired = false;
    const query = async (text, params) => {
      if (!fired && text.includes(statement)) {
        fired = true;
        await before();
        if (fail) throw fail;
      }
      return sql.query(text, params);
    };
    return Object.assign(async (strings, ...values) => sql(strings, ...values), { query });
  };
  const keep = await install(pg, { wo: "WO-4830" });
  const drop = await install(pg, { wo: "WO-4831" });
  const keeperInvoice = () => pg.query("insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('install', $1, $2, 50, 'ana', now())", [keep, CAFE]);
  const noKeeperInvoice = () => pg.query("delete from invoices where entity_type = 'install' and entity_id = $1", [keep]);
  const clash = new Error('duplicate key value violates unique constraint "invoices_entity_key"');
  await approve(sql, drop);

  // Saved before the statement read the invoices: its guard writes nothing, and says why.
  await assert.rejects(() => mergeInstallsFor(meanwhile(keeperInvoice), "u-owner", { keepId: keep, dropId: drop }), { message: bothInvoices(drop, keep) });
  assert.equal((await one(pg, "select archived from installs where id = $1", [drop])).archived, false);
  assert.equal(Number((await one(pg, "select entity_id from invoices where entity_type = 'install' and total = 300")).entity_id), drop);
  // Saved after it read them (the unique key stops the statement): the same reason.
  await noKeeperInvoice();
  await assert.rejects(() => mergeInstallsFor(meanwhile(keeperInvoice, clash), "u-owner", { keepId: keep, dropId: drop }), { message: bothInvoices(drop, keep) });
  // With no lines on the dropped install's invoice it says to merge again, and merged again it goes ahead.
  await noKeeperInvoice();
  await approveOpened(sql, drop, { lines: [] });
  await assert.rejects(() => mergeInstallsFor(meanwhile(keeperInvoice, clash), "u-owner", { keepId: keep, dropId: drop }), {
    message: `An invoice was saved on install #${keep} while this merge ran, so nothing was merged. Merge again.`,
  });
  assert.equal((await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop })).invoiceMoved, false);
  assert.equal((await one(pg, "select archived from installs where id = $1", [drop])).archived, true);

  // A merge that lands between an approval's checks and its write, from a window on the dropped install: the invoice
  // went to the install kept, and nothing is put on the archived one.
  const [k3, d3] = [await install(pg, { wo: "WO-4832" }), await install(pg, { wo: "WO-4833" })];
  const d3Invoice = await approve(sql, d3, { po: "PO-D3" });
  const late = meanwhile(() => mergeInstallsFor(sql, "u-owner", { keepId: k3, dropId: d3 }), null, "with inv as (");
  await assert.rejects(() => approve(late, d3, { seen: d3Invoice.version, lines: [] }), { message: CHANGED });
  assert.deepEqual(
    (await pg.query("select entity_id, po from invoices where entity_type = 'install' and entity_id = any($1::int[])", [[k3, d3]])).rows.map((r) => [Number(r.entity_id), r.po]),
    [[k3, "PO-D3"]],
  );
});
