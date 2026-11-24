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

test("matchName: exact, other capitals, several, punctuation only, none, walk-in, blank", () => {
  const ix = LC.indexAccounts([
    { id: 1, name: "Zz Cafe", archived: false },
    { id: 2, name: "Zz Twins", archived: false },
    { id: 3, name: "ZZ TWINS", archived: false },
    { id: 4, name: "Zz Bar-Grill", archived: true },
  ]);
  const m = (s) => [LC.matchName(s, ix).match, LC.matchName(s, ix).accounts.map((a) => a.id)];
  assert.deepEqual(m("Zz Cafe"), ["exact", [1]]);
  assert.deepEqual(m(" zz cafe "), ["case", [1]]);
  assert.deepEqual(m("zz twins"), ["several", [2, 3]]);
  assert.deepEqual(m("Zz Twins"), ["exact", [2]]);
  assert.deepEqual(m("Zz Bar Grill"), ["loose", [4]]);
  assert.deepEqual(m("Zz Nowhere"), ["none", []]);
  assert.deepEqual(m("Walk-In"), ["walkin", []]);
  assert.deepEqual(m("  "), ["blank", []]);
});

test("reportNameLink counts rows by match, lists samples and archived accounts", () => {
  const ix = LC.indexAccounts([
    { id: 1, name: "Zz Cafe", archived: false },
    { id: 2, name: "Zz Old · merged 1", archived: true },
  ]);
  const r = LC.reportNameLink({ table: "t", column: "c", label: "T", rewritten: true }, [
    { name: "Zz Cafe", n: 5 },
    { name: "zz cafe", n: 2 },
    { name: "Zz Gone", n: 3 },
    { name: "Zz Old · merged 1", n: 1 },
    { name: null, n: 4 },
  ], ix);
  assert.deepEqual([r.rows, r.names], [15, 5]);
  assert.equal(r.byMatch.exact, 6);
  assert.equal(r.byMatch.case, 2);
  assert.equal(r.byMatch.none, 3);
  assert.equal(r.byMatch.blank, 4);
  assert.equal(r.archivedRows, 1);
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
