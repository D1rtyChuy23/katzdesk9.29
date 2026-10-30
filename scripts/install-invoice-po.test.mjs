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
  assert.equal((await approve(sql, id)).po, "PO-77");
  assert.equal((await approve(sql, id, { po: "" })).po, null);
  await assert.rejects(() => approve(sql, id, { po: "x".repeat(121) }), { message: "The P.O. is too long: 120 characters at most." });
  // The account's Invoices tab shows it, and a ticket's own P.O.
  await approve(sql, id, { po: "PO-78" });
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

test("Merge installs takes the dropped install's invoice, part lines and merged tickets to the one kept; both with an invoice is refused", async () => {
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

  // Both with an invoice: refused before anything is written.
  const other = await install(pg, { wo: "WO-4812" });
  await pg.query("insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('install', $1, $2, 50, 'boss', now())", [other, CAFE]);
  await assert.rejects(() => mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: other }), {
    message: `Install #${other} and install #${keep} both have an invoice, and one install takes one invoice. Move the lines onto one of them by hand, then merge.`,
  });
  assert.equal((await one(pg, "select archived from installs where id = $1", [other])).archived, false);
  // Neither has one: nothing to move.
  const [k2, d2] = [await install(pg, { wo: "WO-4813" }), await install(pg, { wo: "WO-4814" })];
  assert.deepEqual(
    (({ invoiceMoved, partLines }) => [invoiceMoved, partLines])(await mergeInstallsFor(sql, "u-owner", { keepId: k2, dropId: d2 })),
    [false, 0],
  );
});
