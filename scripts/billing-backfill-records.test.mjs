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
  assert.deepEqual(again.plans.flatMap((x) => x.warnings), [], "an invoice on the record itself is never on another one");
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
  assert.deepEqual([p.so.next, p.so.billedOn], ["SO8500", "2026-10-25"], "its own SO, not the ticket's");
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
  assert.deepEqual(got("WO-7401"), ["skip", null, null, `PM #${stacked} is stacked on ticket #${host} and bills on it: its billing is the ticket's. Skipped.`]);
  assert.deepEqual(got("WO-7402"), ["skip", null, null, `Install #${gone} was taken off the board. Skipped.`]);
  assert.deepEqual(got("WO-7403"), ["write", "install", kept, null], `not #${dropped}`);
  assert.deepEqual(got("WO-7404"), ["skip", "install", walkIn, "The install is on Walk-In, which is never a billing account. Give it the real account first."]);
  assert.deepEqual(got("WO-7405"), ["write", "install", fresh2026, null]);
  assert.deepEqual(got("WO-7406"), ["skip", null, null, `The WO is on ticket #${t2}, PM #${p2}, and the invoice date (2026-10-25) fits each of them, so the Backfill can't tell which one NetSuite billed. Skipped.`]);
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
  await sql.query("update pm_jobs set stacked_job_id = $2 where id = $1", [plan.recordId, await ticket(sql, { wo: "WO-0001" })]);
  assert.equal((await run(row({ seen: (await one(sql, "select updated_at::text as u from pm_jobs where id = $1", [plan.recordId])).u })))[0].go, false, "stacked meanwhile");
  assert.deepEqual([(await one(sql, "select count(*)::int as n from record_ns_billing")).n, (await one(sql, "select count(*)::int as n from billing_backfill_runs")).n], [0, 0]);
  await sql.query("update pm_jobs set stacked_job_id = null where id = $1", [plan.recordId]);
  // An invoice already on it doesn't: an install's or a PM's NetSuite lines are never locked (11/5 review), and a Write
  // that put it there touched the record, which the check above catches.
  await sql.query("insert into record_ns_invoices (pm_id, wo_key, ns_invoice, status, total) values ($1, $2, 'INV-MEANWHILE', 'Open', 1)", [plan.recordId, plan.key]);
  const unlocked = (await run(row({ seen: (await one(sql, "select updated_at::text as u from pm_jobs where id = $1", [plan.recordId])).u })))[0];
  assert.deepEqual([unlocked.go, unlocked.record_lines, unlocked.pms], [true, 1, 1]);
  await sql.query("delete from record_ns_invoices where ns_invoice = 'INV-MEANWHILE'");
  await sql.query("delete from record_ns_billing where pm_id = $1", [plan.recordId]);

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
  // The install's checks are all its WOs together (11/5 review): each plan counts the other WO's lines and invoices too.
  assert.deepEqual(p.plans.map((x) => [x.amounts.kd, x.amounts.netsuite, x.amounts.nsMismatch, x.warnings]), [[1350, 1350, false, []], [1350, 1350, false, []]]);
  await write(sql, f);
  assert.deepEqual(
    (await sql.query("select b.wo, b.ns_so, count(c.id)::int as lines from record_ns_billing b left join record_ns_charges c on c.billing_id = b.id where b.install_id = $1 group by b.id order by b.wo", [inst])).map((r) => [r.wo, r.ns_so, r.lines]),
    [["WO-6001", "SO6001", 1], ["WO-6002", "SO6002", 1]],
  );
  const row = (await report.invoicesReportFor(sql, "u-owner")).rows.find((r) => r.board === "install" && r.id === inst);
  assert.deepEqual([row.wo, row.so, row.chargeNet, row.liveTotal, row.mismatch], ["WO-6001, WO-6002", "SO6001, SO6002", 1350, 1350, false]);
  // A later file with WO-6001's charges changed: NetSuite's lines are never locked (11/5 review), so WO-6001's are
  // replaced, WO-6002's kept, and the SO and billed date stay. The checks count WO-6002's lines and both invoices.
  const relisted = [file("charges.csv", [CHARGES_HEAD, charge("WO-6001", "INV6001", "SO6001", CAFE, "EQUIPMENT : TESTBREWER", 2, 900)])];
  const r2 = (await preview(sql, relisted)).plans[0];
  assert.deepEqual([r2.status, r2.locked, r2.charges.next.map((l) => `${l.qty}x${l.rate}`), r2.so.change, r2.so.billedOn], ["write", false, ["2x900"], false, "2026-10-10"]);
  assert.deepEqual([r2.amounts.kd, r2.amounts.netsuite, r2.amounts.nsMismatch], [2250, 1350, true]);
  assert.ok(r2.warnings.includes("NetSuite's live invoices ($1350.00) don't match the charges ($2250.00)."), r2.warnings.join(" | "));
  await write(sql, relisted);
  assert.deepEqual(
    (await sql.query("select b.wo, b.ns_so, to_char(b.billed_at at time zone 'America/Chicago', 'YYYY-MM-DD') as billed, string_agg(c.qty::text || 'x' || c.rate::text, ', ') as lines from record_ns_billing b left join record_ns_charges c on c.billing_id = b.id where b.install_id = $1 group by b.id order by b.wo", [inst])).map((r) => [r.wo, r.ns_so, r.billed, r.lines]),
    [["WO-6001", "SO6001", "2026-10-10", "2.00x900.00"], ["WO-6002", "SO6002", "2026-10-12", "3.00x150.00"]],
  );
  // One NetSuite invoice under both WOs: written once; the second WO waits for a run of its own.
  const both = [file("invoices.csv", [INVOICES_HEAD, invoice("WO-6001", "SO6001", "INV6003", "2026-10-14", "Open", 10, 10, ""), invoice("WO-6002", "SO6002", "INV6003", "2026-10-14", "Open", 10, 10, "")])];
  assert.deepEqual(
    (await preview(sql, both)).plans.map((x) => [x.wo, x.status, x.reason]),
    [
      ["WO-6001", "write", null],
      ["WO-6002", "skip", `INV6003 is in the files under WO-6001 too, for the same install (#${inst}). Take WO-6002's rows out and run them on their own after this.`],
    ],
  );
  // A later invoice alone doesn't move the WO's billed date: still the first it was billed on.
  assert.deepEqual(((x) => [x.so.change, x.so.billedOn])((await preview(sql, both)).plans[0]), [false, "2026-10-10"]);
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
  // The stacking guard is its own file (11/5 re-review): a database that ran 0116 before it was added gets it too.
  const guard = src("migrations/0117_pm_netsuite_billed.sql").replace(/--[^\n]*/g, "").trim();
  assert.match(guard, /^create or replace function pm_netsuite_billed\(pm int\) returns boolean language sql volatile as \$\$/);
  assert.equal(guard.split("$$").length, 3, "one function, nothing else");
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
  assert.match(panel, /No charges on this \{what\} to check the invoices against/);
  assert.match(panel, /b\.chargeSource === "none"/);
  const page = src("src/routes/_app/invoices.tsx");
  assert.match(page, /boards=\{\["service", "tlc", "pm", "install"\]\}/);
  assert.match(page, /\{rows\.length\} of \{all\.length\} records/);
  assert.match(page, /its invoice in KatzDesk/);
  assert.match(page, /hint="No SO or NetSuite invoice in KatzDesk yet"/);
  assert.match(page, /What each ticket, install and PM billed in NetSuite/);
  assert.match(src("src/components/desk/install-project-fields.tsx"), /res\.netsuiteWos \|\| res\.netsuiteInvoices \? ", its NetSuite billing" : ""/);
  // A ticket, an install and a PM can share an id: each row's key is its board and id.
  assert.match(page, /<InvoiceRow key=\{`\$\{r\.board\}:\$\{r\.id\}`\} r=\{r\} \/>/);
  assert.doesNotMatch(page, /key=\{r\.id\}/);
  const dialog = src("src/components/desk/billing-backfill.tsx");
  assert.match(dialog, /BACKFILL_KIND_LABEL\[p\.kind\]/);
  assert.match(dialog, /<InvoiceOutcome i=\{i\} \/>/);
  assert.match(dialog, /"already there"/);
  assert.match(dialog, /<PastRuns runs=\{runs\.data\}/);
  assert.match(dialog, /"record-billing",/);
  assert.match(dialog, /Untick a WO to leave it out\./);
  assert.match(dialog, /p\.amounts\.kdSource === "none"\s*\? "No charges to check"/);
  assert.deepEqual(bf.BACKFILL_KIND_LABEL, { service: "Ticket", tlc: "TLC", install: "Install", pm: "PM" });
  assert.deepEqual(bf.BACKFILL_STATUS_LABEL, { write: "Will Write", invoices: "Will Write: Invoices Only", same: "Already There", skip: "Skipped" });
});

test("edges: the billed ticket's own install takes the WO's other rows; an empty own invoice isn't the charges; one install under two spellings of its WO", async () => {
  const { sql } = await fresh();
  const CAFE = "Test Edge Cafe";
  // Two installs carry WO-6201 (numbers started over in July 2026): an old one, and the one the billed ticket went into.
  const first = await install(sql, { customer: CAFE, wo: "WO-6201", received: "2025-03-01", completed: "2025-03-10" });
  const second = await install(sql, { customer: CAFE, wo: "WO-6201" });
  const t = await ticket(sql, { customer: CAFE, wo: "WO-6201", so: "SO6201" });
  await sql.query("update service_jobs set duplicate_of = id, merged_install_id = $2 where id = $1", [t, second]);
  await sql.query("insert into ticket_install_merges (job_id, install_id, moved) values ($1, $2, $3::jsonb)", [t, second, JSON.stringify({ billedOn: "SO6201", billedSo: "SO6201", billedTotal: 100 })]);
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source) values ($1, 'INV6201', 'SO6201', '2026-10-20', 'Open', 100, 100, 'so')", [t]);
  const mixed = [file("invoices.csv", [INVOICES_HEAD, invoice("WO-6201", "SO6201", "INV6201", "2026-10-20", "Open", 100), invoice("WO-6201", "SO6299", "INV6299", "2026-10-22", "Open", 40)])];
  const p = (await preview(sql, mixed)).plans[0];
  assert.deepEqual([p.kind, p.recordId, p.status], ["install", second, "write"], `not #${first}`);

  // A PM with an invoice row in KatzDesk but no lines on it: NetSuite's lines are the charges.
  const empty = await pm(sql, { customer: CAFE, wo: "WO-6202" });
  await sql.query("insert into invoices (entity_type, entity_id, customer, total) values ('pm', $1, $2, 0)", [empty, CAFE]);
  const f = [
    file("charges.csv", [CHARGES_HEAD, charge("WO-6202", "INV6202", "SO6202", CAFE, "PM KITS : TESTKIT", 1, 120)]),
    file("invoices.csv", [INVOICES_HEAD, invoice("WO-6202", "SO6202", "INV6202", "2026-10-21", "Open", 120)]),
  ];
  const q = (await preview(sql, f)).plans[0];
  assert.deepEqual([q.amounts.kdSource, q.amounts.kd, q.amounts.nsMismatch], ["netsuite", 120, false]);

  // An install whose own WO and WO row are spelled differently is one install, not two.
  const spelled = await install(sql, { customer: CAFE, wo: "WO 6203" });
  await sql.query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-6203', '6203', 'desk')", [spelled]);
  const one6203 = (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-6203", "", "INV6203", "2026-10-21", "Open", 5, 5, "")])])).plans[0];
  assert.deepEqual([one6203.status, one6203.kind, one6203.recordId], ["write", "install", spelled]);

  // A ticket and an install with one WO, the invoice dated far from both: it fits none of them.
  const oldT = await ticket(sql, { customer: CAFE, wo: "WO-6204", received: "2025-01-02", completed: "2025-01-05" });
  const newI = await install(sql, { customer: CAFE, wo: "WO-6204", received: "2026-10-01", completed: "2026-10-03" });
  const far = (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-6204", "", "INV6204", "2028-01-15", "Open", 5, 5, "")])])).plans[0];
  assert.equal(far.reason, `The WO is on ticket #${oldT}, install #${newI}, and the invoice date (2028-01-15) fits none of them (by when each came in and was done). Skipped.`);
});

test("writes: a charges-only run keeps the WO's SO; one WO's lines replaced, the other's kept; the record touched; a merged install off the Invoices page", async () => {
  const { sql } = await fresh();
  const CAFE = "Test Rewrite Cafe";
  const inst = await install(sql, { customer: CAFE, wo: "WO-6301" });
  await sql.query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-6301', '6301', 'desk'), ($1, 'WO-6302', '6302', 'desk')", [inst]);
  // Not invoiced yet: an SO with no invoice, and lines, for both WOs.
  const first = [
    file("charges.csv", [CHARGES_HEAD, charge("WO-6301", "", "SO6301", CAFE, "EQUIPMENT : TESTA", 1, 100), charge("WO-6302", "", "SO6302", CAFE, "EQUIPMENT : TESTB", 1, 200)]),
    file("invoices.csv", [INVOICES_HEAD, ["WO-6301", "SO6301", "Pending Billing", "", "", "", "", "", "", ""], ["WO-6302", "SO6302", "Pending Billing", "", "", "", "", "", "", ""]]),
  ];
  const seen = (await one(sql, "select updated_at::text as u from installs where id = $1", [inst])).u;
  await write(sql, first);
  assert.notEqual((await one(sql, "select updated_at::text as u from installs where id = $1", [inst])).u, seen, "touched, so a save waiting on it sees the change");
  // WO-6301's lines change (charges file only, no SO in it): its SO stays, WO-6302's lines stay.
  const again = [file("charges.csv", [CHARGES_HEAD, [...charge("WO-6301", "", "", CAFE, "EQUIPMENT : TESTA", 3, 100)]])];
  const p = (await preview(sql, again)).plans[0];
  assert.deepEqual([p.status, p.so.change, p.charges.change], ["write", false, true]);
  await write(sql, again);
  const heads = await sql.query(
    "select b.wo, b.ns_so, string_agg(c.qty::text || 'x' || c.item, ', ' order by c.id) as lines from record_ns_billing b left join record_ns_charges c on c.billing_id = b.id where b.install_id = $1 group by b.id order by b.wo",
    [inst],
  );
  assert.deepEqual(heads.map((h) => [h.wo, h.ns_so, h.lines]), [["WO-6301", "SO6301", "3.00xEQUIPMENT : TESTA"], ["WO-6302", "SO6302", "1.00xEQUIPMENT : TESTB"]]);
  // The Invoices page: SO, no invoice; a merged install isn't a row.
  const dropped = await install(sql, { customer: CAFE, wo: "WO-6399", duplicateOf: inst });
  const rows = (await report.invoicesReportFor(sql, "u-owner")).rows;
  const r = rows.find((x) => x.board === "install" && x.id === inst);
  assert.deepEqual([r.so, r.invoices.length, r.chargeNet], ["SO6301, SO6302", 0, 500]);
  assert.equal(rows.some((x) => x.board === "install" && x.id === dropped), false);
});

test("picks (11/5 review): beside a billed merged ticket's own rows, the install's go through the same checks; a ticket by the closer date; no date, the live ticket keeps it", async () => {
  const { sql } = await fresh();
  const CAFE = "Test Home Cafe";
  const inst = await install(sql, { customer: CAFE, wo: "WO-4792", received: "2026-10-01", completed: "2026-10-20" });
  const t1 = await ticket(sql, { customer: CAFE, wo: "WO-4792", so: "SO4001", received: "2026-10-01", completed: "2026-10-10" });
  await sql.query("update service_jobs set duplicate_of = id, merged_install_id = $2 where id = $1", [t1, inst]);
  await sql.query("insert into ticket_install_merges (job_id, install_id, merged_by, moved) values ($1, $2, 'chuy', $3::jsonb)", [t1, inst, JSON.stringify({ billedOn: "SO4001", billedSo: "SO4001", billedTotal: 200 })]);
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source) values ($1, 'INV4001', 'SO4001', '2026-10-12', 'Open', 200, 200, 'so')", [t1]);
  const own = invoice("WO-4792", "SO4001", "INV4001", "2026-10-12", "Open", 200);
  const first = async (rows) => (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, ...rows])])).plans[0];

  // A live ticket with the WO in the same weeks: an invoice on another SO fits it and the install both, alone or
  // beside the merged ticket's own row.
  const t2 = await ticket(sql, { customer: CAFE, wo: "WO-4792", received: "2026-10-02", completed: "2026-10-16" });
  const other = invoice("WO-4792", "SO4002", "INV4002", "2026-10-20", "Open", 300);
  const both = `The WO is on ticket #${t2}, install #${inst}, and the invoice date (2026-10-20) fits each of them, so the Backfill can't tell which one NetSuite billed. Skipped. If the ticket is the install's work, merge it into the install first (Merge into install), then run it again.`;
  assert.deepEqual(((p) => [p.status, p.reason])(await first([other])), ["skip", both]);
  assert.deepEqual(((p) => [p.status, p.kind, p.reason])(await first([own, other])), ["skip", null, both], "not the install just because the merged ticket's row came too");
  // No date on the other rows: nothing tells the install from the live ticket.
  const undated = await preview(sql, [file("charges.csv", [CHARGES_HEAD, charge("WO-4792", "", "SO4009", CAFE, "EQUIPMENT : TESTX", 1, 50)]), file("invoices.csv", [INVOICES_HEAD, own])]);
  assert.equal(
    undated.plans[0].reason,
    `The rows beside ticket #${t1}'s own billing have no invoice date to tell install #${inst} (where the ticket was merged as billed) from ticket #${t2}. Run them with their NetSuite invoices, so the invoice dates can tell, or merge the other ticket into the install if it's the same job. Skipped.`,
  );
  // Those rows on their own: the install has this WO's billing (the merged ticket's), so the live ticket doesn't take them.
  const alone = (await preview(sql, [file("charges.csv", [CHARGES_HEAD, charge("WO-4792", "", "SO4009", CAFE, "EQUIPMENT : TESTX", 1, 50)])])).plans[0];
  assert.deepEqual(
    [alone.status, alone.reason],
    ["skip", `The WO is on ticket #${t2}, install #${inst}, and the files have no invoice date to tell them apart (install #${inst} has NetSuite billing for it already). Skipped.`],
  );
  await sql.query("delete from service_jobs where id = $1", [t2]);
  // The install the only record left, the invoice years off: too far, alone or beside the ticket's row.
  const far = invoice("WO-4792", "SO4003", "INV4003", "2028-06-01", "Open", 90);
  const farReason = `INV4003 (2028-06-01) is too far from install #${inst} (came in 2026-10-01, done 2026-10-20), the only one with this WO, to be its billing: it may be another job with this WO number. Take its rows out of the file, then run it again.`;
  assert.equal((await first([far])).reason, farReason);
  assert.equal((await first([own, far])).reason, farReason);
  // One that fits: the install takes it, and the ticket's counts as on its card.
  const fitsRows = [own, invoice("WO-4792", "SO4004", "INV4004", "2026-10-25", "Open", 300)];
  const fits = await first(fitsRows);
  assert.deepEqual([fits.status, fits.kind, fits.recordId, fits.invoices.map((i) => [i.invoice, i.change])], ["write", "install", inst, [["INV4001", "elsewhere"], ["INV4004", "new"]]]);
  // Written, then a live ticket with the WO again: the install's own rows, undated beside the merged ticket's, are
  // recorded on it already, so they're its (a rerun).
  await write(sql, [file("invoices.csv", [INVOICES_HEAD, ...fitsRows])]);
  const t3 = await ticket(sql, { customer: CAFE, wo: "WO-4792", received: "2026-10-02", completed: "2026-10-16" });
  const again = await preview(sql, [file("charges.csv", [CHARGES_HEAD, charge("WO-4792", "INV4004", "SO4004", CAFE, "EQUIPMENT : TESTX", 1, 300)]), file("invoices.csv", [INVOICES_HEAD, own])]);
  assert.deepEqual([again.plans[0].kind, again.plans[0].recordId, again.plans[0].reason], ["install", inst, null], `not ticket #${t3}`);
  await sql.query("delete from service_jobs where id = $1", [t3]);

  // WO numbers started over in July 2026: an old PM and a new ticket with one number. An invoice days after the ticket
  // is the ticket's, though it's inside the PM's year too (11/5 review).
  const oldPm = await pm(sql, { customer: "Test Old PM Cafe", wo: "WO-7501", received: "2025-11-20", completed: "2025-12-01" });
  const newT = await ticket(sql, { customer: "Test New Ticket Cafe", wo: "WO-7501", received: "2026-10-05", completed: "2026-10-15" });
  const close = await first([invoice("WO-7501", "", "INV7501", "2026-10-20", "Open", 50, 50, "")]);
  assert.deepEqual([close.kind, close.jobId, close.status, close.warnings.filter((w) => /carries this WO/.test(w))], ["service", newT, "write", []], `not PM #${oldPm}`);
  // Billed again 47 days after the ticket was done: still the ticket's (the PM is a year off), alone or with the first.
  const oldPm2 = await pm(sql, { customer: "Test Old PM Cafe", wo: "WO-0612", received: "2025-11-03", completed: "2025-12-01" });
  const newT2 = await ticket(sql, { customer: "Test New Ticket Cafe", wo: "WO-0612", received: "2026-10-05", completed: "2026-10-14" });
  const firstBill = invoice("WO-0612", "SO0612", "INV0612", "2026-10-20", "Open", 150);
  const rebill = invoice("WO-0612", "SO0613", "INV0613", "2026-11-30", "Open", 40);
  for (const rows of [[firstBill], [rebill], [firstBill, rebill]]) {
    assert.deepEqual(((x) => [x.kind, x.jobId, x.status])(await first(rows)), ["service", newT2, "write"], `${rows.map((r) => r[3]).join(" + ")}, not PM #${oldPm2}`);
  }
  // Charges with no invoice date: the live ticket keeps the WO, as before installs and PMs took billing, and says so.
  const plain = (await preview(sql, [file("charges.csv", [CHARGES_HEAD, charge("WO-7501", "", "", "Test New Ticket Cafe", "Service : TRIPCHARGE", 1, 50)])])).plans[0];
  assert.deepEqual([plain.kind, plain.jobId, plain.status], ["service", newT, "write"]);
  assert.ok(
    plain.warnings.includes(`PM #${oldPm} carries this WO too. With no invoice date in the files to tell them apart, the ticket takes it, as before installs and PMs took billing: make sure it's the ticket's.`),
    plain.warnings.join(" | "),
  );
});

test("a ticket merged into the install as billed (11/5 review): its recorded invoices and the merge log's are its billing, and their dates aren't the install's", async () => {
  const { sql } = await fresh();
  const CAFE = "Test Carried Cafe";
  // Merged as billed on SO5410; an invoice with no SO is recorded on it too, from its own visit in March.
  const inst = await install(sql, { customer: CAFE, wo: "WO-5410", received: "2026-10-01", completed: "2026-10-20" });
  const t = await ticket(sql, { customer: CAFE, wo: "WO-5410", so: "SO5410", received: "2026-03-01", completed: "2026-03-03" });
  await sql.query("update service_jobs set duplicate_of = id, merged_install_id = $2 where id = $1", [t, inst]);
  await sql.query("insert into ticket_install_merges (job_id, install_id, merged_by, moved) values ($1, $2, 'chuy', $3::jsonb)", [t, inst, JSON.stringify({ billedOn: "SO5410", billedSo: "SO5410", billedInvoices: "INV5410", billedTotal: 100 })]);
  await sql.query(
    "insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source) values ($1, 'INV5410', 'SO5410', '2026-03-04', 'Paid In Full', 100, 0, 'so'), ($1, 'INV5411', null, '2026-03-05', 'Paid In Full', 40, 0, 'standalone')",
    [t],
  );
  const f = [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5410", "", "INV5411", "2026-03-05", "Paid In Full", 40, 0, ""), invoice("WO-5410", "SO5499", "INV5499", "2026-10-25", "Open", 300)])];
  const p = (await preview(sql, f)).plans[0];
  assert.deepEqual([p.status, p.kind, p.recordId, p.reason], ["write", "install", inst, null], "March's invoice is the ticket's: its date isn't checked against the install");
  assert.deepEqual(p.invoices.map((i) => [i.invoice, i.change]), [["INV5411", "elsewhere"], ["INV5499", "new"]]);
  assert.deepEqual([p.amounts.netsuite, p.so.next], [300, "SO5499"]);
  // Every row the ticket's (its SO's invoice and its own): on the install's card already, even with a live ticket on
  // the WO now; nothing to write.
  const live = await ticket(sql, { customer: CAFE, wo: "WO-5410", received: "2026-10-02", completed: "2026-10-05" });
  const theirs = (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5410", "SO5410", "INV5410", "2026-03-04", "Paid In Full", 100, 0), invoice("WO-5410", "", "INV5411", "2026-03-05", "Paid In Full", 40, 0, "")])])).plans[0];
  assert.deepEqual([theirs.status, theirs.kind, theirs.recordId, theirs.invoices.map((i) => i.change)], ["same", "install", inst, ["elsewhere", "elsewhere"]], `not ticket #${live}`);

  // Merged as billed on its NetSuite invoices alone, the merge naming INV5420, which isn't on the ticket yet: the
  // ticket's to take, not the install's.
  const inst2 = await install(sql, { customer: CAFE, wo: "WO-5420" });
  const t2 = await ticket(sql, { customer: CAFE, wo: "WO-5420" });
  await sql.query("update service_jobs set duplicate_of = id, merged_install_id = $2 where id = $1", [t2, inst2]);
  await sql.query("insert into ticket_install_merges (job_id, install_id, merged_by, moved) values ($1, $2, 'chuy', $3::jsonb)", [t2, inst2, JSON.stringify({ billedOn: "NetSuite invoice INV5420", billedInvoices: "INV5420", billedTotal: 60 })]);
  const named = (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5420", "", "INV5420", "2026-10-21", "Open", 60, 60, "")])])).plans[0];
  assert.deepEqual(
    [named.status, named.reason],
    ["skip", `INV5420 is ticket #${t2}'s billing (merged into install #${inst2} as billed), and isn't on the ticket yet. Put its rows in a file of their own and run that first, so it goes on the ticket; then run the rest.`],
  );
});

test("one invoice under two records' WOs (11/5 review): written on each and said on both; a rerun still says it", async () => {
  const { sql } = await fresh();
  const a = await install(sql, { customer: "Test Shared A", wo: "WO-5201" });
  const b = await pm(sql, { customer: "Test Shared B", wo: "WO-5202" });
  const f = [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5201", "", "INV5200", "2026-10-21", "Open", 70, 70, ""), invoice("WO-5202", "", "INV5200", "2026-10-21", "Open", 70, 70, "")])];
  const p = byWo(await preview(sql, f));
  assert.deepEqual([p["WO-5201"].status, p["WO-5202"].status], ["write", "write"], "two records: neither waits");
  assert.deepEqual(p["WO-5201"].warnings, [`INV5200 is in the files under WO-5202 (PM #${b}) too. NetSuite billed both on one invoice, or a WO is wrong: check it in NetSuite.`]);
  assert.deepEqual(p["WO-5202"].warnings, [`INV5200 is in the files under WO-5201 (install #${a}) too. NetSuite billed both on one invoice, or a WO is wrong: check it in NetSuite.`]);
  await write(sql, f);
  assert.deepEqual([await nsInvoices(sql, "install_id", a), await nsInvoices(sql, "pm_id", b)], [["INV5200 Open 70.00 70.00 5201"], ["INV5200 Open 70.00 70.00 5202"]]);
  const again = byWo(await preview(sql, f));
  assert.deepEqual([again["WO-5201"].status, again["WO-5202"].status], ["same", "same"]);
  assert.deepEqual(again["WO-5201"].warnings, [`INV5200 is on PM #${b} already. NetSuite billed both on one invoice, or the WO is wrong: check it in NetSuite.`]);
  assert.deepEqual(again["WO-5202"].warnings, [`INV5200 is on install #${a} already. NetSuite billed both on one invoice, or the WO is wrong: check it in NetSuite.`]);
});

test("the checks (11/5 review): an install's own invoice against both its WOs' invoices; a PM with no charges at all; a skipped invoice not counted; Voided since", async () => {
  const { sql } = await fresh();
  const CAFE = "Test Two WO Cafe";
  const inst = await install(sql, { customer: CAFE, wo: "WO-5301" });
  await sql.query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-5301', '5301', 'desk'), ($1, 'WO-5302', '5302', 'desk')", [inst]);
  const own = id(await one(sql, "insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('install', $1, $2, 1350, 'chuy', now()) returning id", [inst, CAFE]));
  await sql.query("insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort) values ($1, 'EQUIPMENT : TESTBREWER', 'Brewer', 1, 1350, 'part', 1)", [own]);
  const both = (second) => [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5301", "SO5301", "INV5301", "2026-10-21", "Open", 900, 900, ""), second])];
  const p = await preview(sql, both(invoice("WO-5302", "SO5302", "INV5302", "2026-10-22", "Open", 450, 450, "")));
  assert.deepEqual(
    p.plans.map((x) => [x.wo, x.amounts.kdSource, x.amounts.kd, x.amounts.netsuite, x.amounts.nsMismatch, x.warnings]),
    [
      ["WO-5301", "katzdesk", 1350, 1350, false, []],
      ["WO-5302", "katzdesk", 1350, 1350, false, []],
    ],
  );
  // Written, then run again: each invoice counted once.
  await write(sql, both(invoice("WO-5302", "SO5302", "INV5302", "2026-10-22", "Open", 450, 450, "")));
  assert.deepEqual((await preview(sql, both(invoice("WO-5302", "SO5302", "INV5302", "2026-10-22", "Open", 450, 450, "")))).plans.map((x) => [x.status, x.amounts.netsuite, x.amounts.nsMismatch]), [["same", 1350, false], ["same", 1350, false]]);
  // One WO's invoice Voided: the install is short, said on both its WOs.
  const short = await preview(sql, both(invoice("WO-5302", "SO5302", "INV5302", "2026-10-22", "Voided", 450, 0, "")));
  const said = "NetSuite's live invoices ($900.00) don't match the install's own invoice in KatzDesk ($1350.00).";
  assert.deepEqual(short.plans.map((x) => [x.amounts.netsuite, x.amounts.nsMismatch, x.warnings]), [[900, true, [said]], [900, true, [said]]]);

  // A third WO billed in an earlier run, outside these files: its lines count in the install's charges.
  const three = await install(sql, { customer: "Test Three WO Cafe", wo: "WO-5311" });
  await sql.query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-5311', '5311', 'desk'), ($1, 'WO-5312', '5312', 'desk'), ($1, 'WO-5313', '5313', 'desk')", [three]);
  await write(sql, [file("charges.csv", [CHARGES_HEAD, charge("WO-5313", "INV5313", "SO5313", "Test Three WO Cafe", "EQUIPMENT : TESTC", 1, 100)]), file("invoices.csv", [INVOICES_HEAD, invoice("WO-5313", "SO5313", "INV5313", "2026-10-20", "Open", 100)])]);
  const rest = await preview(sql, [
    file("charges.csv", [CHARGES_HEAD, charge("WO-5311", "INV5311", "SO5311", "Test Three WO Cafe", "EQUIPMENT : TESTA", 1, 200), charge("WO-5312", "INV5312", "SO5312", "Test Three WO Cafe", "EQUIPMENT : TESTB", 1, 300)]),
    file("invoices.csv", [INVOICES_HEAD, invoice("WO-5311", "SO5311", "INV5311", "2026-10-21", "Open", 200), invoice("WO-5312", "SO5312", "INV5312", "2026-10-22", "Open", 300)]),
  ]);
  assert.deepEqual(rest.plans.map((x) => [x.wo, x.amounts.kdSource, x.amounts.kd, x.amounts.netsuite, x.amounts.nsMismatch]), [["WO-5311", "netsuite", 600, 600, false], ["WO-5312", "netsuite", 600, 600, false]]);

  // A PM with no lines in KatzDesk or from NetSuite: two invoices, nothing to check them against.
  const lone = await pm(sql, { customer: "Test No Charges Cafe", wo: "WO-5303" });
  const g = [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5303", "", "INV5303", "2026-10-21", "Open", 80, 80, ""), invoice("WO-5303", "", "INV5304", "2026-10-23", "Open", 80, 80, "")])];
  const q = (await preview(sql, g)).plans[0];
  assert.deepEqual([q.amounts.kdSource, q.amounts.netsuite, q.amounts.nsMismatch, q.amounts.doubleBill, q.warnings], ["none", 160, false, false, []]);
  await write(sql, g);
  const row = (await report.invoicesReportFor(sql, "u-owner")).rows.find((r) => r.board === "pm" && r.id === lone);
  assert.deepEqual([row.liveTotal, row.mismatch, row.doubleBill, row.chargesFrom], [160, false, false, undefined]);
  const panel = await rec.loadRecordBillingFor(sql, "u-owner", { type: "pm", id: lone });
  assert.deepEqual([panel.chargeSource, panel.mismatch, panel.doubleBill], ["none", false, false]);
  // An invoice with no status in the file is left out, and not counted.
  const s = (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5303", "", "INV5305", "2026-10-24", "", 500, 500, "")])])).plans[0];
  assert.deepEqual([s.invoices.map((i) => [i.invoice, i.change]), s.amounts.netsuite], [[["INV5305", "skip"]], 160]);
  // Voided in NetSuite since, its total and remaining as they were: updated, and no longer live.
  const v = (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5303", "", "INV5304", "2026-10-23", "Voided", 80, 80, "")])])).plans[0];
  assert.deepEqual([v.status, v.invoices.map((i) => [i.invoice, i.change, i.before.status]), v.amounts.netsuite], ["write", [["INV5304", "updated", "Open"]], 80]);
});

test("Merge installs (11/5 review): NetSuite's billing on the install merged in goes with its WOs to the one kept", async () => {
  const { sql } = await fresh();
  const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
  const CAFE = "Test Merge Billing Cafe";
  const keep = await install(sql, { customer: CAFE, wo: "WO-5501" });
  const drop = await install(sql, { customer: CAFE, wo: "WO-5502" });
  const f = [
    file("charges.csv", [CHARGES_HEAD, charge("WO-5501", "INV5501", "SO5501", CAFE, "EQUIPMENT : TESTA", 1, 100), charge("WO-5502", "INV5502", "SO5502", CAFE, "EQUIPMENT : TESTB", 2, 50)]),
    file("invoices.csv", [INVOICES_HEAD, invoice("WO-5501", "SO5501", "INV5501", "2026-10-21", "Open", 100), invoice("WO-5502", "SO5502", "INV5502", "2026-10-22", "Open", 100)]),
  ];
  await write(sql, f);
  // The drop lists WO-5501's billing and INV5501 too: the one kept has them, so the drop's stay where they are.
  await sql.query("insert into record_ns_billing (install_id, wo, wo_key, ns_so) values ($1, 'WO-5501', '5501', 'SO5501')", [drop]);
  await sql.query("insert into record_ns_invoices (install_id, wo_key, ns_invoice, status, total) values ($1, '5501', 'INV5501', 'Open', 100)", [drop]);
  const res = await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
  assert.deepEqual([res.netsuiteWos, res.netsuiteInvoices], [1, 1]);
  const heads = async (i) =>
    (await sql.query("select b.wo, b.ns_so, count(c.id)::int as lines from record_ns_billing b left join record_ns_charges c on c.billing_id = b.id where b.install_id = $1 group by b.id order by b.wo", [i])).map((r) => [r.wo, r.ns_so, r.lines]);
  assert.deepEqual(await heads(keep), [["WO-5501", "SO5501", 1], ["WO-5502", "SO5502", 1]]);
  assert.deepEqual(await heads(drop), [["WO-5501", "SO5501", 0]]);
  assert.deepEqual(await nsInvoices(sql, "install_id", keep), ["INV5501 Open 100.00 100.00 5501", "INV5502 Open 100.00 100.00 5502"]);
  assert.deepEqual(await nsInvoices(sql, "install_id", drop), ["INV5501 Open 100.00 null 5501"]);
  assert.match((await one(sql, "select detail from activity where entity_type = 'install' and entity_id = $1 and action = 'merged' order by id desc limit 1", [keep])).detail, / · its NetSuite billing/);
  const row = (await report.invoicesReportFor(sql, "u-owner")).rows.find((r) => r.board === "install" && r.id === keep);
  assert.deepEqual([row.so, row.invoices.map((i) => i.invoice), row.chargeNet, row.liveTotal, row.mismatch], ["SO5501, SO5502", ["INV5501", "INV5502"], 200, 200, false]);
  // A Billing Backfill run afterwards finds it all on the install kept.
  assert.deepEqual((await preview(sql, f)).plans.map((x) => [x.wo, x.recordId, x.status]), [["WO-5501", keep, "same"], ["WO-5502", keep, "same"]]);
});

test("a PM billed in NetSuite bills on its own (11/5 review): it can't be stacked on a ticket, and isn't offered", async () => {
  const { sql } = await fresh();
  const { stackPmSql, stackRefusal } = await import("../src/lib/ops/pm-stack.ts");
  const { listForJob } = await import("../src/lib/ops/pm-stack-api.ts");
  const CAFE = "Test Stack Cafe";
  const billed = await pm(sql, { customer: CAFE, wo: "WO-5601" });
  const pending = await pm(sql, { customer: CAFE, wo: "WO-5603" });
  const free = await pm(sql, { customer: CAFE, wo: "WO-5602" });
  const host = await ticket(sql, { customer: CAFE, wo: "WO-5600" });
  await write(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5601", "SO5601", "INV5601", "2026-10-21", "Open", 90), ["WO-5603", "SO5603", "Pending Billing", "", "", "", "", "", "", ""]])]);
  assert.deepEqual(
    (await sql.query("select pm_netsuite_billed($1) as a, pm_netsuite_billed($2) as b, pm_netsuite_billed($3) as c", [billed, pending, free])).map((r) => [r.a, r.b, r.c]),
    [[true, true, false]],
    "a live invoice, or a Sales Order",
  );
  assert.deepEqual((await listForJob(sql, host)).candidates.map((c) => c.pmId), [free]);
  assert.deepEqual(await sql.query(stackPmSql(), [billed, host, "chuy"]), []);
  assert.deepEqual(await sql.query(stackPmSql(), [pending, host, "chuy"]), []);
  const pmOf = (id) => ({ id, customer: CAFE, status: "Completed", stackedJobId: null });
  const hostRow = { id: host, customer: CAFE, status: "Completed", nsSo: null, duplicateOf: null, phoneResolved: false, wo: "WO-5600", callId: null };
  assert.equal(stackRefusal(pmOf(billed), hostRow, 0, false, "INV5601"), `PM #${billed} is billed in NetSuite (INV5601), so it bills on its own.`);
  assert.equal(stackRefusal(pmOf(free), hostRow, 0, false, null), null);
  // A Voided invoice alone bills nothing: the PM can still stack.
  await sql.query("insert into record_ns_invoices (pm_id, wo_key, ns_invoice, status, total) values ($1, '5602', 'INV5602', 'Voided', 0)", [free]);
  assert.equal((await one(sql, "select pm_netsuite_billed($1) as b", [free])).b, false);
  assert.equal((await sql.query(stackPmSql(), [free, host, "chuy"])).length, 1);
});

test("Tickets In Window (11/5 review): each WO row of an install shows that WO's SO and invoices", async () => {
  const { sql } = await fresh();
  const CAFE = "Test Window Cafe";
  const inst = await install(sql, { customer: CAFE, wo: "WO-5701" });
  await sql.query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-5701', '5701', 'desk'), ($1, 'WO-5702', '5702', 'desk')", [inst]);
  await write(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5701", "SO5701", "INV5701", "2026-10-21", "Open", 100, 100, ""), invoice("WO-5702", "SO5702", "INV5702", "2026-10-28", "Open", 200, 200, "")])]);
  // One recorded with no WO goes on the install's first row.
  await sql.query("insert into record_ns_invoices (install_id, ns_invoice, status, total, invoice_date) values ($1, 'INV5700', 'Open', 5, '2026-10-30')", [inst]);
  const rows = (await report.loadWindowRows(sql, ["install"])).filter((r) => r.id === inst);
  assert.deepEqual(
    rows.map((r) => [r.wo, r.so, r.invoices.map((i) => i.invoice), r.invoicedDates]),
    [
      ["WO-5701", "SO5701", ["INV5701", "INV5700"], ["2026-10-21", "2026-10-30"]],
      ["WO-5702", "SO5702", ["INV5702"], ["2026-10-28"]],
    ],
  );
});

test("Location Check and an install's WO dates (11/5 review): its NetSuite invoices under the warehouse rule; a WO row's own dates decide", async () => {
  const { sql } = await fresh();
  const inst = await install(sql, { customer: "Test Warehouse Cafe", wo: "WO-5801", tech: "Lance Oden" });
  const p = await pm(sql, { customer: "Test Warehouse PM", wo: "WO-5802", tech: "Bill McKinley" });
  const f = [
    file("charges.csv", [CHARGES_HEAD, charge("WO-5801", "INV5801", "SO5801", "Test Warehouse Cafe", "EQUIPMENT : TESTA", 1, 100), charge("WO-5802", "INV5802", "SO5802", "Test Warehouse PM", "PM KITS : TESTK", 1, 50)]),
    file("invoices.csv", [INVOICES_HEAD, invoice("WO-5801", "SO5801", "INV5801", "2026-10-21", "Open", 100), invoice("WO-5802", "SO5802", "INV5802", "2026-10-22", "Open", 50)]),
  ];
  await write(sql, f);
  // The charges' helper bills from Houston - WH: neither tech's warehouse.
  // An install taken off the board isn't listed (as on the Invoices page).
  const gone = await install(sql, { customer: "Test Gone Warehouse Cafe", wo: "WO-5809", tech: "Lance Oden", archived: true });
  await sql.query("insert into record_ns_invoices (install_id, wo_key, ns_invoice, status, total, location) values ($1, '5809', 'INV5809', 'Open', 10, 'Houston - WH')", [gone]);
  const rows = (await report.locationCheckFor(sql, "u-owner")).rows.filter((r) => r.kind === "warehouse");
  assert.deepEqual(rows.map((r) => [r.board, r.id, r.wo, r.invoice, r.invoiceLocation]), [["install", inst, "WO-5801", "INV5801", "Houston - WH"], ["pm", p, "WO-5802", "INV5802", "Houston - WH"]]);

  // An install from 2025 with a WO added this October: that WO row's dates are the ones an invoice is checked against.
  const old = await install(sql, { customer: "Test Old Project Cafe", wo: "WO-5803", received: "2025-01-10", completed: "2025-01-20" });
  await sql.query("insert into install_work_orders (install_id, wo, match_key, source, received, completed_at) values ($1, 'WO-5803', '5803', 'desk', '2025-01-10', '2025-01-20'), ($1, 'WO-5804', '5804', 'desk', '2026-10-01', '2026-10-05')", [old]);
  const added = (await preview(sql, [file("invoices.csv", [INVOICES_HEAD, invoice("WO-5804", "", "INV5804", "2026-10-12", "Open", 10, 10, "")])])).plans[0];
  assert.deepEqual([added.status, added.kind, added.recordId, added.reason], ["write", "install", old, null]);
});

test("no invoice date (11/5 re-review): the record a WO's billing is on already keeps it; a live ticket doesn't take an install's; a discount alone empties nothing", async () => {
  const { sql } = await fresh();
  const CAFE = "Test Probe Cafe";
  const inst = await install(sql, { customer: CAFE, wo: "WO-6101", received: "2026-10-01", completed: "2026-10-20" });
  const charges = [CHARGES_HEAD, charge("WO-6101", "INV6101", "SO6101", CAFE, "EQUIPMENT : TESTBREWER", 1, 900)];
  await write(sql, [file("charges.csv", charges), file("invoices.csv", [INVOICES_HEAD, invoice("WO-6101", "SO6101", "INV6101", "2026-10-28", "Open", 900)])]);
  // A live ticket with the WO afterwards, with a charge of its own.
  const t = await ticket(sql, { customer: CAFE, wo: "WO-6101", received: "2026-11-02", completed: "2026-11-03" });
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : SERVICELABOR', 'Labor', 1, 150, 'labor', 1)", [t]);
  // A charges-only rerun naming INV6101 and SO6101: the install's, already there.
  const rerun = (await preview(sql, [file("charges.csv", charges)])).plans[0];
  assert.deepEqual([rerun.kind, rerun.recordId, rerun.status], ["install", inst, "same"], `not ticket #${t}`);
  // Naming the invoice alone does it too.
  const byInvoice = (await preview(sql, [file("charges.csv", [CHARGES_HEAD, charge("WO-6101", "INV6101", "", CAFE, "EQUIPMENT : TESTBREWER", 1, 900)])])).plans[0];
  assert.deepEqual([byInvoice.kind, byInvoice.recordId], ["install", inst]);
  // Charges naming nothing recorded, the install having this WO's NetSuite billing: could be either, skipped.
  const loose = (await preview(sql, [file("charges.csv", [CHARGES_HEAD, charge("WO-6101", "", "", CAFE, "EQUIPMENT : TESTX", 1, 50)])])).plans[0];
  assert.deepEqual(
    [loose.status, loose.reason],
    ["skip", `The WO is on ticket #${t}, install #${inst}, and the files have no invoice date to tell them apart (install #${inst} has NetSuite billing for it already). Skipped.`],
  );
  // Recorded on both: can't tell either.
  await sql.query("update service_jobs set ns_so = 'SO6101' where id = $1", [t]);
  assert.equal(
    (await preview(sql, [file("charges.csv", charges)])).plans[0].reason,
    `The WO is on ticket #${t}, install #${inst}, and the files have no invoice date to tell them apart (the rows' invoices or Sales Orders are on ticket #${t} and install #${inst} already). Skipped.`,
  );
  assert.deepEqual((await sql.query("select item from ticket_charges where job_id = $1", [t])).map((r) => r.item), ["Service : SERVICELABOR"]);

  // A PM's WO with NetSuite lines; a later charges file lists only a discount for it: its lines stay.
  const pmId = await pm(sql, { customer: "Test Disc Cafe", wo: "WO-7700" });
  await write(sql, [
    file("charges.csv", [CHARGES_HEAD, charge("WO-7700", "INV7700", "SO7700", "Test Disc Cafe", "PM KITS : A", 1, 300)]),
    file("invoices.csv", [INVOICES_HEAD, invoice("WO-7700", "SO7700", "INV7700", "2026-10-25", "Open", 300)]),
  ]);
  const discOnly = [file("charges.csv", [CHARGES_HEAD, ["WO-7700", "INV7700", "SO7700", "", "Test Disc Cafe", "", "CLDSERVICE", "Discount", "Discount", "1", "-10", "-10", "CLDSERVICE", "", ""]])];
  const q = (await preview(sql, discOnly)).plans[0];
  assert.deepEqual([q.recordId, q.status, q.charges.next, q.charges.current.length], [pmId, "same", null, 1]);
  assert.ok(q.warnings.includes("No item lines for WO-7700 in the file, only a discount or lines that net to nothing: NetSuite's lines on the PM kept."), q.warnings.join(" | "));
});
