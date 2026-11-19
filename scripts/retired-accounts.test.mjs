// Inactive and Retired accounts (Jesus, 11/19): hidden from pickers, labeled, no new tickets, installs or PMs (on the
// server), an Admin can make one active again, and the NetSuite import never quietly sets a retired account Active.
// Made-up names only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";

const { assertTakesNewWork, inactiveLabel } = await import("../src/lib/ops/retired-accounts.ts");
const { makeAccountActiveFor, MAKE_ACTIVE_ADMIN_ONLY } = await import("../src/lib/ops/retired-accounts-api.ts");
const { openTicketFor, searchAllFor } = await import("../src/lib/ops/api.ts");
const { readNetsuiteMatrix, planNetsuiteCustomers } = await import("../src/lib/ops/netsuite-customers.ts");

const dir = new URL("../migrations/", import.meta.url);

async function fresh() {
  const pg = new PGlite();
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query(`insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin')`);
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await sql.query("insert into directory_customers (name) values ('Test Cafe'), ('Test Cafe - North'), ('Test Diner')");
  // Retired by the history import, and Inactive in NetSuite.
  await sql.query("update directory_customers set inactive = true, retired_at = now() where name = 'Test Cafe - North'");
  await sql.query("update directory_customers set inactive = true where name = 'Test Diner'");
  return { pg, sql };
}

test("an inactive or Retired account takes no new ticket, install or PM; an active account does", async () => {
  const { sql } = await fresh();
  await assertTakesNewWork(sql, "Test Cafe", "ticket");
  await assert.rejects(assertTakesNewWork(sql, "test cafe - north", "install"), /“Test Cafe - North” is Retired, so it can't take a new install/);
  await assert.rejects(assertTakesNewWork(sql, "Test Diner", "pm"), /Inactive in NetSuite, so it can't take a new PM/);
  await assert.rejects(openTicketFor(sql, { kind: "service", customer: "Test Cafe - North", received: "2026-11-19" }), /Retired/);
  const ok = await openTicketFor(sql, { kind: "service", customer: "Test Cafe", received: "2026-11-19" });
  assert.equal(ok.customer, "Test Cafe");
  assert.equal(inactiveLabel({ inactive: true, retiredAt: "x" }), "Retired");
  assert.equal(inactiveLabel({ inactive: true, retiredAt: null }), "Inactive");
  assert.equal(inactiveLabel({ inactive: false, retiredAt: null }), null);
});

test("every way to make a ticket, install or PM checks on the server; pickers leave inactive accounts out", () => {
  const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  const body = (name) => {
    const at = api.search(new RegExp(`(export const ${name} =|async function ${name}\\()`));
    assert.ok(at >= 0, name);
    return api.slice(at, at + 4000);
  };
  assert.match(body("openTicketFor"), /assertTakesNewWork\(sql, customer, "ticket"\)/);
  assert.match(body("createPm"), /assertTakesNewWork\(sql, data\.customer, "pm"\)/);
  assert.match(body("createInstall"), /assertTakesNewWork\(sql, data\.customer, "install"\)/);
  assert.match(body("confirmDealMachines"), /assertTakesNewWork\(sql, deal\.customer, "install"\)/);
  assert.match(body("linkOrMakeInstall"), /assertTakesNewWork\(sql, deal\.customer, "install"\)/);
  assert.match(body("listDirectory"), /inactive = false/);
  assert.match(body("listCustomers"), /archived = false and inactive = false/);
});

test("search finds a Retired account by name and labels it", async () => {
  const { sql } = await fresh();
  const hits = (await searchAllFor(sql, { q: "Test" }, { userId: "u-owner" })).filter((h) => h.entityType === "customer");
  assert.deepEqual(hits.map((h) => [h.title, h.status]), [
    ["Test Cafe", null],
    ["Test Cafe - North", "Retired"],
    ["Test Diner", "Inactive"],
  ]);
});

test("only an Admin makes an account active again; then it takes new work", async () => {
  const { pg, sql } = await fresh();
  const id = (await pg.query("select id from directory_customers where name = 'Test Cafe - North'")).rows[0].id;
  await assert.rejects(makeAccountActiveFor(sql, { id, admin: false, who: "tech" }), new RegExp(MAKE_ACTIVE_ADMIN_ONLY));
  assert.deepEqual(await makeAccountActiveFor(sql, { id, admin: true, who: "chuy" }), { name: "Test Cafe - North" });
  assert.deepEqual((await pg.query("select inactive, retired_at from directory_customers where id = $1", [id])).rows[0], { inactive: false, retired_at: null });
  await assertTakesNewWork(sql, "Test Cafe - North", "ticket");
  await assert.rejects(makeAccountActiveFor(sql, { id, admin: true, who: "chuy" }), /isn't inactive/);
  const log = (await pg.query("select detail from activity where entity_type = 'customer' and entity_id = $1", [id])).rows;
  assert.match(log[0].detail, /Made active again \(was Retired\)/);
});

test("the NetSuite import leaves a Retired account Retired when the file says Active, and says so", () => {
  const head = ["Internal ID", "Company Name", "Inactive"];
  const rows = readNetsuiteMatrix([head, ["10", "Test Cafe - North", "No"], ["11", "Test Diner", "No"]]).rows;
  const acct = (id, name, retired) => ({
    id,
    name,
    archived: false,
    updatedAt: "2026-11-19 00:00:00+00",
    netsuiteId: String(id),
    accountNumber: null,
    address: null,
    billing: { line1: null, line2: null, city: null, state: null, zip: null, country: null },
    primaryContact: null,
    phone: null,
    email: null,
    inactive: true,
    retired,
  });
  const lines = planNetsuiteCustomers(rows, [acct(10, "Test Cafe - North", true), acct(11, "Test Diner", false)]);
  const north = lines.find((l) => l.accountName === "Test Cafe - North");
  assert.ok(!north.changes.some((c) => c.field === "inactive"), "no change to Active");
  assert.match(north.notes.join(" "), /stays Retired/);
  const diner = lines.find((l) => l.accountName === "Test Diner");
  assert.deepEqual(diner.changes.find((c) => c.field === "inactive")?.after, "Active", "NetSuite Inactive still follows NetSuite");
});
