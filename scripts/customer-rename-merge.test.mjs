// Renaming a customer to a name another account has (any capitals) — Grok's report, 2026-10-27: a rename merged
// silently into an old removed record, which kept its lowercase name and blank address. Now: an old account off the
// list never wins over the one being renamed; the kept account takes the typed name, keeps its details and fills only
// blanks; a pin only comes with its address; a merge needs a yes for that exact merge; a case-only rename is a rename.
// Made-up accounts only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { planCustomerRename, renameOrMergeCustomer, renameCustomerFor, previewCustomerRenameFor } = await import("../src/lib/ops/customer-identity.ts");
const { mergeToken, renameConfirm, renameToast, countsText } = await import("../src/lib/ops/customer-rename.ts");
const { listRemovedCustomersFor } = await import("../src/lib/ops/customer-remove-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  // Live also has names unique in any capitals (seed.server.ts, customer-identity patch).
  await pg.exec("create unique index if not exists directory_customers_name_lower_uidx on directory_customers (lower(name))");
  await pg.exec(`insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
    ('u-admin', 'adminrole.test', true, false, 'admin'),
    ('u-tech', 'service.test', true, false, 'service')`);
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}
async function add(sql, fields) {
  const cols = Object.keys(fields);
  const rows = await sql.query(
    `insert into directory_customers (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(fields),
  );
  return rows[0].id;
}
const get = async (sql, id) => (await sql.query("select * from directory_customers where id = $1", [id]))[0];
const call = (sql, callId, customer) =>
  sql.query("insert into service_jobs (kind, call_id, customer, status) values ('service', $1, $2, 'Completed')", [callId, customer]);
const customerOf = async (sql, callId) => (await sql.query("select customer from service_jobs where call_id = $1", [callId]))[0].customer;
/** What the rename window sends back after a yes. */
const yes = async (sql, id, name) => mergeToken(await planCustomerRename(sql, id, name));
const LIVE = {
  address: "100 Test Rd, Testville, TX 77000",
  latitude: 29.95,
  longitude: -95.55,
  geocode_match: "street",
  account_rep: "Test Rep",
  primary_contact: "Pat Test",
  phone: "555-0100",
  email: "pat@example.test",
  account_number: "T-9001",
  netsuite_id: "NS-9001",
};

test("Grok's case: renaming a live account to an old removed record's name keeps the live account and the typed name", async () => {
  const { pg, sql } = await fresh();
  try {
    const old = await add(sql, { name: "test olive #9001", archived: true });
    const live = await add(sql, { name: "Test National Accounts:Test Olive #9001", ...LIVE });
    await call(sql, "SC-9001", "Test National Accounts:Test Olive #9001");
    await sql.query("insert into customer_sales_reps (customer_id, rep_name) values ($1, 'Test Rep')", [live]);

    const plan = await planCustomerRename(sql, live, "Test Olive #9001");
    assert.equal(plan.kind, "merge");
    assert.deepEqual([plan.keep, plan.keptId, plan.droppedId, plan.name], ["renamed", live, old, "Test Olive #9001"]);
    assert.deepEqual([plan.other.archived, plan.other.onRemovedList, plan.filled, plan.notes, countsText(plan.moving)], [true, false, [], [], ""]);
    assert.equal(mergeToken(plan), `${live}>${old}`);

    // Never silent: without the yes (an old window, or no window) nothing changes.
    await assert.rejects(() => renameCustomerFor(sql, "u-admin", live, "Test Olive #9001"), /is an old account with that name.*Reload the page/);
    assert.equal((await get(sql, live)).name, "Test National Accounts:Test Olive #9001");

    const res = await renameCustomerFor(sql, "u-admin", live, "Test Olive #9001", { confirmMerge: mergeToken(plan) });
    assert.deepEqual(res, { id: live, name: "Test Olive #9001", merged: true, kept: "renamed", filled: [] });
    const kept = await get(sql, live);
    assert.equal(kept.name, "Test Olive #9001", "exactly as typed");
    assert.equal(kept.archived, false);
    for (const [k, v] of Object.entries(LIVE)) assert.equal(kept[k], v, `${k} kept`);
    const gone = await get(sql, old);
    assert.deepEqual([gone.name, gone.archived, gone.removed_at], [`test olive #9001 · merged ${old}`, true, null]);
    assert.equal(await customerOf(sql, "SC-9001"), "Test Olive #9001");
    assert.equal((await sql.query("select customer_id from customer_sales_reps"))[0].customer_id, live, "the sales rep stays");
    assert.deepEqual(await listRemovedCustomersFor(sql), [], "the old record isn't under Removed");
    const log = await sql.query("select entity_id, actor_name, action, detail from activity where entity_type = 'customer' order by id");
    assert.deepEqual(
      log.map((l) => [l.entity_id, l.actor_name, l.action]),
      [
        [live, "adminrole.test", "merged"],
        [old, "adminrole.test", "merged"],
      ],
    );
    assert.match(log[0].detail, /Renamed from “Test National Accounts:Test Olive #9001” to “Test Olive #9001”; the old account “test olive #9001”/);
    assert.equal(renameToast(res), "Renamed to “Test Olive #9001”. The old account with that name was merged into it.");
  } finally {
    await pg.close();
  }
});

test("the old record fills only what the live account has blank; an address block or pin goes whole, a pin only with its address", async () => {
  const { pg, sql } = await fresh();
  try {
    const old = await add(sql, {
      name: "Test Bakery - Main",
      archived: true,
      removed_at: "2026-10-27T17:00:00Z",
      removed_by: "owner.test",
      address: "200 NEW RD.",
      latitude: 30.1,
      longitude: -95.1,
      geocode_match: "street",
      billing_address1: "1 Old St",
      billing_city: "Oldtown",
      billing_state: "TX",
      billing_zip: "77001",
      phone: "555-0199",
      email: "old@example.test",
      account_number: "B-1",
      netsuite_id: "NS-B1",
      parent_account: "Walk - In",
      walk_in: true,
    });
    // Its history is under the name in other capitals; it still moves.
    await call(sql, "SC-B1", "test bakery - main");
    await call(sql, "SC-B2", "TEST BAKERY - MAIN");
    await sql.query("insert into pm_jobs (customer, status) values ('test bakery - main', 'Open')");
    await sql.query("insert into customer_sales_reps (customer_id, rep_name) values ($1, 'Old Rep')", [old]);
    // Same street as the old record's pin (other capitals and punctuation); its own partial billing address.
    const live = await add(sql, { name: "Test Bakery Main Street", address: "200 New Rd", email: "  ", billing_city: "Newtown" });
    await call(sql, "SC-B3", "Test Bakery Main Street");

    const plan = await previewCustomerRenameFor(sql, "u-admin", live, "Test Bakery - Main");
    assert.equal(plan.keep, "renamed");
    assert.deepEqual(plan.filled, ["map pin", "phone", "email", "Account #", "NetSuite ID", "parent account", "assigned sales reps"]);
    assert.deepEqual(plan.moving, { calls: 2, tlcs: 0, pms: 1, installs: 0, deals: 0, equipment: 0, woHistory: 0 });
    assert.equal(plan.other.onRemovedList, true);
    const ask = renameConfirm(plan, () => "Oct 27, 2026");
    assert.equal(ask.title, "Merge the old account “Test Bakery - Main” into this one?");
    assert.equal(ask.token, `${live}>${old}`);
    assert.deepEqual(ask.lines, [
      `“Test Bakery - Main” (#${old}) was removed Oct 27, 2026 by owner.test, and it has the name you typed.`,
      "This account is kept and renamed “Test Bakery - Main”. Its address, pin, sales rep and contacts stay as they are.",
      "Filled in from the old account, only where this one is blank: map pin, phone, email, Account #, NetSuite ID, parent account and assigned sales reps.",
      "Moving here from the old account: 2 calls and 1 PM.",
      "The old account stays off the list, and it won't be under Removed.",
      "To bring the removed account back instead, choose Back, then use Restore under Removed.",
    ]);

    await renameCustomerFor(sql, "u-admin", live, "Test Bakery - Main", { confirmMerge: ask.token });
    const kept = await get(sql, live);
    assert.deepEqual(
      [kept.name, kept.address, kept.billing_address1, kept.billing_city, kept.latitude, kept.longitude, kept.geocode_match],
      ["Test Bakery - Main", "200 New Rd", null, "Newtown", 30.1, -95.1, "street"],
      "its own address and billing stay (no mixing); the pin for the same street comes whole",
    );
    assert.deepEqual(
      [kept.phone, kept.email, kept.account_number, kept.netsuite_id, kept.parent_account, kept.walk_in],
      ["555-0199", "old@example.test", "B-1", "NS-B1", "Walk - In", true],
    );
    assert.deepEqual(
      (await sql.query("select customer from service_jobs order by call_id")).map((r) => r.customer),
      ["Test Bakery - Main", "Test Bakery - Main", "Test Bakery - Main"],
    );
    assert.equal((await sql.query("select customer from pm_jobs"))[0].customer, "Test Bakery - Main");
    assert.equal((await sql.query("select customer_id from customer_sales_reps"))[0].customer_id, live);
    const gone = await get(sql, old);
    assert.deepEqual([gone.archived, gone.removed_at, gone.removed_by], [true, null, null]);
    assert.deepEqual(await listRemovedCustomersFor(sql), [], "off Removed: it was merged, not removed");
  } finally {
    await pg.close();
  }
});

test("an account on the list is kept with its details; blanks are filled from the other, but not a pin for another address", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await add(sql, { name: "Test Diner", address: "1 Diner Way" });
    const dup = await add(sql, {
      name: "Test Diner (old)",
      address: "999 Wrong St",
      phone: "555-0123",
      latitude: 29.5,
      longitude: -95.2,
      geocode_match: "manual",
      account_number: "D-7",
    });
    await call(sql, "SC-D1", "Test Diner (old)");
    // Both serve one provider; only the duplicate has a second one. Each has Out Of Network details and recipes.
    const [p1, p2] = (await sql.query("insert into network_providers (name) values ('Test Provider One'), ('Test Provider Two') returning id")).map((r) => r.id);
    await sql.query(
      "insert into customer_providers (customer, provider_id, role) values ('Test Diner', $1, 'primary'), ('Test Diner (old)', $1, 'secondary'), ('Test Diner (old)', $2, 'additional')",
      [p1, p2],
    );
    await sql.query("insert into network_accounts (customer, contact) values ('Test Diner', 'Kept Contact'), ('Test Diner (old)', 'Dup Contact')");
    await sql.query(
      `insert into recipes (customer, equipment_model, name, notes) values
        ('Test Diner', 'Test Espresso E4', 'House', 'kept house'),
        ('Test Diner (old)', 'Test Espresso E4', 'house', 'dup house'),
        ('Test Diner (old)', 'Test Espresso E4', 'Summer', 'dup summer')`,
    );

    const plan = await planCustomerRename(sql, dup, "Test diner");
    assert.deepEqual([plan.keep, plan.keptId, plan.droppedId, plan.name, plan.filled], ["existing", keep, dup, "Test diner", ["phone", "Account #"]]);
    assert.deepEqual(plan.notes, [
      "This account's map pin isn't copied: it doesn't go with the address on “Test Diner”.",
      "This account's Out Of Network details aren't kept: “Test Diner” has its own.",
      "1 recipe on this account has the same model and name as one on “Test Diner”, so it isn't kept.",
    ]);
    const ask = renameConfirm(plan);
    assert.equal(ask.title, "Merge this account into “Test Diner”?");
    assert.equal(ask.lines[1], "“Test Diner” is kept and renamed “Test diner”. Its details stay as they are.");

    const res = await renameCustomerFor(sql, "u-admin", dup, "Test diner", { confirmMerge: ask.token });
    assert.deepEqual([res.id, res.name, res.merged, res.kept], [keep, "Test diner", true, "existing"]);
    assert.equal(renameToast(res), "Merged into “Test diner”");
    const kept = await get(sql, keep);
    assert.deepEqual(
      [kept.name, kept.address, kept.phone, kept.latitude, kept.account_number],
      ["Test diner", "1 Diner Way", "555-0123", null, "D-7"],
    );
    const gone = await get(sql, dup);
    assert.deepEqual([gone.name, gone.archived, gone.removed_at], [`Test Diner (old) · merged ${dup}`, true, null]);
    assert.equal(await customerOf(sql, "SC-D1"), "Test diner");
    assert.deepEqual(
      (await sql.query("select provider_id, role from customer_providers where lower(customer) = 'test diner' order by provider_id")).map((r) => [r.provider_id, r.role]),
      [
        [p1, "primary"],
        [p2, "additional"],
      ],
      "the kept account's link to the shared provider stays; the other provider moves over",
    );
    assert.deepEqual(await sql.query("select customer, contact from network_accounts"), [{ customer: "Test diner", contact: "Kept Contact" }]);
    assert.deepEqual(
      (await sql.query("select customer, name, notes from recipes order by id")).map((r) => [r.customer, r.name, r.notes]),
      [
        ["Test diner", "House", "kept house"],
        ["Test diner", "Summer", "dup summer"],
      ],
      "a recipe with another name moves; only the same model and name stays the kept account's",
    );
  } finally {
    await pg.close();
  }
});

test("a kept account locked from the clean list keeps its locked name", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await add(sql, { name: "Test Grill", name_locked: true });
    const dup = await add(sql, { name: "Test Grill - Dup" });
    const plan = await planCustomerRename(sql, dup, "TEST GRILL");
    assert.deepEqual([plan.keep, plan.lockedName, plan.name], ["existing", true, "Test Grill"]);
    assert.equal(renameConfirm(plan).lines[1], "“Test Grill” is kept with its locked name. Its details stay as they are.");
    const res = await renameCustomerFor(sql, "u-admin", dup, "TEST GRILL", { confirmMerge: mergeToken(plan) });
    assert.deepEqual([res.id, res.name], [keep, "Test Grill"]);
    assert.equal((await get(sql, keep)).name, "Test Grill");
  } finally {
    await pg.close();
  }
});

test("a case-only rename is a rename, not a merge, and needs no yes", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await add(sql, { name: "test olive #9002", address: "5 Case St" });
    await call(sql, "SC-C1", "test olive #9002");
    const plan = await planCustomerRename(sql, id, "Test Olive #9002");
    assert.deepEqual(plan, { kind: "rename", id, from: "test olive #9002", name: "Test Olive #9002", caseOnly: true });
    assert.equal(renameConfirm(plan), null);
    const res = await renameCustomerFor(sql, "u-admin", id, "Test Olive #9002");
    assert.deepEqual(res, { id, name: "Test Olive #9002", merged: false });
    assert.deepEqual([(await get(sql, id)).name, (await get(sql, id)).address], ["Test Olive #9002", "5 Case St"]);
    assert.equal(await customerOf(sql, "SC-C1"), "Test Olive #9002");
    assert.deepEqual(
      await sql.query("select action, detail from activity where entity_type = 'customer' and entity_id = $1", [id]),
      [{ action: "renamed", detail: "Renamed from “test olive #9002” to “Test Olive #9002”" }],
    );
  } finally {
    await pg.close();
  }
});

test("repair: an account merged the old way gets the live account's details back with two renames", async () => {
  const { pg, sql } = await fresh();
  try {
    // What the old merge left: the old record back on the list (lowercase, blank) holding the calls, and the live
    // account archived with all its details.
    const k = await add(sql, { name: "test olive #9003" });
    const l = await add(sql, { name: "Test National Accounts:Test Olive #9003", archived: true, ...LIVE, account_number: "R-3" });
    await sql.query("insert into customer_sales_reps (customer_id, rep_name) values ($1, 'Test Rep')", [l]);
    await call(sql, "SC-R1", "test olive #9003");

    // 1. Rename the survivor to the archived account's name: the survivor stays, and fills its blanks from it.
    const plan = await planCustomerRename(sql, k, "Test National Accounts:Test Olive #9003");
    assert.deepEqual([plan.keep, plan.keptId, plan.droppedId], ["renamed", k, l]);
    assert.deepEqual(plan.filled, ["address", "map pin", "primary sales rep", "primary contact", "phone", "email", "Account #", "NetSuite ID", "assigned sales reps"]);
    await renameCustomerFor(sql, "u-admin", k, "Test National Accounts:Test Olive #9003", { confirmMerge: mergeToken(plan) });
    // 2. Then the name it should have: a plain rename.
    assert.equal((await planCustomerRename(sql, k, "Test Olive #9003")).kind, "rename");
    await renameCustomerFor(sql, "u-admin", k, "Test Olive #9003");

    const fixed = await get(sql, k);
    assert.equal(fixed.name, "Test Olive #9003");
    for (const [key, v] of Object.entries({ ...LIVE, account_number: "R-3" })) assert.equal(fixed[key], v, `${key} back`);
    assert.equal(await customerOf(sql, "SC-R1"), "Test Olive #9003");
    assert.equal((await sql.query("select customer_id from customer_sales_reps"))[0].customer_id, k);
    assert.equal((await get(sql, l)).name, `Test National Accounts:Test Olive #9003 · merged ${l}`);
  } finally {
    await pg.close();
  }
});

test("a yes is for one merge: another account, or the other direction after a change, is refused", async () => {
  const { pg, sql } = await fresh();
  try {
    const grill = await add(sql, { name: "Test Probe Grill", address: "1 Probe Rd" });
    const other = await add(sql, { name: "Test Probe Other" });
    const live = await add(sql, { name: "Test Probe Grill - Live" });
    const before = await yes(sql, live, "Test Probe Grill");
    assert.equal(before, `${grill}>${live}`, "the window asks to merge this account into the one on the list");
    // A yes for another merge doesn't carry over.
    await assert.rejects(
      () => renameCustomerFor(sql, "u-admin", other, "Test Probe Grill", { confirmMerge: before }),
      /These accounts changed since the merge question/,
    );
    // Someone removes Test Probe Grill before the yes: now the renamed account would be kept instead, so it's refused.
    await sql.query("update directory_customers set archived = true, removed_at = now(), removed_by = 'owner.test' where id = $1", [grill]);
    await assert.rejects(
      () => renameCustomerFor(sql, "u-admin", live, "Test Probe Grill", { confirmMerge: before }),
      /These accounts changed since the merge question/,
    );
    assert.deepEqual([(await get(sql, grill)).name, (await get(sql, live)).name], ["Test Probe Grill", "Test Probe Grill - Live"], "nothing changed");
  } finally {
    await pg.close();
  }
});

test("only the Admin role or a desk admin can preview or rename; the batch flows keep the live account too", async () => {
  const { pg, sql } = await fresh();
  try {
    const old = await add(sql, { name: "Test Cafe X", archived: true });
    const live = await add(sql, { name: "Test Cafe X - Live" });
    await assert.rejects(() => previewCustomerRenameFor(sql, "u-tech", live, "Test Cafe X"), /Only an admin can rename or merge customers/);
    await assert.rejects(() => renameCustomerFor(sql, "u-tech", live, "Test Cafe Z"), /Only an admin can rename or merge customers/);
    assert.equal((await get(sql, old)).name, "Test Cafe X", "nothing changed");
    // Clean Names and WO History rename with force: the same rule, the live account is kept.
    const res = await renameOrMergeCustomer(sql, live, "Test Cafe X", { force: true });
    assert.deepEqual([res.id, res.kept], [live, "renamed"]);
  } finally {
    await pg.close();
  }
});

test("two accounts off the list: the one renamed is kept, unless its Account # is on the list now", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await add(sql, { name: "Test Off A", archived: true, account_number: "OFF-1" });
    const b = await add(sql, { name: "Test Off B", archived: true });
    const plan = await planCustomerRename(sql, a, "Test Off B");
    assert.deepEqual([plan.keep, plan.keptId], ["renamed", a]);
    // Meanwhile OFF-1 went on an account on the list: bringing A back would clash, so nothing happens.
    await add(sql, { name: "Test On C", account_number: "off-1" });
    await assert.rejects(() => renameOrMergeCustomer(sql, a, "Test Off B", { force: true }), /would come back on the list, but its Account # OFF-1 is on “Test On C” now/);
    assert.deepEqual([(await get(sql, a)).name, (await get(sql, b)).name], ["Test Off A", "Test Off B"]);
  } finally {
    await pg.close();
  }
});
