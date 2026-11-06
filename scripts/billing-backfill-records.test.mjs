// Billing Backfill (NetSuite) on installs and PMs (Grok's request through Chuy, 11/5): "Billing Backfill (NetSuite) only
// writes service and TLC tickets right now, so it skips every invoice on an install or PM card. Please extend it to
// installs and PMs." Matched on WO the same way; invoices and charge lines go on the install or PM and show on its
// panel; the Invoices page counts them; an invoice already on the card (a merged ticket's included) is never added
// twice; a mismatch is the invoice total against the card's charges (lines less the header discount, no tax);
// backfilled lines are billed and never in Export Billing; every row is will write, already there or skipped, with
// why and what it goes on; Admin only, preview first, each run logged. The eight WOs mirror Grok's 11/5 skips (three
// installs, five PMs, two invoices at $0) with made-up accounts, WOs and invoice numbers. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const bf = await import("../src/lib/ops/billing-backfill.ts");
const api = await import("../src/lib/ops/billing-backfill-api.ts");
const rec = await import("../src/lib/ops/record-billing-api.ts");
const report = await import("../src/lib/ops/billing-report-api.ts");
const { exportBillingFor } = await import("../src/lib/ops/charges-api.ts");
const { getInvoiceFor } = await import("../src/lib/ops/invoice-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role, email) values
       ('u-owner', 'chuy', true, true, 'admin', null),
       ('u-desk', 'dana', true, false, 'service', null),
       ('u-rep', 'riley', true, false, 'sales', 'riley@example.com')`,
  );
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('u-rep', 'Riley Rep', 'riley@example.com', true)`);
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}

const one = async (sql, text, params = []) => (await sql.query(text, params))[0];
const id = (r) => Number(r.id);

async function install(sql, o = {}) {
  return id(
    await one(
      sql,
      `insert into installs (customer, wo, received, completed_at, complete, equip_status, technician, archived, duplicate_of)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [o.customer ?? "Test Trattoria - Midtown", o.wo ?? null, o.received ?? "2026-10-01", o.completed ?? "2026-10-20", o.complete ?? true, o.status ?? "Installed", o.tech ?? "Test Tech", o.archived ?? false, o.duplicateOf ?? null],
    ),
  );
}
async function pm(sql, o = {}) {
  return id(
    await one(
      sql,
      `insert into pm_jobs (customer, wo, status, received, completed_at, technician, stacked_job_id)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [o.customer ?? "Test Coffee Co - Fulshear", o.wo ?? null, o.status ?? "Completed", o.received ?? "2026-10-01", o.completed ?? "2026-10-18", o.tech ?? "Test Tech", o.stacked ?? null],
    ),
  );
}
let calls = 0;
async function ticket(sql, o = {}) {
  calls += 1;
  return id(
    await one(
      sql,
      `insert into service_jobs (kind, call_id, customer, wo, status, technician, received, completed_at, ns_so)
       values ('service', $1, $2, $3, 'Completed', 'Test Tech', $4, $5, $6) returning id`,
      [`SC-NSR-${calls}`, o.customer ?? "Test Sushi - Bayfront", o.wo ?? null, o.received ?? "2026-10-01", o.completed ?? "2026-10-15", o.so ?? null],
    ),
  );
}

const csv = (rows) => rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(",")).join("\n") + "\n";
const file = (name, rows) => ({ name, base64: Buffer.from(csv(rows)).toString("base64") });
const CHARGES_HEAD = ["WO", "Source invoice #", "Source SO #", "PO", "NetSuite customer", "Location", "Item", "Item type", "Description", "Qty", "Rate", "Amount", "Discount Item", "Discount Amount", "Record total (after discount)"];
const INVOICES_HEAD = ["WO", "SO #", "SO status", "Invoice #", "Invoice date", "Invoice status", "Invoice total", "Amount remaining", "Charges source", "Corrigo net (reference)"];
const charge = (wo, inv, so, customer, item, qty, rate, discount = "", total = "") => [wo, inv, so, "", customer, "Houston - WH", item, "InvtPart", `${item} line`, String(qty), String(rate), String(qty * rate), discount ? "CLDSERVICE" : "", discount, total];
const invoice = (wo, so, inv, date, status, total, remaining = total, source = "Yes") => [wo, so, so ? "Billed" : "", inv, date, status, String(total), String(remaining), source, ""];
const preview = (sql, f, who = "u-owner") => api.previewBillingBackfillFor(sql, f, who);
const write = async (sql, f, skip = []) => api.applyBillingBackfillFor(sql, f, "u-owner", { hash: (await preview(sql, f)).hash, skip });
const byWo = (p) => Object.fromEntries(p.plans.map((x) => [x.wo, x]));
const nsInvoices = async (sql, where, param) =>
  (await sql.query(`select ns_invoice, status, total::text as total, amount_remaining::text as remaining, wo_key from record_ns_invoices where ${where} = $1 order by ns_invoice`, [param])).map(
    (r) => `${r.ns_invoice} ${r.status} ${r.total} ${r.remaining} ${r.wo_key}`,
  );

/** The eight WOs, shaped like Grok's 11/5 skips: three installs, five PMs, two invoices at $0. */
async function eight(sql) {
  const ids = {
    9995: await install(sql, { customer: "Test Trattoria - Midtown", wo: "WO-9995" }),
    9194: await pm(sql, { customer: "Test Coffee Co - Fulshear", wo: "WO-9194" }),
    9977: await install(sql, { customer: "Test Kolache #118 - Bay Road", wo: "WO-9977" }),
    9002: await pm(sql, { customer: "Test Common - Cityplace", wo: "WO-9002" }),
    9496: await pm(sql, { customer: "Test Wake Cafe", wo: "WO-9496" }),
    9990: await pm(sql, { customer: "Test Rock Coffee - Webster", wo: "WO-9990" }),
    1908: await install(sql, { customer: "Test Gelato Shop", wo: "WO-1908" }),
    1929: await pm(sql, { customer: "Test Taste Kitchen + Bar", wo: "WO-1929" }),
  };
  const f = [
    file("charges.csv", [
      CHARGES_HEAD,
      charge("WO-9995", "INV98380", "SO98380", "Test Trattoria - Midtown", "EQUIPMENT : TESTGRINDER", 1, 1000, "-50", "1250"),
      charge("WO-9995", "INV98380", "SO98380", "Test Trattoria - Midtown", "Service : INSTALLLABOR", 2, 150, "-50", "1250"),
      charge("WO-9194", "INV98387", "SO98387", "Test Coffee Co - Fulshear", "PM KITS : TESTKIT6", 1, 300),
      charge("WO-9977", "INV98439", "SO98439", "Test Kolache #118 - Bay Road", "EQUIPMENT : TESTWARRANTY", 1, 0),
      charge("WO-9002", "INV98793", "SO98793", "Test Common - Cityplace", "PM KITS : TESTKIT12", 1, 350),
      charge("WO-9002", "INV98793", "SO98793", "Test Common - Cityplace", "Service : TRIPCHARGE", 1, 100),
      charge("WO-9990", "INV98808", "SO98808", "Test Rock Coffee - Webster", "PM KITS : TESTKIT3", 1, 280),
      charge("WO-1908", "INV98820", "SO98820", "Test Gelato Shop", "EQUIPMENT : TESTCASE", 1, 2100),
      charge("WO-1929", "INV98838", "SO98838", "Test Taste Kitchen + Bar", "PM KITS : TESTKIT9", 1, 375),
    ]),
    file("invoices.csv", [
      INVOICES_HEAD,
      invoice("WO-9995", "SO98380", "INV98380", "10/28/2026", "Open", 1250),
      invoice("WO-9194", "SO98387", "INV98387", "10/28/2026", "Paid In Full", 300, 0),
      invoice("WO-9977", "SO98439", "INV98439", "10/30/2026", "Paid In Full", 0, 0),
      invoice("WO-9002", "SO98793", "INV98793", "11/02/2026", "Open", 450),
      invoice("WO-9496", "SO98796", "INV98796", "11/02/2026", "Paid In Full", 0, 0, ""),
      invoice("WO-9990", "SO98808", "INV98808", "11/03/2026", "Open", 280),
      invoice("WO-1908", "SO98820", "INV98820", "11/04/2026", "Open", 2100),
      invoice("WO-1929", "SO98838", "INV98838", "11/04/2026", "Open", 375),
    ]),
  ];
  return { ids, f };
}

test("the eight skipped WOs: each goes on its install or PM, with its invoice and NetSuite's lines; $0 invoices count; a second run finds them all there", async () => {
  const { sql } = await fresh();
  const { ids, f } = await eight(sql);
  const p = await preview(sql, f);
  const by = byWo(p);
  assert.deepEqual(
    p.plans.map((x) => [x.wo, x.status, x.kind, x.recordId, x.reason]),
    [
      ["WO-1908", "write", "install", ids[1908], null],
      ["WO-1929", "write", "pm", ids[1929], null],
      ["WO-9002", "write", "pm", ids[9002], null],
      ["WO-9194", "write", "pm", ids[9194], null],
      ["WO-9496", "write", "pm", ids[9496], null],
      ["WO-9977", "write", "install", ids[9977], null],
      ["WO-9990", "write", "pm", ids[9990], null],
      ["WO-9995", "write", "install", ids[9995], null],
    ],
  );
  assert.deepEqual(p.counts.byKind, { service: 0, tlc: 0, install: 3, pm: 5 });
  assert.deepEqual([p.counts.nsMismatch, p.counts.doubleBill, p.counts.skip], [0, 0, 0]);
  const big = by["WO-9995"];
  assert.equal(big.jobId, null, "never a ticket");
  assert.deepEqual(big.charges.next.map((l) => `${l.qty}x${l.rate} ${l.item}`), ["1x1000 EQUIPMENT : TESTGRINDER", "2x150 Service : INSTALLLABOR"]);
  assert.deepEqual([big.charges.nextDiscount, big.charges.nextNet], [{ kind: "amount", value: 50 }, 1250]);
  assert.deepEqual([big.so.next, big.so.billedOn], ["SO98380", "2026-10-28"]);
  assert.deepEqual([big.amounts.kd, big.amounts.kdSource, big.amounts.netsuite, big.amounts.nsMismatch], [1250, "netsuite", 1250, false]);
  assert.deepEqual(big.invoices.map((i) => [i.invoice, i.change]), [["INV98380", "new"]]);
  // The two at $0: a $0 line, or no lines at all; nothing to call a mismatch.
  for (const wo of ["WO-9977", "WO-9496"]) {
    assert.deepEqual([by[wo].amounts.kd, by[wo].amounts.netsuite, by[wo].amounts.nsMismatch, by[wo].invoices[0].total], [0, 0, false, 0], wo);
  }
  assert.deepEqual(by["WO-9977"].charges.next.map((l) => `${l.qty}x${l.rate}`), ["1x0"]);
  assert.equal(by["WO-9496"].charges.next, null);

  const done = await write(sql, f);
  assert.deepEqual(done.applied, { tickets: 0, installs: 3, pms: 5, lines: 9, invoices: 8 });
  assert.deepEqual(await nsInvoices(sql, "install_id", ids[9995]), ["INV98380 Open 1250.00 1250.00 9995"]);
  assert.deepEqual(await nsInvoices(sql, "pm_id", ids[9496]), ["INV98796 Paid In Full 0.00 0.00 9496"]);
  assert.deepEqual(await nsInvoices(sql, "install_id", ids[9977]), ["INV98439 Paid In Full 0.00 0.00 9977"]);
  const head = await one(
    sql,
    "select wo, wo_key, ns_so, to_char(billed_at at time zone 'America/Chicago', 'YYYY-MM-DD') as billed, discount_kind, discount_value::text as dv, updated_by from record_ns_billing where install_id = $1",
    [ids[9995]],
  );
  assert.deepEqual(head, { wo: "WO-9995", wo_key: "9995", ns_so: "SO98380", billed: "2026-10-28", discount_kind: "amount", dv: "50.00", updated_by: "chuy" });
  // Nothing on tickets, and the install's and PMs' own invoices in KatzDesk aren't touched.
  assert.deepEqual([(await one(sql, "select count(*)::int as n from ticket_charges")).n, (await one(sql, "select count(*)::int as n from ticket_invoices")).n, (await one(sql, "select count(*)::int as n from invoices")).n], [0, 0, 0]);
  // History on each record, and the run.
  assert.deepEqual(
    (await sql.query("select detail from activity where entity_type = 'install' and entity_id = $1", [ids[9995]])).map((r) => r.detail),
    ["Billing Backfill (NetSuite): NetSuite charges for WO-9995 2 lines $1300.00, discount $50.00 off, total $1250.00 · Sales Order SO98380 (billed 2026-10-28) · invoices: INV98380 new (Open $1250.00)"],
  );
  assert.equal((await one(sql, "select count(*)::int as n from activity where entity_type = 'pm'")).n, 5);
  const run = await one(sql, "select run_by, files, wos, written, counts->>'write' as w from billing_backfill_runs");
  assert.deepEqual([run.run_by, run.files, run.wos, run.written, run.w], ["chuy", "charges.csv, invoices.csv", 8, { tickets: 0, installs: 3, pms: 5, lines: 9, invoices: 8 }, "8"]);
  assert.deepEqual((await api.listBackfillRunsFor(sql, "u-owner")).map((r) => [r.by, r.wos, r.written]), [["chuy", 8, { tickets: 0, installs: 3, pms: 5, lines: 9, invoices: 8 }]]);

  // Run again: every WO is there already, nothing to write.
  const again = await preview(sql, f);
  assert.deepEqual(again.plans.map((x) => x.status), Array(8).fill("same"));
  assert.ok(again.plans.every((x) => x.invoices.every((i) => i.change === "same")));
  assert.equal(bf.BACKFILL_STATUS_LABEL.same, "Already There");
});

test("billed already: NetSuite's lines never reach Export Billing; the Invoices page lists installs and PMs and counts them", async () => {
  const { sql } = await fresh();
  const { ids, f } = await eight(sql);
  // A ticket with a charge, so the export has something; a completed install and PM nobody billed yet.
  const t = await ticket(sql, { wo: "WO-8100" });
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : TRIPCHARGE', 'Trip', 1, 150, 'trip', 1)", [t]);
  const lonelyInstall = await install(sql, { customer: "Test Unbilled Install", wo: "WO-8101" });
  const lonelyPm = await pm(sql, { customer: "Test Unbilled PM", wo: "WO-8102" });
  const pending = await install(sql, { customer: "Test Not Done Yet", wo: "WO-8103", complete: false, status: "Ready", completed: null });
  await write(sql, f);
  const exp = await exportBillingFor(sql, { from: "2026-01-01", to: "2026-12-31", includeBilled: true });
  assert.equal(exp.tickets, 1);
  assert.match(exp.csv, /TRIPCHARGE/);
  for (const item of ["TESTGRINDER", "INSTALLLABOR", "TESTKIT6", "TESTWARRANTY", "TESTKIT12", "TESTKIT3", "TESTCASE", "TESTKIT9"]) assert.doesNotMatch(exp.csv, new RegExp(item));

  const rows = (await report.invoicesReportFor(sql, "u-owner")).rows;
  const row = (board, recordId) => rows.find((r) => r.board === board && r.id === recordId);
  const big = row("install", ids[9995]);
  assert.deepEqual(
    [big.wo, big.callId, big.status, big.so, big.billedAt, big.chargeLines, big.chargeNet, big.liveTotal, big.mismatch, big.doubleBill, big.chargesFrom],
    ["WO-9995", `Install #${ids[9995]}`, "Completed", "SO98380", "2026-10-28", 2, 1250, 1250, false, false, "netsuite"],
  );
  assert.deepEqual(big.invoices.map((i) => [i.invoice, i.status, i.total]), [["INV98380", "Open", 1250]]);
  assert.deepEqual([row("pm", ids[9496]).liveTotal, row("pm", ids[9496]).chargeLines, row("pm", ids[9496]).mismatch, row("pm", ids[9496]).chargesFrom], [0, 0, false, undefined]);
  // The page's own counts (its cards' tests), across every board.
  const hasLive = (r) => r.invoices.some((i) => !/void/i.test(i.status));
  const counts = {
    invoiced: rows.filter(hasLive).length,
    noSo: rows.filter((r) => r.status.trim().toLowerCase() === "completed" && !r.so && !hasLive(r)).map((r) => `${r.board}:${r.id}`).sort(),
    mismatch: rows.filter((r) => r.mismatch).length,
  };
  assert.deepEqual(counts, { invoiced: 8, noSo: [`install:${lonelyInstall}`, `pm:${lonelyPm}`, `service:${t}`].sort(), mismatch: 0 });
  assert.equal(row("install", pending).status, "Ready", "an install not installed isn't Completed");
  // Tickets In Window reads the installs' and PMs' own invoices now.
  const win = await report.loadWindowRows(sql, ["install", "pm"]);
  assert.deepEqual(win.find((r) => r.board === "install" && r.id === ids[1908]).invoices.map((i) => i.invoice), ["INV98820"]);
  assert.deepEqual(win.find((r) => r.board === "pm" && r.id === ids[1929]).invoicedDates, ["2026-11-04"]);
  // The panel: NetSuite's lines per WO, its invoices, and where the charges come from.
  const panel = await rec.loadRecordBillingFor(sql, "u-desk", { type: "install", id: ids[9995] });
  assert.deepEqual(
    [panel.groups.map((g) => [g.wo, g.so, g.billedOn, g.lines.length, g.subtotal, g.off, g.net]), panel.invoices.map((i) => [i.invoice, i.wo]), panel.chargeSource, panel.mismatch],
    [[["WO-9995", "SO98380", "2026-10-28", 2, 1300, 50, 1250]], [["INV98380", "WO-9995"]], "netsuite", false],
  );
});

test("on the card already: an invoice on the install isn't added twice, and a merged ticket's billing stays the ticket's", async () => {
  const { sql } = await fresh();
  const CAFE = "Test Sushi - Bayfront";
  const inst = await install(sql, { customer: CAFE, wo: "WO-8792" });
  await sql.query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-8792', '8792', 'desk'), ($1, 'WO-8793', '8793', 'desk')", [inst]);
  // A ticket merged into the install as billed on SO8001 (as the merge leaves it, 10/30): its invoice is on it.
  const t = await ticket(sql, { customer: CAFE, wo: "WO-8792", so: "SO8001" });
  await sql.query("update service_jobs set duplicate_of = id, merged_install_id = $2 where id = $1", [t, inst]);
  await sql.query(
    `insert into ticket_install_merges (job_id, install_id, merged_by, moved) values ($1, $2, 'chuy', $3::jsonb)`,
    [t, inst, JSON.stringify({ billedOn: "SO8001", billedSo: "SO8001", billedLines: [{ item: "Service : SERVICELABOR", description: "Labor", qty: 1, rate: 500, kind: "labor" }], billedTotal: 500 })],
  );
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source) values ($1, 'INV8001', 'SO8001', '2026-10-20', 'Open', 500, 500, 'so')", [t]);
  const own = [
    file("charges.csv", [
      CHARGES_HEAD,
      charge("WO-8792", "INV8001", "SO8001", CAFE, "Service : SERVICELABOR", 1, 500),
      charge("WO-8792", "INV8500", "SO8500", CAFE, "EQUIPMENT : TESTBREWER", 1, 999),
    ]),
    file("invoices.csv", [INVOICES_HEAD, invoice("WO-8792", "SO8001", "INV8001", "2026-10-20", "Open", 500), invoice("WO-8792", "SO8500", "INV8500", "2026-10-25", "Open", 999)]),
  ];
  const p = (await preview(sql, own)).plans[0];
  assert.deepEqual([p.status, p.kind, p.recordId], ["write", "install", inst]);
  assert.deepEqual(
    p.invoices.map((i) => [i.invoice, i.change, i.note]),
    [
      ["INV8001", "elsewhere", `On the install's card already: ticket #${t}'s billing, carried over by its merge. Not counted twice.`],
      ["INV8500", "new", null],
    ],
  );
  assert.deepEqual(p.charges.next.map((l) => l.item), ["EQUIPMENT : TESTBREWER"], "the ticket's billed line stays off the install");
  assert.ok(p.warnings.includes(`1 charge line is ticket #${t}'s, billed already and carried over by its merge: left off the install.`), p.warnings.join(" | "));
  assert.deepEqual([p.amounts.kd, p.amounts.netsuite, p.amounts.nsMismatch], [999, 999, false]);
  await write(sql, own);
  assert.deepEqual(await nsInvoices(sql, "install_id", inst), ["INV8500 Open 999.00 999.00 8792"]);
  assert.deepEqual((await sql.query("select ns_invoice, status from ticket_invoices where job_id = $1", [t])).map((r) => [r.ns_invoice, r.status]), [["INV8001", "Open"]]);
  // The install's Invoice window still lists the ticket's as billed elsewhere.
  assert.deepEqual((await getInvoiceFor(sql, { type: "install", id: inst }, "u-owner")).billedElsewhere.map((b) => [b.so, b.invoices]), [["SO8001", "INV8001"]]);
  // Counted once on the Invoices page: INV8001 on the ticket's row only.
  const rows = (await report.invoicesReportFor(sql, "u-owner")).rows;
  assert.deepEqual(rows.find((r) => r.board === "install" && r.id === inst).invoices.map((i) => i.invoice), ["INV8500"]);
  assert.deepEqual(rows.find((r) => r.board === "service" && r.id === t).invoices.map((i) => i.invoice), ["INV8001"]);

  // NetSuite changed the ticket's since (Paid now): that row is the ticket's to take, in a file of its own.
  const changed = [file("invoices.csv", [INVOICES_HEAD, invoice("WO-8792", "SO8001", "INV8001", "2026-10-20", "Paid In Full", 500, 0), invoice("WO-8792", "SO8500", "INV8500", "2026-10-25", "Open", 999)])];
  assert.deepEqual(
    (await preview(sql, changed)).plans.map((x) => [x.status, x.reason]),
    [["skip", `INV8001 is ticket #${t}'s billing (merged into install #${inst} as billed), and NetSuite has changed it since. Put its rows in a file of their own and run that first, so it goes on the ticket; then run the rest.`]],
  );
  // Alone, it goes on the ticket (as before 11/5).
  const alone = (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-8792", "SO8001", "INV8001", "2026-10-20", "Paid In Full", 500, 0)])])).plans[0];
  assert.deepEqual([alone.kind, alone.jobId, alone.status], ["service", t, "invoices"]);

  // The install's own invoice paid since: refreshed where it is, never a second row, even listed under its other WO.
  const paid = [file("invoices.csv", [INVOICES_HEAD, invoice("WO-8793", "SO8500", "INV8500", "2026-10-25", "Paid In Full", 999, 0)])];
  const q = (await preview(sql, paid)).plans[0];
  assert.deepEqual([q.kind, q.recordId, q.status, q.invoices.map((i) => [i.invoice, i.change])], ["install", inst, "write", [["INV8500", "updated"]]]);
  await write(sql, paid);
  assert.deepEqual(await nsInvoices(sql, "install_id", inst), ["INV8500 Paid In Full 999.00 0.00 8792"], "still under the WO it came in on");
  assert.deepEqual((await preview(sql, paid)).plans.map((x) => x.status), ["same"]);
});

test("the checks: a mismatch against the PM's own invoice in KatzDesk, a possible double bill, the same invoice on another record", async () => {
  const { sql } = await fresh();
  // A PM KatzDesk billed at $400 on its own invoice; NetSuite invoiced $450.
  const p1 = await pm(sql, { customer: "Test Mismatch Cafe", wo: "WO-7301" });
  const inv = id(await one(sql, "insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('pm', $1, 'Test Mismatch Cafe', 400, 'chuy', now()) returning id", [p1]));
  await sql.query("insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort) values ($1, 'PM KITS : TESTKIT', 'Kit', 1, 400, 'part', 1)", [inv]);
  // An install whose $500 of lines NetSuite invoiced twice.
  const i2 = await install(sql, { customer: "Test Double Cafe", wo: "WO-7302" });
  // A ticket that has INV7399 already; a PM's WO lists it too.
  const t = await ticket(sql, { customer: "Test Other Cafe", wo: "WO-7310" });
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, invoice_date, status, total, amount_remaining, source) values ($1, 'INV7399', '2026-10-20', 'Open', 80, 80, 'standalone')", [t]);
  const p3 = await pm(sql, { customer: "Test Third Cafe", wo: "WO-7303" });
  const f = [
    file("charges.csv", [CHARGES_HEAD, charge("WO-7302", "INV7302", "SO7302", "Test Double Cafe", "EQUIPMENT : TESTMILL", 1, 500)]),
    file("invoices.csv", [
      INVOICES_HEAD,
      invoice("WO-7301", "SO7301", "INV7301", "2026-10-22", "Open", 450),
      invoice("WO-7302", "SO7302", "INV7302", "2026-10-22", "Open", 500),
      invoice("WO-7302", "SO7302", "INV7302B", "2026-10-23", "Open", 500, 500, ""),
      invoice("WO-7303", "", "INV7399", "2026-10-22", "Open", 80, 80, ""),
    ]),
  ];
  const by = byWo(await preview(sql, f));
  const mm = by["WO-7301"];
  assert.deepEqual([mm.amounts.kd, mm.amounts.kdSource, mm.amounts.netsuite, mm.amounts.nsMismatch], [400, "katzdesk", 450, true]);
  assert.ok(mm.warnings.includes("NetSuite's live invoices ($450.00) don't match the PM's own invoice in KatzDesk ($400.00)."), mm.warnings.join(" | "));
  const db = by["WO-7302"];
  assert.deepEqual([db.amounts.kd, db.amounts.netsuite, db.amounts.doubleBill], [500, 1000, true]);
  assert.ok(db.warnings.includes("Possible double bill: live invoices add up to $1000.00, the charges to $500.00."), db.warnings.join(" | "));
  assert.ok(by["WO-7303"].warnings.includes(`INV7399 is on ticket #${t} already. NetSuite billed both on one invoice, or the WO is wrong: check it in NetSuite.`), by["WO-7303"].warnings.join(" | "));
  await write(sql, f);
  const rows = (await report.invoicesReportFor(sql, "u-owner")).rows;
  const r1 = rows.find((r) => r.board === "pm" && r.id === p1);
  assert.deepEqual([r1.chargeNet, r1.chargesFrom, r1.liveTotal, r1.mismatch], [400, "katzdesk", 450, true]);
  const r2 = rows.find((r) => r.board === "install" && r.id === i2);
  assert.deepEqual([r2.chargeNet, r2.liveTotal, r2.doubleBill], [500, 1000, true]);
  assert.deepEqual([(await rec.loadRecordBillingFor(sql, "u-owner", { type: "pm", id: p1 })).mismatch, (await rec.loadRecordBillingFor(sql, "u-owner", { type: "pm", id: p3 })).invoices.map((i) => i.invoice)], [true, ["INV7399"]]);
  // KatzDesk's own invoice is never written over by NetSuite's.
  assert.deepEqual((await sql.query("select item, qty::text, rate::text from invoice_lines where invoice_id = $1", [inv])).map((r) => `${r.qty}x${r.rate} ${r.item}`), ["1.00x400.00 PM KITS : TESTKIT"]);
});

test("skips and picks: a stacked PM, an install off the board, a merged install's WO on the one kept, Walk-In; a ticket and an install by the invoice dates", async () => {
  const { sql } = await fresh();
  const host = await ticket(sql, { customer: "Test Host Cafe", wo: "WO-7400" });
  const stacked = await pm(sql, { customer: "Test Host Cafe", wo: "WO-7401", stacked: host });
  const gone = await install(sql, { customer: "Test Gone Cafe", wo: "WO-7402", archived: true });
  const kept = await install(sql, { customer: "Test Kept Cafe", wo: "WO-7499" });
  const dropped = await install(sql, { customer: "Test Kept Cafe", wo: "WO-7403", duplicateOf: kept });
  await sql.query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-7403', '7403', 'merge')", [kept]);
  const walkIn = await install(sql, { customer: "Walk - In", wo: "WO-7404" });
  // WO numbers started over in July 2026: an old ticket and a new install with one number.
  const old = await ticket(sql, { customer: "Test Old Cafe", wo: "WO-7405", received: "2025-02-01", completed: "2025-02-10" });
  const fresh2026 = await install(sql, { customer: "Test New Cafe", wo: "WO-7405", received: "2026-10-01", completed: "2026-10-20" });
  // A ticket and a PM in the same weeks: can't be told apart.
  const t2 = await ticket(sql, { customer: "Test Twin Cafe", wo: "WO-7406", received: "2026-10-01", completed: "2026-10-12" });
  const p2 = await pm(sql, { customer: "Test Twin Cafe", wo: "WO-7406", received: "2026-10-03", completed: "2026-10-15" });
  const f = [
    file("invoices.csv", [
      INVOICES_HEAD,
      invoice("WO-7401", "", "INV7401", "2026-10-20", "Open", 10, 10, ""),
      invoice("WO-7402", "", "INV7402", "2026-10-20", "Open", 10, 10, ""),
      invoice("WO-7403", "", "INV7403", "2026-10-20", "Open", 10, 10, ""),
      invoice("WO-7404", "", "INV7404", "2026-10-20", "Open", 10, 10, ""),
      invoice("WO-7405", "", "INV7405", "2026-10-25", "Open", 10, 10, ""),
      invoice("WO-7406", "", "INV7406", "2026-10-25", "Open", 10, 10, ""),
      invoice("WO-7407", "", "INV7407", "2026-10-25", "Open", 10, 10, ""),
    ]),
  ];
  const by = byWo(await preview(sql, f));
  const got = (wo) => [by[wo].status, by[wo].kind, by[wo].recordId, by[wo].reason];
  assert.deepEqual(got("WO-7401"), ["skip", null, null, `PM #${stacked} is stacked on ticket #${host} and bills on it: its NetSuite invoices go on that ticket. Skipped.`]);
  assert.deepEqual(got("WO-7402"), ["skip", null, null, `Install #${gone} was taken off the board. Skipped.`]);
  assert.deepEqual(got("WO-7403"), ["write", "install", kept, null], `not #${dropped}`);
  assert.deepEqual(got("WO-7404"), ["skip", "install", walkIn, "The install is on Walk-In, which is never a billing account. Give it the real account first."]);
  assert.deepEqual(got("WO-7405"), ["write", "install", fresh2026, null]);
  assert.deepEqual(got("WO-7406"), ["skip", null, null, `The WO is on ticket #${t2}, PM #${p2}. Can't tell which one NetSuite billed: the invoice dates fit more than one, or there are none.`]);
  assert.deepEqual(got("WO-7407"), ["skip", null, null, "No ticket, install or PM has this WO."]);
  // The old invoice under that number is the old ticket's.
  const before = (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-7405", "", "INV7000", "2025-02-15", "Paid In Full", 10, 0, "")])])).plans[0];
  assert.deepEqual([before.kind, before.jobId], ["service", old]);
  // Too far from the only record with the WO: as for a ticket.
  const far = (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-7499", "", "INV7999", "2028-06-01", "Open", 10, 10, "")])])).plans[0];
  assert.equal(far.reason, `INV7999 (2028-06-01) is too far from install #${kept} (came in 2026-10-01, done 2026-10-20), the only one with this WO, to be its billing: it may be another job with this WO number. Take its rows out of the file, then run it again.`);
});

test("one statement: a record changed since the preview stops it all; an invoice recorded or a PM stacked meanwhile too; unticked WOs stay out; Admin only", async () => {
  const { sql } = await fresh();
  const { ids, f } = await eight(sql);
  const p = await preview(sql, f);
  await sql.query("update installs set updated_at = now() + interval '1 minute' where id = $1", [ids[9995]]);
  await assert.rejects(() => api.applyBillingBackfillFor(sql, f, "u-owner", { hash: p.hash, skip: [] }), /Something changed since the preview/);
  assert.equal((await one(sql, "select count(*)::int as n from record_ns_invoices")).n, 0);

  // The statement itself, given a plan the records no longer fit: nothing written, no run logged.
  const fresh1 = await preview(sql, f);
  const plan = fresh1.plans.find((x) => x.wo === "WO-9194");
  const row = (o = {}) => ({ rtype: "pm", rid: plan.recordId, seen: plan.seen, locked: false, wo: plan.wo, wo_key: plan.key, write_charges: true, dk: null, dv: null, set_so: true, so: "SO1", billed_on: null, log: "x", ...o });
  const lines = JSON.stringify([{ rtype: "pm", rid: plan.recordId, wo_key: plan.key, item: "X", description: "", qty: 1, rate: 1, kind: "part", ord: 1 }]);
  const run = (r) => sql.query(api.APPLY_BACKFILL_SQL, ["[]", "[]", "[]", "chuy", JSON.stringify([r]), lines, "[]", JSON.stringify({ files: "x", wos: 1, counts: {} })]);
  assert.equal((await run(row({ seen: "2000-01-01 00:00:00+00" })))[0].go, false, "stale");
  await sql.query("insert into record_ns_invoices (pm_id, wo_key, ns_invoice, status, total) values ($1, $2, 'INV-MEANWHILE', 'Open', 1)", [plan.recordId, plan.key]);
  assert.equal((await run(row()))[0].go, false, "an invoice recorded meanwhile: no longer unlocked");
  await sql.query("delete from record_ns_invoices where ns_invoice = 'INV-MEANWHILE'");
  await sql.query("update pm_jobs set stacked_job_id = $2 where id = $1", [plan.recordId, await ticket(sql, { wo: "WO-0001" })]);
  assert.equal((await run(row()))[0].go, false, "stacked meanwhile");
  assert.deepEqual([(await one(sql, "select count(*)::int as n from record_ns_billing")).n, (await one(sql, "select count(*)::int as n from billing_backfill_runs")).n], [0, 0]);
  await sql.query("update pm_jobs set stacked_job_id = null where id = $1", [plan.recordId]);

  // Unticked: left out; the rest written in one go.
  const done = await write(sql, f, ["9995", "9194"]);
  assert.deepEqual([done.applied.installs, done.applied.pms], [2, 4]);
  assert.deepEqual(await nsInvoices(sql, "install_id", ids[9995]), []);
  assert.deepEqual(await nsInvoices(sql, "pm_id", ids[9194]), []);

  await assert.rejects(() => preview(sql, f, "u-desk"), /Only an Admin/);
  await assert.rejects(() => api.applyBillingBackfillFor(sql, f, "u-desk", { hash: p.hash, skip: [] }), /Only an Admin/);
  await assert.rejects(() => api.listBackfillRunsFor(sql, "u-desk"), /Only an Admin/);
});

test("an install with two WOs: each WO's NetSuite billing on its own; one invoice under both is written once, the other WO waits", async () => {
  const { sql } = await fresh();
  const CAFE = "Test Project Cafe";
  const inst = await install(sql, { customer: CAFE, wo: "WO-6001" });
  await sql.query("insert into install_work_orders (install_id, wo, match_key, source, received, completed_at) values ($1, 'WO-6001', '6001', 'desk', '2026-10-01', '2026-10-05'), ($1, 'WO-6002', '6002', 'desk', '2026-10-06', '2026-10-09')", [inst]);
  const f = [
    file("charges.csv", [CHARGES_HEAD, charge("WO-6001", "INV6001", "SO6001", CAFE, "EQUIPMENT : TESTBREWER", 1, 900), charge("WO-6002", "INV6002", "SO6002", CAFE, "Service : INSTALLLABOR", 3, 150)]),
    file("invoices.csv", [INVOICES_HEAD, invoice("WO-6001", "SO6001", "INV6001", "2026-10-10", "Open", 900), invoice("WO-6002", "SO6002", "INV6002", "2026-10-12", "Open", 450)]),
  ];
  const p = await preview(sql, f);
  assert.deepEqual(p.plans.map((x) => [x.wo, x.kind, x.recordId, x.status, x.charges.nextNet]), [["WO-6001", "install", inst, "write", 900], ["WO-6002", "install", inst, "write", 450]]);
  assert.deepEqual([p.plans[0].amounts.kd, p.plans[1].amounts.kd], [900, 450], "the other WO has nothing on it yet");
  await write(sql, f);
  assert.deepEqual(
    (await sql.query("select b.wo, b.ns_so, count(c.id)::int as lines from record_ns_billing b left join record_ns_charges c on c.billing_id = b.id where b.install_id = $1 group by b.id order by b.wo", [inst])).map((r) => [r.wo, r.ns_so, r.lines]),
    [["WO-6001", "SO6001", 1], ["WO-6002", "SO6002", 1]],
  );
  const row = (await report.invoicesReportFor(sql, "u-owner")).rows.find((r) => r.board === "install" && r.id === inst);
  assert.deepEqual([row.wo, row.so, row.chargeNet, row.liveTotal, row.mismatch], ["WO-6001, WO-6002", "SO6001, SO6002", 1350, 1350, false]);
  // A later file with WO-6001's charges changed: only WO-6001's lines are replaced... it's invoiced already, so kept.
  const relisted = [file("charges.csv", [CHARGES_HEAD, charge("WO-6001", "INV6001", "SO6001", CAFE, "EQUIPMENT : TESTBREWER", 2, 900)])];
  const r2 = (await preview(sql, relisted)).plans[0];
  assert.deepEqual([r2.status, r2.locked, r2.charges.next], ["same", true, null]);
  assert.ok(r2.warnings.includes(`Invoiced already (WO-6001), so NetSuite's charges on the install stay as they are.`), r2.warnings.join(" | "));
  // One NetSuite invoice under both WOs: written once; the second WO waits for a run of its own.
  const both = [file("invoices.csv", [INVOICES_HEAD, invoice("WO-6001", "SO6001", "INV6003", "2026-10-14", "Open", 10, 10, ""), invoice("WO-6002", "SO6002", "INV6003", "2026-10-14", "Open", 10, 10, "")])];
  assert.deepEqual(
    (await preview(sql, both)).plans.map((x) => [x.wo, x.status, x.reason]),
    [
      ["WO-6001", "invoices", null],
      ["WO-6002", "skip", `INV6003 is in the files under WO-6001 too, for the same install (#${inst}). Take WO-6002's rows out and run them on their own after this.`],
    ],
  );
  await write(sql, both);
  assert.deepEqual((await nsInvoices(sql, "install_id", inst)).filter((x) => x.startsWith("INV6003")), ["INV6003 Open 10.00 10.00 6001"]);
});

test("who sees it: anyone who opens the install; a sales rep a PM's only on their own accounts", async () => {
  const { sql } = await fresh();
  await sql.query("insert into directory_customers (name, account_rep) values ('Test Rep Cafe', 'Riley Rep'), ('Test Other Rep Cafe', 'Someone Else')");
  const mine = await pm(sql, { customer: "Test Rep Cafe", wo: "WO-5001" });
  const theirs = await pm(sql, { customer: "Test Other Rep Cafe", wo: "WO-5002" });
  const inst = await install(sql, { customer: "Test Other Rep Cafe", wo: "WO-5003" });
  assert.equal((await rec.loadRecordBillingFor(sql, "u-rep", { type: "pm", id: mine })).type, "pm");
  await assert.rejects(() => rec.loadRecordBillingFor(sql, "u-rep", { type: "pm", id: theirs }), /no longer on the list/);
  assert.equal((await rec.loadRecordBillingFor(sql, "u-rep", { type: "install", id: inst })).type, "install");
  await sql.query("update installs set archived = true where id = $1", [inst]);
  await assert.rejects(() => rec.loadRecordBillingFor(sql, "u-desk", { type: "install", id: inst }), /no longer on the list/);
  const host = await ticket(sql, { wo: "WO-5004" });
  await sql.query("update pm_jobs set stacked_job_id = $2 where id = $1", [mine, host]);
  assert.equal((await rec.loadRecordBillingFor(sql, "u-desk", { type: "pm", id: mine })).stackedOn, host);
  // The Invoices page leaves out a stacked PM (its billing is the ticket's) and an install off the board.
  const rows = (await report.invoicesReportFor(sql, "u-owner")).rows;
  assert.deepEqual([rows.some((r) => r.board === "pm" && r.id === mine), rows.some((r) => r.board === "install" && r.id === inst), rows.some((r) => r.board === "pm" && r.id === theirs)], [false, false, true]);
  assert.equal((await report.invoicesReportFor(sql, "u-desk")).forbidden, true);
});

test("0116: one record per row, the WO's billing once, the discount's rule, the record key", async () => {
  const { sql } = await fresh();
  const i = await install(sql, { wo: "WO-4001" });
  const p = await pm(sql, { wo: "WO-4002" });
  await assert.rejects(() => sql.query("insert into record_ns_billing (install_id, pm_id, wo, wo_key) values ($1, $2, 'WO-4001', '4001')", [i, p]), /record_ns_billing_one_record/);
  await assert.rejects(() => sql.query("insert into record_ns_billing (wo, wo_key) values ('WO-4001', '4001')"), /record_ns_billing_one_record/);
  await assert.rejects(() => sql.query("insert into record_ns_billing (install_id, wo, wo_key, discount_kind, discount_value) values ($1, 'WO-4001', '4001', 'amount', 0)", [i]), /record_ns_billing_discount_check/);
  await sql.query("insert into record_ns_billing (install_id, wo, wo_key) values ($1, 'WO-4001', '4001')", [i]);
  await assert.rejects(() => sql.query("insert into record_ns_billing (install_id, wo, wo_key) values ($1, 'WO 4001', '4001')", [i]), /record_ns_billing_wo_uidx/);
  await sql.query("insert into record_ns_billing (pm_id, wo, wo_key) values ($1, 'WO-4001', '4001')", [p]);
  assert.deepEqual((await sql.query("select record_key from record_ns_billing order by id")).map((r) => r.record_key), [`install:${i}`, `pm:${p}`]);
  await sql.query("insert into record_ns_invoices (install_id, ns_invoice, status) values ($1, 'INV1', 'Open')", [i]);
  await assert.rejects(() => sql.query("insert into record_ns_invoices (install_id, ns_invoice, status) values ($1, ' inv1 ', 'Open')", [i]), /record_ns_invoices_uidx/);
  await sql.query("insert into record_ns_invoices (pm_id, ns_invoice, status) values ($1, 'INV1', 'Open')", [p]);
  await assert.rejects(() => sql.query("insert into record_ns_charges (billing_id, item, qty, rate) values ((select min(id) from record_ns_billing), 'X', 0, 1)"), /check/);
  // A record removed takes its NetSuite billing with it.
  await sql.query("delete from pm_jobs where id = $1", [p]);
  assert.deepEqual([(await one(sql, "select count(*)::int as n from record_ns_billing where pm_id is not null")).n, (await one(sql, "select count(*)::int as n from record_ns_invoices where pm_id is not null")).n], [0, 0]);
  // It only creates: no statement changes or removes anything that exists.
  const statements = src("migrations/0116_install_pm_netsuite_billing.sql").replace(/--[^\n]*/g, "").split(";").map((s) => s.trim()).filter(Boolean);
  assert.deepEqual([...new Set(statements.map((s) => s.split(/\s+/).slice(0, 2).join(" ").toLowerCase()))].sort(), ["create index", "create table", "create unique"]);
});

test("the screens: the install's and PM's Invoices tab, the Invoices page's boards, the backfill's record types, outcomes and past runs (source)", () => {
  const sheets = src("src/components/desk/entity-sheets.tsx");
  assert.match(sheets, /<InvoiceButton type="pm"[^\n]+\n\s+<\/div>\n\s+<RecordNetSuitePanel type="pm" id=\{pm\.id\}/);
  assert.match(sheets, /<InvoiceButton type="install"[^\n]+\n\s+<\/div>\n\s+<RecordNetSuitePanel type="install" id=\{row\.id\}/);
  const panel = src("src/components/desk/record-netsuite.tsx");
  assert.match(panel, /Billed in NetSuite · \{g\.wo\}/);
  assert.match(panel, /never in Export Billing/);
  assert.match(panel, /queryKey: \["record-billing", type, id\]/);
  assert.match(panel, /is stacked on ticket #\{b\.stackedOn\}/);
  const page = src("src/routes/_app/invoices.tsx");
  assert.match(page, /boards=\{\["service", "tlc", "pm", "install"\]\}/);
  assert.match(page, /\{rows\.length\} of \{all\.length\} records/);
  assert.match(page, /its invoice in KatzDesk/);
  const dialog = src("src/components/desk/billing-backfill.tsx");
  assert.match(dialog, /BACKFILL_KIND_LABEL\[p\.kind\]/);
  assert.match(dialog, /<InvoiceOutcome i=\{i\} \/>/);
  assert.match(dialog, /"already there"/);
  assert.match(dialog, /<PastRuns runs=\{runs\.data\}/);
  assert.match(dialog, /"record-billing",/);
  assert.match(dialog, /Untick a WO to leave it out\./);
  assert.deepEqual(bf.BACKFILL_KIND_LABEL, { service: "Ticket", tlc: "TLC", install: "Install", pm: "PM" });
  assert.deepEqual(bf.BACKFILL_STATUS_LABEL, { write: "Will Write", invoices: "Will Write: Invoices Only", same: "Already There", skip: "Skipped" });
});
