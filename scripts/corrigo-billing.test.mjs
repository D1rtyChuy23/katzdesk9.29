// Corrigo import fixes from Grok's billing request through Chuy (10/28): Admin only, the P.O. saved, exact account
// names only (never a new account, Walk-In taken from the Service Location), unmapped statuses shown, free-text fields
// kept, Type routing and urgency, received left blank without a created date, updates refreshing the issue, equipment
// and customer, and WO matching by Corrigo id and created date. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { parseCorrigoMatrix, hintedBoard, urgencyFor, corrigoType, accountIndex, resolveRowAccount } = await import("../src/lib/ops/corrigo.ts");
const { todayChicago, addDays } = await import("../src/lib/ops/clock.ts");
const { previewCorrigoRecords, applyCorrigoRows, requireCorrigoAdmin } = await import("../src/lib/ops/corrigo-import.ts");

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'), ('u-desk', 'dana', true, false, 'service')`,
  );
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  await sql.query("insert into directory_customers (name) values ('Zz Bean Cafe'), ('Zz Rock - Katy'), ('Zz Other Cafe')");
  return sql;
}

const run = async (sql, matrix) => {
  const { records } = parseCorrigoMatrix(matrix);
  const preview = await previewCorrigoRecords(sql, records);
  return { preview, rows: preview.rows };
};
const job = async (sql, wo) => (await sql.query("select * from service_jobs where wo = $1 order by id", [wo]))[0];
const accountCount = async (sql) => (await sql.query("select count(*)::int as n from directory_customers"))[0].n;

test("1: the Corrigo import is Admin only, and its button shows only for an Admin", async () => {
  const sql = await fresh();
  await requireCorrigoAdmin(sql, "u-owner");
  await assert.rejects(() => requireCorrigoAdmin(sql, "u-desk"), /Only an Admin can import a Corrigo report/);
  const page = readFileSync(new URL("../src/components/desk/jobs-page.tsx", import.meta.url), "utf8");
  assert.match(page, /kind === "service" && isAdmin \? <CorrigoImportButton/);
  assert.match(page, /kind === "service" && isAdmin \? <BillingBackfillButton/);
});

test("2: the P.O. is saved on a new ticket and on an update; a billed or invoiced ticket keeps its P.O.", async () => {
  const sql = await fresh();
  await sql.query(
    `insert into service_jobs (kind, call_id, customer, wo, status, po, ns_so) values
       ('service', 'SC-1', 'Zz Bean Cafe', 'WO-0801', 'Open', 'OLD-1', null),
       ('service', 'SC-2', 'Zz Bean Cafe', 'WO-0802', 'Open', 'OLD-2', 'SO77'),
       ('service', 'SC-3', 'Zz Bean Cafe', 'WO-0803', 'Open', 'OLD-3', null)`,
  );
  const invoiced = (await job(sql, "WO-0803")).id;
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, status, total) values ($1, 'INV9', 'Open', 10)", [invoiced]);
  const { rows } = await run(sql, [
    ["ST#", "Operational Status", "Customer Name", "P.O. #"],
    ["0801", "Work Started", "Zz Bean Cafe", "PO-555"],
    ["0802", "Work Started", "Zz Bean Cafe", "PO-556"],
    ["0803", "Work Started", "Zz Bean Cafe", "PO-557"],
    ["0804", "Work Started", "Zz Bean Cafe", "PO-558"],
  ]);
  assert.deepEqual(rows[0].poChange, { from: "OLD-1", to: "PO-555" });
  assert.equal(rows[1].poChange, null);
  assert.match(rows[1].poNote, /P\.O\. kept \(OLD-2\): the ticket is billed on SO77/);
  assert.match(rows[2].poNote, /invoiced/);
  await applyCorrigoRows(sql, rows, "chuy");
  assert.deepEqual(
    [(await job(sql, "WO-0801")).po, (await job(sql, "WO-0802")).po, (await job(sql, "WO-0803")).po, (await job(sql, "WO-0804")).po],
    ["PO-555", "OLD-2", "OLD-3", "PO-558"],
  );
});

test("3 + 10: exact account names only; never a new account; Walk-In takes its Service Location; the rest needs review", async () => {
  const sql = await fresh();
  await sql.query("insert into directory_customers (name, archived) values ('Zz Gone Cafe', true)");
  await sql.query("insert into service_jobs (kind, call_id, customer, wo, status) values ('service', 'SC-9', 'Walk - In', 'WO-0905', 'Open')");
  const before = await accountCount(sql);
  const { rows } = await run(sql, [
    ["ST#", "Operational Status", "Customer Name", "Service Location Name"],
    ["0901", "Work Started", "zz  bean cafe", ""],
    ["0902", "Work Started", "Walk - In", "Zz Rock - Katy BRSO-TX901"],
    ["0903", "Work Started", "Walk - In", "Zz Nowhere Shop"],
    ["0904", "Work Started", "Zz Brand New Cafe", ""],
    ["0905", "Completed", "Walk - In", ""],
    ["0906", "Work Started", "Zz Gone Cafe", ""],
    ["0907", "Work Started", "Zz Rock - Katy (BRSO-TX902)", ""],
  ]);
  const by = Object.fromEntries(rows.map((r) => [r.wo, r]));
  assert.deepEqual([by["WO-0901"].customer, by["WO-0901"].account.status, by["WO-0901"].needsReview], ["Zz Bean Cafe", "exact", false]);
  assert.deepEqual([by["WO-0902"].customer, by["WO-0902"].account.status], ["Zz Rock - Katy", "location"]);
  assert.deepEqual([by["WO-0903"].customer, by["WO-0903"].needsReview], [null, true]);
  assert.match(by["WO-0903"].account.note, /Walk-In, and no account is named "Zz Nowhere Shop"/);
  assert.deepEqual([by["WO-0904"].customer, by["WO-0904"].needsReview], [null, true]);
  assert.match(by["WO-0904"].account.note, /No account named "Zz Brand New Cafe"\. Pick one \(the import never adds accounts\)/);
  assert.equal(by["WO-0905"].needsReview, true, "a ticket on Walk-In with no account stays for review");
  assert.equal(by["WO-0906"].account.status, "removed");
  assert.equal(by["WO-0907"].customer, "Zz Rock - Katy", "the ServiceChannel id comes off");
  // Everything ticked (as if the Admin pressed Confirm without picking): only the rows with an account are written.
  const res = await applyCorrigoRows(sql, rows, "chuy");
  assert.deepEqual(res.refused.map((r) => r.wo).sort(), ["WO-0903", "WO-0904", "WO-0905", "WO-0906"]);
  assert.equal(await accountCount(sql), before, "no account was added");
  assert.equal((await job(sql, "WO-0902")).customer, "Zz Rock - Katy");
  assert.equal((await job(sql, "WO-0905")).customer, "Walk - In");
  assert.equal((await job(sql, "WO-0905")).status, "Open", "not written");
  // A request that names Walk-In for a ticket on Walk-In is refused too, never kept on Walk-In (10/28 review).
  const handMade = await applyCorrigoRows(sql, rows.filter((r) => r.wo === "WO-0905").map((r) => ({ ...r, customer: "Walk - In" })), "chuy");
  assert.deepEqual(handMade.refused.map((r) => r.wo), ["WO-0905"]);
  assert.equal((await job(sql, "WO-0905")).status, "Open", "still not written");
  // The Admin picks an account for the Walk-In ticket: it is written, under that account.
  const picked = rows.filter((r) => r.wo === "WO-0905").map((r) => ({ ...r, customer: "Zz Other Cafe" }));
  await applyCorrigoRows(sql, picked, "chuy");
  assert.deepEqual([(await job(sql, "WO-0905")).customer, (await job(sql, "WO-0905")).status], ["Zz Other Cafe", "Completed"]);
});

test("account rules (pure): a locked clean-list name wins; an update keeps its own account when nothing matches", () => {
  const idx = accountIndex([
    { name: "Zz Cafe Alpha", archived: false, locked: true },
    { name: "Zz Beta", archived: false, locked: false },
  ]);
  assert.deepEqual(resolveRowAccount({ customer: "ZZ CAFE-ALPHA", serviceLocation: null }, null, idx), { status: "locked", name: "Zz Cafe Alpha", note: 'Clean-list name for "ZZ CAFE-ALPHA"' });
  assert.equal(resolveRowAccount({ customer: "Zz Beta Inc", serviceLocation: null }, null, idx).status, "none", "an unlocked name must match exactly");
  assert.equal(resolveRowAccount({ customer: "Zz Unknown", serviceLocation: null }, "Zz Beta", idx).status, "kept");
  assert.equal(resolveRowAccount({ customer: "Walk-In", serviceLocation: null }, "Zz Beta", idx).status, "kept");
  assert.equal(resolveRowAccount({ customer: "Walk-In", serviceLocation: null }, "Walk - In", idx).status, "walkin");
});

test("4: unmapped and blank statuses are flagged and keep the ticket's status", async () => {
  const sql = await fresh();
  await sql.query("insert into service_jobs (kind, call_id, customer, wo, status) values ('service', 'SC-1', 'Zz Bean Cafe', 'WO-0811', 'Dispatched')");
  const { preview, rows } = await run(sql, [
    ["ST#", "Status", "Customer Name"],
    ["0811", "Prepared", "Zz Bean Cafe"],
    ["0812", "Approved", "Zz Bean Cafe"],
    ["0813", "Currently not Invoiceable", "Zz Bean Cafe"],
    ["0814", "", "Zz Bean Cafe"],
  ]);
  assert.deepEqual(preview.unmapped, ["Prepared", "Approved", "Currently not Invoiceable"]);
  assert.deepEqual(rows.map((r) => [r.newStatus, r.statusUnmapped]), [
    ["Dispatched", "Prepared"],
    ["Open", "Approved"],
    ["Open", "Currently not Invoiceable"],
    ["Open", null],
  ]);
  assert.match(rows[3].statusNote, /no status in file/);
});

test("5: the site, contact, phone, Corrigo id and net are kept; a new ticket has no received date without a created date", async () => {
  const sql = await fresh();
  const { rows } = await run(sql, [
    ["ST#", "Operational Status", "Customer Name", "Service Location Name", "Contact Name", "Contact Phone", "Work Order ID", "Total Invoice", "Problem Description"],
    ["0821", "Work Started", "Zz Bean Cafe", "Zz Bean Cafe - Main", "Pat Lee", "555-0100", "778899", "142.86", "Grinder jam"],
  ]);
  assert.equal(rows[0].createdAt, null);
  await applyCorrigoRows(sql, rows, "chuy");
  const j = await job(sql, "WO-0821");
  assert.deepEqual(
    [j.service_location, j.contact, j.phone, j.corrigo_id, j.corrigo_net, j.received, j.call_type, j.urgency],
    ["Zz Bean Cafe - Main", "Pat Lee", "555-0100", "778899", "142.86", null, "Field Service", "Normal"],
  );
  assert.match(j.call_id, new RegExp(`^SC-${todayChicago().slice(0, 7).replace("-", "")}-`), "the call id still has a month");
});

test("6 + 7: Type PM goes on PMs, a Request is service (an Install P.O. still opens an install); urgency and created date", async () => {
  assert.deepEqual(hintedBoard({ po: null, issue: "Preventative Maintenance:Espresso PM", callType: "Request" }), {
    board: "service",
    note: "Type Request: a service ticket, though its description reads like a PM",
  });
  assert.equal(hintedBoard({ po: "Install", issue: "", callType: "Request" }).board, "install");
  assert.equal(hintedBoard({ po: "TLC & Factor", issue: "", callType: "Request" }).board, "tlc");
  assert.equal(hintedBoard({ po: null, issue: "Install grinder", callType: "PM" }).board, "pm");
  assert.match(hintedBoard({ po: null, issue: "", callType: "Quote" }).note, /Type "Quote" isn't PM or Request/);
  assert.deepEqual(corrigoType("service"), { type: "request", known: true });
  assert.deepEqual(urgencyFor("Urgent"), { urgency: "High", note: null });
  assert.deepEqual(urgencyFor("Non Urgent"), { urgency: "Normal", note: null });
  assert.match(urgencyFor("P1").note, /new: opens as Normal/);

  const sql = await fresh();
  const { rows } = await run(sql, [
    ["ST#", "Operational Status", "Customer Name", "Type", "Priority", "Created", "Problem Description"],
    ["0831", "Work Started", "Zz Bean Cafe", "PM", "", "10/01/2026", "Espresso PM"],
    ["0832", "Work Started", "Zz Bean Cafe", "Request", "Urgent", "10/02/2026", "Preventative Maintenance:Espresso PM"],
  ]);
  assert.deepEqual(rows.map((r) => [r.board, r.callTypeValue, r.urgency, r.createdAt]), [
    ["pm", null, null, "2026-10-01"],
    ["service", "Field Service", "High", "2026-10-02"],
  ]);
  await applyCorrigoRows(sql, rows, "chuy");
  assert.equal((await sql.query("select to_char(received, 'YYYY-MM-DD') as r from pm_jobs where wo = 'WO-0831'"))[0].r, "2026-10-01");
  const j = await job(sql, "WO-0832");
  assert.deepEqual([j.urgency, j.call_type], ["High", "Field Service"]);
});

test("8: an update refreshes the issue, equipment and customer (exact account), old → new; a PM's machines stay", async () => {
  const sql = await fresh();
  await sql.query(
    "insert into service_jobs (kind, call_id, customer, wo, status, issue, equipment) values ('service', 'SC-1', 'Zz Bean Cafe', 'WO-0841', 'Open', 'Old issue', 'Bunn TB3')",
  );
  await sql.query("insert into pm_jobs (customer, wo, status, equipment) values ('Zz Bean Cafe', 'WO-0842', 'Scheduled', 'Eversys e''4m')");
  const { rows } = await run(sql, [
    ["ST#", "Operational Status", "Customer Name", "Problem Description", "Equipment"],
    ["0841", "Work Started", "Zz Other Cafe", "Leaks at the group", "Bunn ITCB"],
    ["0842", "Work Started", "Zz Bean Cafe", "PM", "Something else"],
  ]);
  assert.deepEqual(rows[0].issueChange, { from: "Old issue", to: "Leaks at the group" });
  assert.deepEqual(rows[0].equipmentChange, { from: "Bunn TB3", to: "Bunn ITCB" });
  assert.equal(rows[0].customer, "Zz Other Cafe");
  assert.equal(rows[1].equipmentChange, null);
  await applyCorrigoRows(sql, rows, "chuy");
  const j = await job(sql, "WO-0841");
  assert.deepEqual([j.issue, j.equipment, j.customer], ["Leaks at the group", "Bunn ITCB", "Zz Other Cafe"]);
  const log = (await sql.query("select detail from activity where entity_id = $1 and action = 'corrigo'", [j.id]))[0].detail;
  assert.match(log, /customer Zz Bean Cafe → Zz Other Cafe · issue refreshed · equipment refreshed/);
  assert.equal((await sql.query("select equipment from pm_jobs where wo = 'WO-0842'"))[0].equipment, "Eversys e'4m");
});

test("9: Corrigo's own id finds its ticket whatever the WO; after the wrap the created date picks the run of numbers", async () => {
  const sql = await fresh();
  await sql.query("insert into service_jobs (kind, call_id, customer, wo, status, corrigo_id) values ('service', 'SC-1', 'Zz Bean Cafe', 'WO-0851', 'Open', 'C-1001')");
  const byId = await run(sql, [["ST#", "Operational Status", "Customer Name", "Work Order ID"], ["0999", "Completed", "Zz Bean Cafe", "C-1001"]]);
  assert.deepEqual([byId.rows[0].action, byId.rows[0].jobId], ["update", (await job(sql, "WO-0851")).id]);

  // A desk past WO-9999: WO-0861 in 2024 and again now. An old report (created 2024) goes on the 2024 ticket.
  await sql.query("insert into service_jobs (kind, call_id, customer, wo, status, done, received) values ('service', 'SC-W', 'Zz Old', 'WO-9999', 'Completed', true, '2023-01-01')");
  await sql.query(
    "insert into service_jobs (kind, call_id, customer, wo, status, done, received, completed_at) values ('service', 'SC-A', 'Zz Bean Cafe', 'WO-0861', 'Completed', true, '2024-05-01', '2024-05-02')",
  );
  const old = (await sql.query("select id from service_jobs where call_id = 'SC-A'"))[0].id;
  await sql.query(
    "insert into service_jobs (kind, call_id, customer, wo, status, received) values ('service', 'SC-B', 'Zz Bean Cafe', 'WO-0861', 'Open', $1)",
    [addDays(todayChicago(), -10)],
  );
  const recent = (await sql.query("select id from service_jobs where call_id = 'SC-B'"))[0].id;
  const oldRow = await run(sql, [["ST#", "Operational Status", "Customer Name", "Created"], ["0861", "Completed", "Zz Bean Cafe", "05/01/2024"]]);
  assert.equal(oldRow.rows[0].jobId, old);
  const nowRow = await run(sql, [["ST#", "Operational Status", "Customer Name"], ["0861", "Completed", "Zz Bean Cafe"]]);
  assert.equal(nowRow.rows[0].jobId, recent);
});
