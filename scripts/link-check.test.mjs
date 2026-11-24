// Link Check (Phase 0 of "One Record Per Machine Plan", Chuy 11/24): a read-only look at how records point at customers
// and machines. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const LC = await import("../src/lib/ops/link-check.ts");

async function db() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  const q = async (t, p) => (await pg.query(t, p)).rows;
  await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin'), ('zz-tech', 'zztech', true, false, 'tech')");
  return { pg, q, sql: { query: q } };
}

test("matchName: listed accounts first; capitals, spaces as Postgres trims them, several, punctuation, removed only", () => {
  const ix = LC.indexAccounts([
    { id: 1, name: "Zz Cafe", archived: false },
    { id: 2, name: "Zz Twins", archived: false },
    { id: 3, name: "ZZ TWINS", archived: false },
    { id: 4, name: "Zz Bar-Grill", archived: false },
    { id: 5, name: "Zz Dash-Co", archived: true },
    { id: 6, name: "Zz Dash Co", archived: false },
    { id: 7, name: "Zz Gone · merged 1", archived: true, merged: true },
  ]);
  const m = (s) => [LC.matchName(s, ix).match, LC.matchName(s, ix).accounts.map((a) => a.id)];
  assert.deepEqual(m("Zz Cafe"), ["exact", [1]]);
  assert.deepEqual(m("zz cafe"), ["case", [1]]);
  assert.deepEqual(m(" zz cafe "), ["trimmed", [1]]);
  // A no-break space or a newline is not what Postgres btrim drops: no account by that.
  assert.deepEqual(m("Zz Cafe\u00a0"), ["loose", [1]]);
  assert.deepEqual(m("zz twins"), ["several", [2, 3]]);
  assert.deepEqual(m("Zz Twins"), ["exact", [2]]);
  assert.deepEqual(m("Zz Bar Grill"), ["loose", [4]]);
  // The listed account wins over a removed one with that very name.
  assert.deepEqual(m("zz dash-co"), ["loose", [6]]);
  assert.deepEqual(m("Zz Gone · merged 1"), ["archivedOnly", [7]]);
  assert.deepEqual(m("Zz Nowhere"), ["none", []]);
  assert.deepEqual(m("Walk-In"), ["walkin", []]);
  assert.deepEqual(m("  "), ["blank", []]);
});

test("reportNameLink counts rows by match, lists samples, and rows on Inactive accounts", () => {
  const ix = LC.indexAccounts([
    { id: 1, name: "Zz Cafe", archived: false },
    { id: 2, name: "Zz Old · merged 1", archived: true, merged: true },
    { id: 3, name: "Zz Sleepy", archived: false, inactive: true },
  ]);
  const r = LC.reportNameLink({ table: "t", column: "c", label: "T", rewritten: true }, [
    { name: "Zz Cafe", n: 5 },
    { name: "zz cafe", n: 2 },
    { name: "Zz Gone", n: 3 },
    { name: "Zz Old · merged 1", n: 1 },
    { name: "Zz Sleepy", n: 6 },
    { name: null, n: 4 },
  ], ix);
  assert.deepEqual([r.rows, r.names], [21, 5]);
  assert.deepEqual([r.byMatch.exact, r.byMatch.case, r.byMatch.none, r.byMatch.archivedOnly, r.byMatch.blank], [11, 2, 3, 1, 4]);
  assert.equal(r.inactiveRows, 6);
  assert.deepEqual(r.samples.none, [{ name: "Zz Gone", rows: 3, accounts: [] }]);
  assert.equal(r.samples.archived[0].name, "Zz Old · merged 1");
});

test("Link Check is for admins only and writes nothing", async () => {
  const { pg, q, sql } = await db();
  try {
    await assert.rejects(LC.linkCheckFor(sql, "zz-tech"), new RegExp(LC.LINK_CHECK_ADMIN_ONLY.replace(/\./g, "\\.")));
    await q("insert into directory_customers (name) values ('Zz Cafe'), ('Zz Bar')");
    const before = await q("select count(*)::int as n from directory_customers");
    const r = await LC.linkCheckFor(sql, "zz-admin");
    assert.ok(r.at);
    assert.deepEqual(await q("select count(*)::int as n from directory_customers"), before);
  } finally {
    await pg.close();
  }
});

test("Link Check on made-up data: name links per table, machines, serials across warehouse and accounts", async () => {
  const { pg, q, sql } = await db();
  try {
    await q("insert into directory_customers (name) values ('Zz Cafe'), ('Zz Bar')");
    for (const [i, c] of ["Zz Cafe", "zz cafe", "Zz Gone", "Walk-In"].entries())
      await q("insert into service_jobs (kind, call_id, customer, status) values ('service', $1, $2, 'Open')", [`SC-ZZ${i}`, c]);
    const unit = (customer, serial, key) =>
      q("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, 'Zz Grinder', 'G', $2, $3)", [customer, serial, key]);
    await unit("Zz Cafe", "ZZ-100", "zz-100");
    await unit("Zz Cafe", null, null);
    await unit("Zz Bar", "ZZ-200", "stale");
    const asset = (serial, status) => q("insert into assets (kind, model, serial, site, status) values ('equip', 'Zz Grinder', $1, 'Barn', $2)", [serial, status]);
    await asset("ZZ-100", "deployed");
    await asset("ZZ-300", "ready");
    await asset("ZZ-200", "sold");
    const r = await LC.linkCheckFor(sql, "zz-admin");

    const tickets = r.nameLinks.find((l) => l.table === "service_jobs");
    assert.deepEqual([tickets.byMatch.exact, tickets.byMatch.case, tickets.byMatch.none, tickets.byMatch.walkin], [1, 1, 1, 1]);
    assert.deepEqual(tickets.samples.none.map((s) => s.name), ["Zz Gone"]);
    const equip = r.nameLinks.find((l) => l.table === "account_equipment");
    assert.equal(equip.byMatch.exact, 3);

    assert.deepEqual(r.machines.accountUnits, { total: 3, withSerial: 2, noSerial: 1, staleKey: 1, locked: 0 });
    assert.deepEqual([r.machines.warehouse.total, r.machines.warehouse.withSerial], [3, 3]);
    // zz-100: account + deployed (both active). stale key "stale" on the account; zz-200 sold only. zz-300 warehouse only.
    assert.equal(r.machines.serials.bothActive, 1);
    assert.equal(r.machines.serials.warehouseOnly, 2);
    assert.equal(r.machines.serials.accountOnly, 1);
    assert.equal(r.accounts.total, 2);
    assert.equal(r.machines.installLists.rowsDangling, 0);
    assert.ok(r.tableRows.find((t) => t.table === "service_jobs").rows >= 4);
    // Every table it names exists on this schema, or is reported missing rather than failing.
    assert.ok(r.nameLinks.every((l) => typeof l.present === "boolean"));
  } finally {
    await pg.close();
  }
});

test("the page is wired: route, server function, admin link", () => {
  const route = readFileSync(new URL("../src/routes/_app/link-check.tsx", import.meta.url), "utf8");
  assert.match(route, /createFileRoute\("\/_app\/link-check"\)/);
  assert.match(route, /getLinkCheck\(\)/);
  const mism = readFileSync(new URL("../src/routes/_app/unit-mismatches.tsx", import.meta.url), "utf8");
  assert.match(mism, /to="\/link-check"/);
});

test("review: accounts read from the database: removed, merged away, Retired and Inactive", async () => {
  const { pg, q, sql } = await db();
  try {
    await q("insert into directory_customers (name) values ('Zz Live'), ('Zz Removed'), ('Zz Gone · merged 7'), ('Zz Retired'), ('Zz Inactive')");
    await q("update directory_customers set archived = true where name in ('Zz Removed', 'Zz Gone · merged 7')");
    await q("update directory_customers set inactive = true, retired_at = now() where name = 'Zz Retired'");
    await q("update directory_customers set inactive = true where name = 'Zz Inactive'");
    for (const [i, c] of ["Zz Removed", "Zz Gone · merged 7", "Zz Retired", "Zz Live"].entries())
      await q("insert into service_jobs (kind, call_id, customer, status) values ('service', $1, $2, 'Open')", [`SC-ZR${i}`, c]);
    const r = await LC.linkCheckFor(sql, "zz-admin");
    assert.deepEqual([r.accounts.listed, r.accounts.inactive, r.accounts.retired, r.accounts.archived, r.accounts.merged], [3, 1, 1, 1, 1]);
    const t = r.nameLinks.find((l) => l.table === "service_jobs");
    assert.deepEqual([t.byMatch.exact, t.byMatch.archivedOnly, t.inactiveRows], [2, 2, 1]);
  } finally {
    await pg.close();
  }
});

test("review: install lists count rows with a machine, and a unit link to a unit that's gone", async () => {
  const { pg, q, sql } = await db();
  try {
    await q("insert into directory_customers (name) values ('Zz Cafe')");
    const [u] = await q("insert into account_equipment (customer, catalog_model, equipment_name) values ('Zz Cafe', 'Zz Grinder', 'G') returning id");
    await q("insert into installs (customer, equipment, machines) values ('Zz Cafe', 'G', $1), ('Zz Cafe', 'G', '[ ]'), ('Zz Cafe', 'G', 'typed text')", [
      JSON.stringify([{ equipment: "Zz Grinder", unitId: u.id }, { equipment: "Zz Brewer", unitId: 999999 }, { equipment: "Zz Kettle" }, { equipment: " " }]),
    ]);
    const r = await LC.linkCheckFor(sql, "zz-admin");
    assert.deepEqual(r.machines.installLists, { installs: 1, rows: 3, rowsWithoutUnit: 1, rowsDangling: 1 });
  } finally {
    await pg.close();
  }
});
