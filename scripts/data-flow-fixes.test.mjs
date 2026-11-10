// Data-flow fixes from the 11/9 check (Chuy): a rename carries modules and waiting Warehouse requests, and stops
// with its error when a table can't be written; ticket numbers go past 999 a month; a ticket needs a real account.
// Made-up accounts, machines and tickets only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");
const { nextCallId, callIdNumber, formatCallId } = await import("../src/lib/ops/call-id.ts");
const { openTicketFor } = await import("../src/lib/ops/api.ts");
const { accountForApproval } = await import("../src/lib/ops/stock-actions.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.exec("create unique index if not exists directory_customers_name_lower_uidx on directory_customers (lower(name))");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  const account = async (name) => Number((await query("insert into directory_customers (name) values ($1) returning id", [name]))[0].id);
  return { pg, sql, query, account };
}

test("a rename carries the account's Eversys modules, and a Warehouse request still waiting", async () => {
  const { pg, sql, query, account } = await fresh();
  try {
    const id = await account("Test Diner - Old Name");
    const unit = Number((await query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Test Diner - Old Name', 'Test e4', 'Test e4', 'TE-1', 'te-1') returning id"))[0].id);
    await query("insert into modules (module_id, module_type, status, location, assigned_customer, assigned_unit_id) values ('TM-1', 'Brew Module', 'Installed', 'Test Diner - Old Name', 'Test Diner - Old Name', $1)", [unit]);
    // A spare on the shelf whose location only happens to read like the name isn't on the account: it stays.
    await query("insert into modules (module_id, module_type, status, location) values ('TM-2', 'Brew Module', 'Ready', 'Test Diner - Old Name')");
    const asset = Number((await query("insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status, stock_hold, stock_hold_customer) values ('equip', 'Test Brewer', 'TB-9', 1, 'barn-back', 'A', 1, 1, 'ready', 'assign', 'test diner - old name') returning id"))[0].id);
    await query("insert into asset_stock_actions (asset_id, kind, status, customer, asked_by) values ($1, 'assign', 'pending', 'Test Diner - Old Name', 'u-wh'), ($1, 'assign', 'approved', 'Test Diner - Old Name', 'u-wh')", [asset]);

    await renameOrMergeCustomer(sql, id, "Test Diner - New Name");

    assert.deepEqual(await query("select module_id, location, assigned_customer from modules order by module_id"), [
      { module_id: "TM-1", location: "Test Diner - New Name", assigned_customer: "Test Diner - New Name" },
      { module_id: "TM-2", location: "Test Diner - Old Name", assigned_customer: null },
    ]);
    assert.equal((await query("select stock_hold_customer from assets where id = $1", [asset]))[0].stock_hold_customer, "Test Diner - New Name");
    // The waiting request follows the account; the decided one is history and keeps the name it was decided under.
    assert.deepEqual(await query("select status, customer from asset_stock_actions order by status"), [
      { status: "approved", customer: "Test Diner - Old Name" },
      { status: "pending", customer: "Test Diner - New Name" },
    ]);
    // A capitals-only rename carries them too.
    await renameOrMergeCustomer(sql, id, "TEST DINER - New Name");
    assert.equal((await query("select assigned_customer from modules where module_id = 'TM-1'"))[0].assigned_customer, "TEST DINER - New Name");
    assert.equal((await query("select customer from asset_stock_actions where status = 'pending'"))[0].customer, "TEST DINER - New Name");
  } finally {
    await pg.close();
  }
});

test("a rename that can't write a table stops with the error and leaves the account's name; renaming again finishes it", async () => {
  const { pg, sql, query, account } = await fresh();
  try {
    const id = await account("Test Grill - Old");
    await query("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-T-1', 'Test Grill - Old', 'Open')");
    await query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Test Grill - Old', 'Test Brewer', 'Test Brewer')");
    await pg.exec(`create function test_refuse() returns trigger language plpgsql as $$ begin raise exception 'test: equipment is busy'; end $$;
                   create trigger test_refuse_t before update on account_equipment for each row execute function test_refuse();`);

    await assert.rejects(() => renameOrMergeCustomer(sql, id, "Test Grill - New"), /test: equipment is busy/);
    assert.equal((await query("select name from directory_customers where id = $1", [id]))[0].name, "Test Grill - Old", "the account keeps its name, so the rename can be run again");
    assert.equal((await query("select customer from account_equipment"))[0].customer, "Test Grill - Old");

    await pg.exec("drop trigger test_refuse_t on account_equipment");
    await renameOrMergeCustomer(sql, id, "Test Grill - New");
    assert.equal((await query("select name from directory_customers where id = $1", [id]))[0].name, "Test Grill - New");
    assert.equal((await query("select customer from account_equipment"))[0].customer, "Test Grill - New");
    assert.equal((await query("select customer from service_jobs"))[0].customer, "Test Grill - New");
  } finally {
    await pg.close();
  }
});

test("a database without one of the side tables still renames", async () => {
  const { pg, sql, query, account } = await fresh();
  try {
    const id = await account("Test Cafe - Old");
    await query("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-T-2', 'Test Cafe - Old', 'Open')");
    await pg.exec("drop table wo_history cascade");
    await renameOrMergeCustomer(sql, id, "Test Cafe - New");
    assert.equal((await query("select customer from service_jobs"))[0].customer, "Test Cafe - New");
  } finally {
    await pg.close();
  }
});

test("a Warehouse request is approved only onto a name that is still an account", async () => {
  const { pg, sql, account } = await fresh();
  try {
    await account("Test Bakery - Main");
    assert.equal(await accountForApproval(sql, "test bakery - MAIN"), "Test Bakery - Main");
    await assert.rejects(() => accountForApproval(sql, "Test Bakery - Gone"), /^Error: Test Bakery - Gone is no longer on the customer list\. Reject this request, then ask again for the account as it is named now\.$/);
    await assert.rejects(() => accountForApproval(sql, "  "), /^Error: That request has no account\.$/);
  } finally {
    await pg.close();
  }
  assert.match(src("src/lib/ops/stock-actions.ts"), /const customer = await accountForApproval\(sql, action\.customer\);\n\s+await finalizeAssign\(sql, row, customer,/);
});

test("ticket numbers count as numbers, so a month goes past 999", async () => {
  assert.equal(callIdNumber("SC-202611-007"), 7);
  assert.equal(callIdNumber("SC-202611-1000"), 1000);
  assert.equal(callIdNumber("SC-202611-"), 0);
  assert.equal(callIdNumber("SC-ZZC-1"), 1);
  assert.equal(formatCallId("SC-202611-", 7), "SC-202611-007");
  assert.equal(formatCallId("SC-202611-", 1000), "SC-202611-1000");

  const { pg, sql, query } = await fresh();
  try {
    assert.equal(await nextCallId(sql, "2026-11-09"), "SC-202611-001");
    await query("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-202611-998', 'Test', 'Open'), ('tlc', 'SC-202611-999', 'Test', 'Open'), ('service', 'SC-202610-041', 'Test', 'Open')");
    assert.equal(await nextCallId(sql, "2026-11-09"), "SC-202611-1000");
    await query("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-202611-1000', 'Test', 'Open')");
    // The old way read "999" as the highest (as text) and handed out 1000 again.
    assert.equal(await nextCallId(sql, "2026-11-30"), "SC-202611-1001");
    assert.equal(await nextCallId(sql, "2026-10-02"), "SC-202610-042");
  } finally {
    await pg.close();
  }
  // The Corrigo import numbers its tickets the same way.
  assert.match(src("src/lib/ops/corrigo-import.ts"), /import \{ nextCallId \} from "@\/lib\/ops\/call-id";/);
  assert.doesNotMatch(src("src/lib/ops/corrigo-import.ts"), /order by call_id desc limit 1/);
  assert.doesNotMatch(src("src/lib/ops/api.ts"), /order by call_id desc limit 1/);
});

test("a new ticket goes on a real account, and two opened at once both get a number", async () => {
  const { pg, sql, query, account } = await fresh();
  try {
    await account("Test Tacos - Main St");
    await query("insert into directory_customers (name, archived) values ('Test Tacos - Closed', true)");

    const a = await openTicketFor(sql, { kind: "service", customer: "  test tacos - MAIN st ", issue: "Test leak", received: "2026-11-09" });
    assert.deepEqual((await query("select call_id, customer, status, urgency, call_type from service_jobs where id = $1", [a.id]))[0], {
      call_id: "SC-202611-001", customer: "Test Tacos - Main St", status: "Open", urgency: "Normal", call_type: "Field Service",
    });
    // A walk-in is still a ticket.
    const w = await openTicketFor(sql, { kind: "service", customer: "Walk-In", received: "2026-11-09" });
    assert.equal((await query("select customer from service_jobs where id = $1", [w.id]))[0].customer, "Walk-In");

    await assert.rejects(() => openTicketFor(sql, { kind: "service", customer: "Test Typo Tacos", received: "2026-11-09" }), /^Error: Test Typo Tacos isn't on the customer list\. Pick the account, or add it on Customers first\.$/);
    await assert.rejects(() => openTicketFor(sql, { kind: "tlc", customer: "Test Tacos - Closed", received: "2026-11-09" }), /isn't on the customer list/);
    await assert.rejects(() => openTicketFor(sql, { kind: "service", customer: "   ", received: "2026-11-09" }), /^Error: Pick an account\.$/);
    assert.equal((await query("select count(*)::int as n from service_jobs"))[0].n, 2, "a refused ticket writes nothing");

    // Two opened in the same moment: both land, on different numbers.
    const both = await Promise.all([
      openTicketFor(sql, { kind: "service", customer: "Test Tacos - Main St", received: "2026-11-09" }),
      openTicketFor(sql, { kind: "service", customer: "Test Tacos - Main St", received: "2026-11-09" }),
    ]);
    const ids = (await query("select call_id from service_jobs where id = any($1::int[]) order by call_id", [both.map((b) => b.id)])).map((r) => r.call_id);
    assert.deepEqual(ids, ["SC-202611-003", "SC-202611-004"]);
  } finally {
    await pg.close();
  }
});
