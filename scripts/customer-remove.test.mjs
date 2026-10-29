// Customers cleanup (10/26, Chuy): Remove for one account or a selection, any account with or without an Account
// Number; Removed lists them with who and when; Restore brings them back; imports never bring a removed account back;
// Clean Names lines are done once decided or once their account is removed; Possible Duplicates' Not a Duplicate.
// All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { removeCustomersFor, restoreCustomersFor, listRemovedCustomersFor } = await import("../src/lib/ops/customer-remove-api.ts");
const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");
const { accountNameFor, previewCorrigoRecords, applyCorrigoRows } = await import("../src/lib/ops/corrigo-import.ts");
const { parseCorrigoMatrix } = await import("../src/lib/ops/corrigo.ts");
const { readReport } = await import("../src/lib/ops/clean-names-api.ts");
const { cleanLineDone } = await import("../src/lib/ops/clean-names.ts");
const { possibleDuplicatesFor, setDupeDismissedFor, pairIds } = await import("../src/lib/ops/customer-review-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    "insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin'), ('u-tech', 'melinda', true, false, 'service')",
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}
const account = async (sql, name, extra = {}) =>
  (
    await sql.query(
      "insert into directory_customers (name, account_number, removal_flag, archived) values ($1, $2, $3, $4) returning id",
      [name, extra.number ?? null, !!extra.flagged, !!extra.archived],
    )
  )[0].id;
const row = async (sql, id) =>
  (await sql.query("select name, archived, removal_flag, removed_by, removed_at is not null as stamped from directory_customers where id = $1", [id]))[0];

test("Remove takes any account off the list, with or without an Account Number, and records who and when", async () => {
  const { pg, sql } = await fresh();
  try {
    const alpha = await account(sql, "Alpha Coffee", { number: "1001" });
    const plain = await account(sql, "No Number Cafe", { flagged: true });
    const keep = await account(sql, "Keep Me");
    await sql.query("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-1', 'Alpha Coffee', 'Completed')");

    await assert.rejects(() => removeCustomersFor(sql, "u-tech", [alpha]), /Only an admin can add or remove customers/);
    const res = await removeCustomersFor(sql, "u-owner", [alpha, plain, alpha, 999999]);
    assert.deepEqual(res.removed.map((r) => r.name), ["Alpha Coffee", "No Number Cafe"]);
    assert.deepEqual(await row(sql, alpha), { name: "Alpha Coffee", archived: true, removal_flag: false, removed_by: "chuy", stamped: true });
    assert.deepEqual(await row(sql, plain), { name: "No Number Cafe", archived: true, removal_flag: false, removed_by: "chuy", stamped: true }, "no Account Number: removed too, its flag cleared");
    assert.equal((await row(sql, keep)).archived, false);
    const log = await sql.query("select entity_id, actor_name, detail from activity where entity_type = 'customer' and action = 'removed' order by entity_id");
    assert.deepEqual(log, [
      { entity_id: alpha, actor_name: "chuy", detail: "Removed from Customers" },
      { entity_id: plain, actor_name: "chuy", detail: "Removed from Customers" },
    ]);
    // Nothing is deleted: the call keeps the name.
    assert.equal((await sql.query("select customer from service_jobs where call_id = 'SC-1'"))[0].customer, "Alpha Coffee");
    // Removing again changes nothing.
    assert.deepEqual((await removeCustomersFor(sql, "u-owner", [alpha])).removed, []);

    const removed = await listRemovedCustomersFor(sql);
    assert.deepEqual(
      removed.map((r) => [r.name, r.removedBy, r.accountNumber, r.history]),
      [
        ["No Number Cafe", "chuy", null, 0],
        ["Alpha Coffee", "chuy", "1001", 1],
      ],
      "newest first (same moment: the later account first), with the history still under each name",
    );
    // An Account Number freed by a removal can go on another account.
    await sql.query("insert into directory_customers (name, account_number) values ('Alpha Two', '1001')");
  } finally {
    await pg.close();
  }
});

test("Removed lists only what Remove took off: a merged account and an older removal aren't on it", async () => {
  const { pg, sql } = await fresh();
  try {
    await account(sql, "Main Shop");
    const dup = await account(sql, "Dup Shop");
    await renameOrMergeCustomer(sql, dup, "Main Shop");
    assert.equal((await row(sql, dup)).archived, true, "merged away");
    await account(sql, "Removed Long Ago", { archived: true });
    assert.deepEqual(await listRemovedCustomersFor(sql), []);
  } finally {
    await pg.close();
  }
});

test("Restore brings accounts back; one whose name or Account Number is on the list now stays removed, with the reason", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await account(sql, "Able Cafe", { number: "2001" });
    const b = await account(sql, "Baker Cafe", { number: "2002" });
    const c = await account(sql, "Corner Cafe");
    const d = await account(sql, "Same Name");
    const e1 = await account(sql, "Echo One", { number: "3003" });
    const e2 = await account(sql, "Echo Two", { number: "3003", archived: true });
    await sql.query("update directory_customers set removed_at = now(), removed_by = 'chuy' where id = $1", [e2]);
    await removeCustomersFor(sql, "u-owner", [a, b, c, d, e1]);
    // Meanwhile: 2002 went on another account, and "same name" was added in another spelling.
    await sql.query("insert into directory_customers (name, account_number) values ('Other Cafe', '2002'), ('same name', null)");
    const merged = await account(sql, "Merged Away", { archived: true });

    await assert.rejects(() => restoreCustomersFor(sql, "u-tech", [a]), /Only an admin/);
    const res = await restoreCustomersFor(sql, "u-owner", [a, b, c, d, e1, e2, merged]);
    assert.deepEqual(res.restored.map((r) => r.name), ["Able Cafe", "Corner Cafe", "Echo One"]);
    assert.deepEqual(
      res.skipped.map((s) => [s.name, s.why]),
      [
        ["Baker Cafe", "Account # 2002 is on “Other Cafe” now"],
        ["Echo Two", "Account # 3003 is on “Echo One” now"],
        ["Same Name", "“same name” is on the list with that name"],
      ],
    );
    assert.deepEqual(await row(sql, a), { name: "Able Cafe", archived: false, removal_flag: false, removed_by: null, stamped: false });
    assert.equal((await row(sql, b)).archived, true);
    assert.equal((await row(sql, merged)).archived, true, "a merged account isn't restored");
    assert.deepEqual(
      (await sql.query("select entity_id from activity where entity_type = 'customer' and action = 'restored' order by entity_id")).map((r) => r.entity_id),
      [a, c, e1],
    );
    assert.deepEqual((await listRemovedCustomersFor(sql)).map((r) => r.name).sort(), ["Baker Cafe", "Echo Two", "Same Name"]);
  } finally {
    await pg.close();
  }
});

test("a Corrigo report never brings a removed account back; the ticket still saves under the report's name", async () => {
  const { pg, sql } = await fresh();
  try {
    const cafe = await account(sql, "Cafe A", { number: "4004" });
    await sql.query(
      "insert into service_jobs (kind, call_id, customer, wo, status, done) values ('service', 'SC-WO-0772', 'Cafe A', 'WO-0772', 'In Progress', false)",
    );
    await removeCustomersFor(sql, "u-owner", [cafe]);
    const { records } = parseCorrigoMatrix([
      ["ST#", "Operational Status", "Date/Time Completed", "Customer Name"],
      ["0772", "Completed", "10/19/2026", "Cafe A"],
    ]);
    const preview = await previewCorrigoRecords(sql, records);
    await applyCorrigoRows(sql, preview.rows, "Chuy");
    assert.deepEqual(await row(sql, cafe), { name: "Cafe A", archived: true, removal_flag: false, removed_by: "chuy", stamped: true });
    const job = (await sql.query("select id, customer from service_jobs where wo = 'WO-0772'"))[0];
    assert.equal(job.customer, "Cafe A");
    const applied = await sql.query("select detail from activity where entity_id = $1 and action = 'corrigo'", [job.id]);
    assert.equal(applied.length, 1, "the row was applied to the ticket");

    // The import never adds an account (10/28): a name KatzDesk doesn't have, Walk-In and a removed name are no account.
    assert.equal(await accountNameFor(sql, "Brand New Cafe"), null);
    assert.equal(await accountNameFor(sql, "Walk-In"), null);
    assert.equal(await accountNameFor(sql, "cafe a"), null, "removed accounts aren't matched");
    const names = (await sql.query("select name, archived from directory_customers order by id")).map((r) => [r.name, r.archived]);
    assert.deepEqual(names, [["Cafe A", true]]);
  } finally {
    await pg.close();
  }
});

test("Clean Names: a line is done once decided, or once its account is off Customers", async () => {
  assert.equal(cleanLineDone({ status: "pending" }), false);
  assert.equal(cleanLineDone({ status: "unlocked" }), false, "an unlocked name waits for a decision");
  for (const status of ["apply", "locked", "kept", "skipped", "removal"]) assert.equal(cleanLineDone({ status }), true, status);
  assert.equal(cleanLineDone({ status: "pending", accountRemoved: true }), true);

  const { pg, sql } = await fresh();
  try {
    const gone = await account(sql, "Gone Grill");
    const here = await account(sql, "Here Diner");
    const run = (await sql.query("insert into customer_clean_runs (filename, created_by, row_count) values ('clean.xlsx', 'chuy', 2) returning id"))[0].id;
    await sql.query(
      `insert into customer_clean_items (run_id, kind, customer_id, katz_name, reason, status)
       values ($1, 'no_match', $2, 'Gone Grill', 'Nothing like it on the list', 'pending'),
              ($1, 'no_match', $3, 'Here Diner', 'Nothing like it on the list', 'pending')`,
      [run, gone, here],
    );
    await removeCustomersFor(sql, "u-owner", [gone]);
    const report = await readReport(sql, true);
    const byName = Object.fromEntries(report.items.map((i) => [i.katzName, i]));
    assert.equal(byName["Gone Grill"].accountRemoved, true);
    assert.equal(cleanLineDone(byName["Gone Grill"]), true, "it leaves No Match until Show Done is on");
    assert.equal(byName["Here Diner"].accountRemoved, false);
    assert.equal(cleanLineDone(byName["Here Diner"]), false);
  } finally {
    await pg.close();
  }
});

test("Possible Duplicates: Not a Duplicate takes a pair off the report, Undo brings it back; admins only", async () => {
  const { pg, sql } = await fresh();
  try {
    await sql.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-role', 'ana', true, false, 'admin')");
    const old = (await sql.query("insert into directory_customers (name, address) values ('Joe''s Coffee', '12 Elm Street, Houston, TX 77002') returning id"))[0].id;
    const added = (await sql.query("insert into directory_customers (name, address) values ('Joes Coffee LLC', '12 Elm St, Houston, TX 77002') returning id"))[0].id;
    await sql.query("insert into customer_import_runs (source, filename, created, created_by) values ('netsuite', 'ns.csv', 1, 'chuy')");
    await sql.query(
      "insert into activity (entity_type, entity_id, actor_name, action, detail) values ('customer', $1, 'chuy', 'added', 'Added by the NetSuite import (NetSuite ID 9001)')",
      [added],
    );
    const before = await possibleDuplicatesFor(sql);
    assert.equal(before.pairs.length, 1);
    assert.deepEqual(before.dismissed, []);
    assert.deepEqual(pairIds(added, old), [old, added]);

    await assert.rejects(() => setDupeDismissedFor(sql, "u-tech", { aId: added, bId: old, dismissed: true }), /Only an Admin can mark possible duplicates/);
    await setDupeDismissedFor(sql, "u-role", { aId: added, bId: old, dismissed: true });
    await setDupeDismissedFor(sql, "u-owner", { aId: old, bId: added, dismissed: true });
    const after = await possibleDuplicatesFor(sql);
    assert.deepEqual(after.pairs, []);
    assert.deepEqual([after.counts.high, after.counts.medium, after.counts.low], [0, 0, 0]);
    assert.equal(after.dismissed.length, 1);
    assert.equal(after.dismissed[0].dismissedBy, "ana", "the first mark stands");
    assert.equal(after.dismissed[0].added.id, added);
    // The accounts themselves didn't change.
    assert.deepEqual((await sql.query("select count(*)::int as n from directory_customers where archived = false"))[0].n, 2);

    await setDupeDismissedFor(sql, "u-owner", { aId: added, bId: old, dismissed: false });
    const undone = await possibleDuplicatesFor(sql);
    assert.equal(undone.pairs.length, 1);
    assert.deepEqual(undone.dismissed, []);

    await removeCustomersFor(sql, "u-owner", [old]);
    await assert.rejects(() => setDupeDismissedFor(sql, "u-owner", { aId: added, bId: old, dismissed: true }), /no longer on the list/);
    assert.deepEqual((await possibleDuplicatesFor(sql)).pairs, [], "a removed account is never a possible duplicate");
  } finally {
    await pg.close();
  }
});
