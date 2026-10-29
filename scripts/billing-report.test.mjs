// The Invoices page (Admin), the Tickets list's billing filters and CSV, Tickets In Window (and its JSON route) and
// Location Check (Grok's billing request through Chuy, 10/28). All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const rules = await import("../src/lib/ops/billing-rules.ts");
const report = await import("../src/lib/ops/billing-report.ts");
const api = await import("../src/lib/ops/billing-report-api.ts");
const { parseTicketSearch, withTicketList } = await import("../src/lib/ops/search-params.ts");

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
      `insert into service_jobs (kind, call_id, customer, wo, status, technician, received, completed_at, ns_so, billed_at, duplicate_of, service_location, corrigo_net)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
      [
        o.kind ?? "service",
        `SC-RPT-${n}`,
        o.customer ?? "Zz Report Cafe",
        o.wo ?? `WO-${String(6000 + n)}`,
        o.status ?? "Completed",
        o.tech ?? "Ryan Gloria",
        o.received ?? "2026-10-01",
        o.completed === undefined ? "2026-10-10" : o.completed,
        o.so ?? null,
        o.billedAt ?? null,
        o.duplicateOf ?? null,
        o.location ?? null,
        o.corrigoNet ?? null,
      ],
    )
  )[0].id;
}

const line = (sql, jobId, item, qty, rate) =>
  sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, $2, '', $3, $4, 'part', 1)", [jobId, item, qty, rate]);

const invoice = (sql, jobId, inv, o = {}) =>
  sql.query(
    "insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, location) values ($1, $2, $3, $4, $5, $6, $7, $8)",
    [jobId, inv, o.so ?? null, o.date ?? "2026-10-15", o.status ?? "Open", o.total ?? null, o.remaining ?? null, o.location ?? null],
  );

test("each ticket's billing on one row: SO, invoices, what they add up to, the double bill and the warehouse warning", async () => {
  const sql = await fresh();
  const double = await ticket(sql, { so: "SO9001", billedAt: "2026-10-12T15:00:00Z", tech: "Lance Oden" });
  await line(sql, double, "Labor", 2, 100);
  await invoice(sql, double, "INV9001", { so: "SO9001", total: 200, remaining: 0, status: "Paid In Full", location: "Houston - WH", date: "2026-10-13" });
  await invoice(sql, double, "INV9002", { so: "SO9001", total: 200, remaining: 200, status: "Open", location: "San Antonio WH", date: "2026-10-14" });
  await invoice(sql, double, "INV9000", { so: "SO9001", total: 200, status: "Voided", date: "2026-10-11" });
  const soOnly = await ticket(sql, { so: "SO9002", billedAt: "2026-10-20T15:00:00Z" });
  await line(sql, soOnly, "Labor", 1, 50);
  const mismatch = await ticket(sql, { kind: "tlc" });
  await line(sql, mismatch, "Labor", 1, 80);
  await invoice(sql, mismatch, "INV9003", { total: 95, status: "Open" });
  const merged = await ticket(sql, { duplicateOf: soOnly });

  const rows = await api.loadTicketBillingRows(sql);
  assert.deepEqual(rows.map((r) => r.id).sort(), [double, soOnly, mismatch].sort(), "a merged ticket is left out of the Invoices page");
  const d = rows.find((r) => r.id === double);
  assert.equal(d.so, "SO9001");
  assert.equal(d.billedAt, "2026-10-12");
  assert.deepEqual(d.invoices.map((i) => i.invoice), ["INV9000", "INV9001", "INV9002"]);
  assert.equal(d.chargeNet, 200);
  assert.equal(d.liveTotal, 400, "the Voided invoice doesn't count");
  assert.equal(d.doubleBill, true);
  assert.deepEqual(d.locationWarnings, ["Lance Oden bills from San Antonio WH, not Houston - WH"]);
  assert.deepEqual(d.invoicedDates, ["2026-10-13", "2026-10-14"]);
  const s = rows.find((r) => r.id === soOnly);
  assert.deepEqual([s.so, s.invoices.length, s.doubleBill, s.mismatch, s.invoicedDates], ["SO9002", 0, false, false, ["2026-10-20"]]);
  const m = rows.find((r) => r.id === mismatch);
  assert.deepEqual([m.board, m.doubleBill, m.mismatch, m.liveTotal], ["tlc", false, true, 95]);

  // The Tickets list keeps merged tickets (they show under Flagged) and only its own board.
  const list = await api.listTicketBillingFor(sql, "service", null);
  assert.deepEqual(list.map((r) => r.id).sort(), [double, soOnly, merged].sort());
  assert.deepEqual((await api.listTicketBillingFor(sql, "tlc", null)).map((r) => r.id), [mismatch]);
  // A sales rep: only their accounts.
  await ticket(sql, { customer: "Zz Rep Account" });
  const mine = await api.listTicketBillingFor(sql, "service", (customer) => customer === "Zz Rep Account");
  assert.deepEqual(mine.map((r) => r.customer), ["Zz Rep Account"]);
});

test("the filters read a ticket's billing: SO, invoice, invoice status, double bill, mismatch and the invoiced date", async () => {
  const base = {
    id: 1,
    board: "service",
    wo: "WO-0001",
    callId: "SC-1",
    customer: "Zz Cafe Alpha",
    technician: "Ryan Gloria",
    secondaryTech: null,
    status: "Completed",
    received: "2026-10-01",
    completed: "2026-10-05",
    so: null,
    billedAt: null,
    invoices: [],
    chargeLines: 1,
    chargeNet: 100,
    liveTotal: 0,
    corrigoNet: null,
    doubleBill: false,
    mismatch: false,
    serviceLocation: null,
    locationWarnings: [],
    invoicedDates: [],
  };
  const billed = {
    ...base,
    id: 2,
    so: "SO1",
    billedAt: "2026-10-06",
    invoices: [{ invoice: "INV1", so: "SO1", status: "Paid In Full", date: "2026-10-07", total: 100, remaining: 0, location: null }],
    liveTotal: 100,
    invoicedDates: ["2026-10-07"],
  };
  const doubled = { ...billed, id: 3, doubleBill: true, mismatch: true };
  const voided = { ...base, id: 4, invoices: [{ invoice: "INV4", so: null, status: "Voided", date: "2026-10-08", total: 100, remaining: 0, location: null }] };
  const all = [base, billed, doubled, voided];
  const pick = (f) => all.filter((r) => rules.matchesBillingFilters(report.ticketFilterRow(r), f)).map((r) => r.id);
  assert.deepEqual(pick({ so: "no" }), [1, 4]);
  assert.deepEqual(pick({ so: "yes", invoice: "yes" }), [2, 3]);
  assert.deepEqual(pick({ invoice: "no" }), [1, 4], "only a Voided invoice: not invoiced");
  assert.deepEqual(pick({ invStatus: "paid" }), [2, 3]);
  assert.deepEqual(pick({ invStatus: "open" }), []);
  assert.deepEqual(pick({ invStatus: "voided" }), [4]);
  assert.deepEqual(pick({ double: true }), [3]);
  assert.deepEqual(pick({ mismatch: true }), [3]);
  assert.deepEqual(pick({ dateBy: "invoiced", dateFrom: "2026-10-07", dateTo: "2026-10-07" }), [2, 3]);
  assert.deepEqual(pick({ dateBy: "completed", dateFrom: "2026-10-06" }), []);
  assert.deepEqual(pick({ dateBy: "received", dateTo: "2026-10-01" }), [1, 2, 3, 4]);
  assert.deepEqual(pick({ q: "inv1" }), [2, 3], "the search reads invoice numbers");
  assert.deepEqual(pick({ account: "alpha", tech: "ryan gloria" }), [1, 2, 3, 4]);

  // The Tickets list row: billing still loading reads as no SO and no invoice.
  const job = { kind: "tlc", status: "Open", customer: "X", technician: null, secondaryTech: "Bill McKinley", received: "2026-10-01", completedAt: null, wo: null, callId: "TF-1" };
  const row = report.jobFilterRow(job, undefined);
  assert.deepEqual([row.board, row.so, row.invoiceStatuses, row.doubleBill], ["tlc", null, [], false]);
  assert.equal(rules.matchesBillingFilters(row, { tech: "Bill McKinley" }), true, "the second tech counts");
});

test("the Tickets list keeps its view, urgency and filters in the address bar; blanks and the board are left out", () => {
  const s = parseTicketSearch({ open: "12", view: "complete", urgency: "High", so: "no", double: "1", board: "pm", dateFrom: "2026-10-01", dateTo: "bad" });
  assert.deepEqual(s, { open: 12, view: "complete", urgency: "High", so: "no", double: true, dateFrom: "2026-10-01" });
  assert.deepEqual(parseTicketSearch({ view: "active", tab: "ping" }), { tab: "ping" });
  assert.deepEqual(parseTicketSearch({}), {});
  const next = withTicketList({ open: 5, view: "all", so: "no", q: "cafe" }, { so: undefined, view: "active", q: "", status: "Completed" });
  assert.deepEqual(next, { open: 5, status: "Completed" }, "the open ticket stays; Active and blanks drop out");
});

test("the CSVs: the Invoices page per ticket, the Tickets list with billing only when asked, and spreadsheet-safe cells", async () => {
  const sql = await fresh();
  const id = await ticket(sql, { customer: "=HYPERLINK(\"x\")", so: "SO7001", corrigoNet: 150 });
  await line(sql, id, "Labor", 1, 150);
  await invoice(sql, id, "INV7001", { so: "SO7001", total: 150, remaining: 25, status: "Open", date: "2026-10-16" });
  const rows = await api.loadTicketBillingRows(sql);
  const csv = report.invoicesCsv(rows);
  const [head, first] = csv.trim().split("\r\n");
  assert.match(head, /^Board,Ticket,WO,Account,Tech,Status,Received,Completed,SO,Billed On,Invoices,Invoice Status,Invoice Dates,/);
  assert.match(first, /^Tickets,\d+,WO-\d+,"?'=HYPERLINK/, "a formula is never live in the sheet");
  assert.match(first, /,SO7001,,INV7001,Open,2026-10-16,150\.00,150\.00,25\.00,150\.00,,,$/);

  const job = { id, kind: "service", callId: "SC-1", wo: "WO-1", customer: "Cafe", technician: "Ryan Gloria", secondaryTech: "Bill McKinley", status: "Completed", urgency: "Normal", received: "2026-10-01", scheduled: null, completedAt: "2026-10-10", issue: "Leak" };
  const plain = report.ticketsCsv([job], null).trim().split("\r\n");
  assert.equal(plain[0], "Ticket,Call ID,WO,Account,Tech,Status,Urgency,Received,Scheduled,Completed,Issue");
  assert.equal(plain[1], `${id},SC-1,WO-1,Cafe,Ryan Gloria + Bill McKinley,Completed,Normal,2026-10-01,,2026-10-10,Leak`);
  const withBilling = report.ticketsCsv([job], new Map(rows.map((r) => [r.id, r]))).trim().split("\r\n");
  assert.match(withBilling[0], /,SO,Invoices,Invoice Status,Charges \(after discount\),Invoiced \(not voided\),Possible Double Bill,Charges Don't Match Invoices$/);
  assert.match(withBilling[1], /,SO7001,"?INV7001 \(Open, 2026-10-16, 150\.00\)"?,Open,150\.00,150\.00,,$/);
});

test("Tickets In Window: every board's work orders by completed, received or invoiced date; PMs on a ticket use its billing", async () => {
  const sql = await fresh();
  const t1 = await ticket(sql, { wo: "WO-5001", received: "2026-09-20", completed: "2026-10-03", so: "SO5001", billedAt: "2026-10-04T15:00:00Z" });
  await invoice(sql, t1, "INV5001", { so: "SO5001", date: "2026-11-02", status: "Open", total: 10 });
  const t2 = await ticket(sql, { kind: "tlc", wo: "WO-5002", received: "2026-10-05", completed: null, status: "Open" });
  const merged = await ticket(sql, { wo: "WO-5003", received: "2026-10-06", completed: "2026-10-07", duplicateOf: t1 });
  const pm = (
    await sql.query(
      "insert into pm_jobs (customer, status, wo, received, completed_at, technician, stacked_job_id) values ('Zz PM Cafe', 'Completed', 'WO-5004', '2026-10-01', '2026-10-09', 'Ryan Gloria', $1) returning id",
      [t1],
    )
  )[0].id;
  const inst = (
    await sql.query("insert into installs (customer, equip_status, wo, received, completed_at) values ('Zz Install Cafe', 'Installed', 'WO-5005', '2026-09-01', '2026-10-20') returning id")
  )[0].id;
  await sql.query("insert into install_work_orders (install_id, wo, match_key, status, completed_at, received, source) values ($1, 'WO-5005', '5005', 'Completed', '2026-10-20', '2026-09-01', 'backfill'), ($1, 'WO-5006', '5006', 'Completed', '2026-09-25', '2026-09-02', 'corrigo')", [inst]);
  await sql.query("insert into installs (customer, equip_status, wo, received) values ('Zz Old Install', 'Not Ready', 'WO-5007', '2026-08-01')");

  const done = await api.ticketsInWindowFor(sql, { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(done.error, null);
  assert.deepEqual(
    done.rows.map((r) => `${r.board}:${r.wo}`).sort(),
    ["install:WO-5005", "pm:WO-5004", "service:WO-5001", "service:WO-5003"].sort(),
    "completed in October, every board; open and older work stays out",
  );
  const pmRow = done.rows.find((r) => r.board === "pm");
  assert.deepEqual([pmRow.id, pmRow.so, pmRow.invoices.map((i) => i.invoice), pmRow.note], [pm, "SO5001", ["INV5001"], `Billed on ticket #${t1}`]);
  assert.deepEqual([done.rows.find((r) => r.wo === "WO-5003").id, done.rows.find((r) => r.wo === "WO-5003").note], [merged, `Merged into ticket #${t1}`]);
  assert.deepEqual([done.rows.find((r) => r.wo === "WO-5005").id, done.rows.find((r) => r.wo === "WO-5005").note], [inst, "WO 1 of 2 on this install"]);

  const received = await api.ticketsInWindowFor(sql, { from: "2026-10-01", to: "2026-10-31", dateBy: "received", boards: ["service", "tlc"] });
  assert.deepEqual(received.rows.map((r) => r.wo).sort(), ["WO-5002", "WO-5003"]);
  assert.equal(received.rows.find((r) => r.wo === "WO-5002").id, t2);
  // Invoiced: the live invoice's date (November), not the ticket's billed date, once an invoice is on it.
  const invoiced = await api.ticketsInWindowFor(sql, { from: "2026-11-01", to: "2026-11-30", dateBy: "invoiced", boards: ["service", "pm"] });
  assert.deepEqual(invoiced.rows.map((r) => `${r.board}:${r.wo}`).sort(), ["pm:WO-5004", "service:WO-5001"]);

  assert.equal((await api.ticketsInWindowFor(sql, { from: "2026-10-31", to: "2026-10-01" })).error, "The To date is before the From date.");
  assert.equal((await api.ticketsInWindowFor(sql, { from: "", to: "2026-10-01" })).error, "Pick a From and a To date.");
  assert.equal((await api.ticketsInWindowFor(sql, { from: "2023-01-01", to: "2026-10-01" })).error, "Pick a window of two years or less.");

  const csv = report.windowCsv(done.rows).trim().split("\r\n");
  assert.equal(csv[0], "Board,Id,WO,Account,Tech,Status,Received,Completed,SO,Invoices,Service Location,Note");
  assert.equal(csv.length, 5);
});

test("Location Check: a Corrigo service location that is another account, or no account, and the warehouse rule", async () => {
  const sql = await fresh();
  await sql.query("insert into directory_customers (name) values ('Zz Rock Katy'), ('Zz Cafe Home')");
  await sql.query("insert into directory_customers (name, archived) values ('Zz Archived Spot', true)");
  const other = await ticket(sql, { customer: "Zz Cafe Home", location: "Zz Rock Katy BRSO-TX901" });
  await ticket(sql, { customer: "Zz Cafe Home", location: "zz cafe  home" });
  const unknown = await ticket(sql, { customer: "Zz Cafe Home", location: "Zz Archived Spot" });
  await sql.query("insert into pm_jobs (customer, status, service_location) values ('Zz Cafe Home', 'Scheduled', 'Zz Rock Katy (BRSO-TX901)')");
  const bill = await ticket(sql, { tech: "Bill McKinley" });
  await invoice(sql, bill, "INV8001", { location: "Houston - WH" });
  await invoice(sql, bill, "INV8002", { location: "Dallas WH" });

  const rows = await api.loadLocationCheck(sql);
  const acct = rows.filter((r) => r.kind === "account");
  assert.deepEqual(
    acct.map((r) => [r.board, r.locationAccount]),
    [["pm", "Zz Rock Katy"], ["service", null], ["service", "Zz Rock Katy"]],
    "the ServiceChannel id is left off; an archived account is no account; the same name (spacing, case) is fine",
  );
  assert.equal(acct.find((r) => r.id === other).note, "Corrigo's service location is the account Zz Rock Katy, not Zz Cafe Home.");
  assert.equal(acct.find((r) => r.id === unknown).note, `Corrigo's service location "Zz Archived Spot" is not a KatzDesk account name.`);
  const wh = rows.filter((r) => r.kind === "warehouse");
  assert.deepEqual(wh.map((r) => [r.id, r.invoice, r.note]), [[bill, "INV8001", "Bill McKinley bills from Dallas WH, not Houston - WH"]]);
  assert.match(report.locationCsv(rows).split("\r\n")[0], /^Check,Board,Id,WO,Account,Tech,Service Location,Location's Account,Invoice,Invoice Location,Note$/);
});

test("Invoices, Tickets In Window and Location Check are an Admin's: anyone else gets nothing", async () => {
  const sql = await fresh();
  await ticket(sql, {});
  assert.deepEqual(await api.invoicesReportFor(sql, "u-desk"), { forbidden: true, rows: [] });
  assert.deepEqual(await api.windowReportFor(sql, "u-desk", { from: "2026-10-01", to: "2026-10-31" }), { forbidden: true, rows: [] });
  assert.deepEqual(await api.locationCheckFor(sql, "u-desk"), { forbidden: true, rows: [] });
  assert.deepEqual(await api.invoicesReportFor(sql, "u-nobody"), { forbidden: true, rows: [] });
  const admin = await api.invoicesReportFor(sql, "u-owner");
  assert.equal(admin.forbidden, false);
  assert.equal(admin.rows.length, 1);
  const win = await api.windowReportFor(sql, "u-owner", { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual([win.forbidden, win.rows.length, win.error], [false, 1, null]);

  // The JSON route checks the session, then the Admin, before reading anything; it only reads.
  const route = readFileSync(new URL("../src/routes/api/admin/tickets-in-window.ts", import.meta.url), "utf8");
  const order = ["sameSiteOk(request)", "auth.api.getSession", "canReviewNames(sql, session.user.id)", "ticketsInWindowFor("].map((s) => route.indexOf(s));
  assert.ok(order.every((i) => i > 0), "each check is there");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "in that order");
  assert.doesNotMatch(route, /\b(insert|update|delete)\b\s+(into|from|\w+\s+set)/i);
  assert.doesNotMatch(route, /POST|PUT|PATCH|DELETE:/);
});

test("the side menu shows Invoices to an Admin only, and the page asks the server, which checks the Admin", () => {
  const shell = readFileSync(new URL("../src/components/desk/shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /label: "Billing",\s*items: \[\{ to: "\/invoices", label: "Invoices"/);
  assert.match(shell, /\.filter\(\(g\) => g\.label !== "Billing" \|\| admin\)/);
  const page = readFileSync(new URL("../src/routes/_app/invoices.tsx", import.meta.url), "utf8");
  for (const fn of ["getInvoicesReport()", "getTicketsInWindow(", "getLocationCheck()"]) assert.ok(page.includes(fn), fn);
  const server = readFileSync(new URL("../src/lib/ops/billing-report-api.ts", import.meta.url), "utf8");
  for (const fn of ["invoicesReportFor", "windowReportFor", "locationCheckFor"]) {
    const body = server.slice(server.indexOf(`export async function ${fn}`), server.indexOf(`export async function ${fn}`) + 400);
    assert.match(body, /if \(!\(await canReviewNames\(sql as Sql, userId\)\)\) return \{ forbidden: true, rows: \[\] \};/, fn);
  }
});
