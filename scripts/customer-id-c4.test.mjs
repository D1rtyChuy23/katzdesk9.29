// Customers by id, phase C4 ("One Record Per Machine Plan", Chuy approved 11/24): rename and merge go by the account's
// id. A rename moves every record linked to the account (names with spaces at the ends too) and never one the rule
// gives another account; a merge moves the merged-away account's records, history rows included, onto the kept one by
// id, and history rows keep the name they had (choice 2). Migration 0147 links an invoice whose name finds no account
// to its ticket's, PM's, install's, rebuild's or deal's account. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { renameOrMergeCustomer, planCustomerRename } = await import("../src/lib/ops/customer-identity.ts");
const { linkCheckFor } = await import("../src/lib/ops/link-check.ts");

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
const C4 = "0147_customer_id_c4.sql";

async function beforeC4() {
  const pg = new PGlite();
  for (const f of files.filter((f) => f < C4)) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  // Live also has names unique in any capitals (seed.server.ts).
  await pg.exec("create unique index if not exists directory_customers_name_lower_uidx on directory_customers (lower(name))");
  const q = async (t, p) => (await pg.query(t, p)).rows;
  const runC4 = async () => {
    for (const f of files.filter((f) => f >= C4 && f < "0148")) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  };
  return { pg, q, runC4, sql: { query: q } };
}
async function all() {
  const b = await beforeC4();
  await b.runC4();
  for (const f of files.filter((f) => f >= "0148")) await b.pg.exec(readFileSync(new URL(f, dir), "utf8"));
  await b.q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
  return b;
}
const accounts = async (q) => {
  await q("insert into directory_customers (name) values ('Zz Cafe'), ('Zz Bar-Grill'), ('Zz Other')");
  return Object.fromEntries((await q("select id, name from directory_customers")).map((r) => [r.name, r.id]));
};

let seq = 0;
const runId = async (q) => (await q("insert into wo_history_runs (filename) values ('zz.csv') returning id"))[0].id;
const providerId = async (q) => (await q("insert into network_providers (name) values ($1) returning id", [`Zz Provider ${++seq}`]))[0].id;
const moduleId = async (q) => (await q("insert into modules (module_id) values ($1) returning id", [`ZZM-${++seq}`]))[0].id;

/** Every name column that follows its account on a rename (C1, C2, C3), and how to add a row under a name. */
const FOLLOW = [
  { table: "service_jobs", name: "customer", id: "customer_id", add: (q, v) => q("insert into service_jobs (kind, call_id, customer, status) values ('service', $1, $2, 'Open') returning *", [`SC-ZZ${++seq}`, v]) },
  { table: "pm_jobs", name: "customer", id: "customer_id", add: (q, v) => q("insert into pm_jobs (customer) values ($1) returning *", [v]) },
  { table: "installs", name: "customer", id: "customer_id", add: (q, v) => q("insert into installs (customer, equipment) values ($1, 'G') returning *", [v]) },
  { table: "deals", name: "customer", id: "customer_id", add: (q, v) => q("insert into deals (customer) values ($1) returning *", [v]) },
  { table: "recipes", name: "customer", id: "customer_id", add: (q, v) => q("insert into recipes (name, equipment_model, customer) values ($1, 'Zz Grinder', $2) returning *", [`r${++seq}`, v]) },
  { table: "network_accounts", name: "customer", id: "customer_id", add: (q, v) => q("insert into network_accounts (customer) values ($1) returning *", [v]) },
  { table: "customer_providers", name: "customer", id: "customer_id", add: async (q, v) => q("insert into customer_providers (customer, provider_id) values ($1, $2) returning *", [v, await providerId(q)]) },
  { table: "account_equipment", name: "customer", id: "customer_id", add: (q, v) => q("insert into account_equipment (customer, catalog_model, equipment_name) values ($1, 'Zz Brewer', 'Zz Brewer') returning *", [v]) },
  {
    table: "account_equipment_retired",
    name: "customer",
    id: "customer_id",
    add: (q, v) => q("insert into account_equipment_retired (unit_id, customer, catalog_model, equipment_name, unit) values ($1, $2, 'Zz Brewer', 'Zz Brewer', '{}') returning *", [++seq, v]),
  },
  { table: "assets", name: "customer_owned", id: "customer_owned_id", add: (q, v) => q("insert into assets (kind, model, site, customer_owned) values ('equip', 'Zz Brewer', 'Barn', $1) returning *", [v]) },
  { table: "assets", name: "sold_to", id: "sold_to_id", add: (q, v) => q("insert into assets (kind, model, site, sold_to) values ('equip', 'Zz Brewer', 'Barn', $1) returning *", [v]) },
  { table: "assets", name: "stock_hold_customer", id: "stock_hold_customer_id", add: (q, v) => q("insert into assets (kind, model, site, stock_hold_customer) values ('equip', 'Zz Brewer', 'Barn', $1) returning *", [v]) },
  { table: "wo_history", name: "customer", id: "customer_id", add: async (q, v) => q("insert into wo_history (run_id, history_ref, customer) values ($1, $2, $3) returning *", [await runId(q), `ZZ-${++seq}`, v]) },
  { table: "rebuilds", name: "account", id: "account_id", add: (q, v) => q("insert into rebuilds (title, account) values ('Zz rebuild', $1) returning *", [v]) },
  { table: "modules", name: "assigned_customer", id: "assigned_customer_id", add: (q, v) => q("insert into modules (module_id, assigned_customer) values ($1, $2) returning *", [`ZZM-${++seq}`, v]) },
  // A stock action still waiting for an Admin takes the account's new name (a decided one is history, below).
  {
    table: "asset_stock_actions",
    name: "customer",
    id: "customer_id",
    add: (q, v) => q("insert into asset_stock_actions (asset_id, kind, status, customer, asked_by) values ($1, 'assign', 'pending', $2, 'zz') returning *", [++seq, v]),
  },
];
/** History rows: they keep the name they had (choice 2), and their id with it (C3). */
const KEPT = [
  { table: "invoices", name: "customer", id: "customer_id", add: (q, v) => q("insert into invoices (entity_type, entity_id, customer) values ('service', $1, $2) returning *", [++seq, v]) },
  { table: "module_stops", name: "customer", id: "customer_id", add: async (q, v) => q("insert into module_stops (module_id, kind, customer) values ($1, 'assigned', $2) returning *", [await moduleId(q), v]) },
  {
    table: "equipment_move_requests",
    name: "from_customer",
    id: "from_customer_id",
    add: (q, v) => q("insert into equipment_move_requests (unit_id, from_customer, to_customer, serial, asked_by) values ($1, $2, 'Walk-In', 'SN', 'zz') returning *", [++seq, v]),
  },
  {
    table: "equipment_move_requests",
    name: "to_customer",
    id: "to_customer_id",
    add: (q, v) => q("insert into equipment_move_requests (unit_id, from_customer, to_customer, serial, asked_by) values ($1, 'Walk-In', $2, 'SN', 'zz') returning *", [++seq, v]),
  },
  {
    table: "asset_stock_actions",
    name: "customer",
    id: "customer_id",
    add: (q, v) => q("insert into asset_stock_actions (asset_id, kind, status, customer, asked_by) values ($1, 'assign', 'approved', $2, 'zz') returning *", [++seq, v]),
  },
];
const read = async (q, l, rowId) => (await q(`select ${l.name} as name, ${l.id} as id from ${l.table} where id = $1`, [rowId]))[0];
const label = (l) => `${l.table}.${l.name}`;
const linkRow = (report, l) => report.nameLinks.find((x) => x.table === l.table && x.column === l.name);

test("a rename moves every record linked to the account, names with spaces at the ends too, and Link Check shows no mismatch", async () => {
  const { pg, q, sql } = await all();
  try {
    const a = await accounts(q);
    const rows = [];
    for (const l of FOLLOW) {
      // One name per account in any capitals on the Out Of Network table: only the spaced one there.
      const names = l.table === "network_accounts" ? ["Zz Cafe "] : ["Zz Cafe", "Zz Cafe ", " zz cafe"];
      for (const v of names) {
        const [r] = await l.add(q, v);
        assert.equal(r[l.id], a["Zz Cafe"], `${label(l)} "${v}" is linked before the rename`);
        rows.push({ l, v, r });
      }
    }
    await renameOrMergeCustomer(sql, a["Zz Cafe"], "Zz Cafe Downtown");
    for (const { l, v, r } of rows) assert.deepEqual(await read(q, l, r.id), { name: "Zz Cafe Downtown", id: a["Zz Cafe"] }, `${label(l)} "${v}"`);

    const report = await linkCheckFor(sql, "zz-admin");
    for (const l of FOLLOW) {
      const ids = linkRow(report, l).ids;
      assert.deepEqual([ids.unlinked, ids.disagree, ids.offRule], [0, 0, 0], label(l));
    }
  } finally {
    await pg.close();
  }
});

test("a rename never takes a record the rule gives another account", async () => {
  const { pg, q, sql } = await all();
  try {
    // An old account off the list, and a listed one whose name has a space at the end.
    await q("insert into directory_customers (name, archived) values ('Zz Twin', true)");
    await q("insert into directory_customers (name) values ('Zz Twin ')");
    const a = Object.fromEntries((await q("select id, name from directory_customers")).map((r) => [r.name, r.id]));
    const [t] = await FOLLOW[0].add(q, "zz twin");
    assert.equal(t.customer_id, a["Zz Twin "], "the rule gives it the listed account");
    // Renaming the old account brings it back on the list under a new name.
    await renameOrMergeCustomer(sql, a["Zz Twin"], "Zz Twin Revived");
    assert.deepEqual(await read(q, FOLLOW[0], t.id), { name: "zz twin", id: a["Zz Twin "] });
  } finally {
    await pg.close();
  }
});

test("a rename to a name another account has with spaces at the ends keeps every record on the renamed account", async () => {
  const { pg, q, sql } = await all();
  try {
    // "Zz B " finds "Zz B" by the rule's last step while no account has "Zz B" itself.
    await q("insert into directory_customers (name) values ('Zz A'), ('Zz B ')");
    const a = Object.fromEntries((await q("select id, name from directory_customers")).map((r) => [r.name, r.id]));
    const rows = [];
    for (const l of FOLLOW) rows.push({ l, r: (await l.add(q, "Zz A"))[0] });
    const [theirs] = await FOLLOW[0].add(q, "Zz B ");
    await renameOrMergeCustomer(sql, a["Zz A"], "Zz B");
    for (const { l, r } of rows) assert.deepEqual(await read(q, l, r.id), { name: "Zz B", id: a["Zz A"] }, label(l));
    assert.deepEqual(await read(q, FOLLOW[0], theirs.id), { name: "Zz B ", id: a["Zz B "] }, "the other account keeps its own");
  } finally {
    await pg.close();
  }
});

test("a rename stopped after the records moved finishes the same way when it is run again", async () => {
  const { pg, q, sql } = await all();
  try {
    const { retargetCustomer } = await import("../src/lib/ops/customer-identity.ts");
    const a = await accounts(q);
    const na = FOLLOW.find((l) => l.table === "network_accounts");
    const [exact] = await na.add(q, "Zz Cafe");
    const [spaced] = await na.add(q, "Zz Cafe ");
    const [t] = await FOLLOW[0].add(q, "Zz Cafe ");
    // It needs the ids: without them it would find no record linked to the account.
    await assert.rejects(() => retargetCustomer(sql, "Zz Cafe", "Zz Cafe Downtown"), /account ids/);
    // The records moved; the account itself wasn't renamed yet.
    await retargetCustomer(sql, "Zz Cafe", "Zz Cafe Downtown", a["Zz Cafe"], a["Zz Cafe"]);
    await renameOrMergeCustomer(sql, a["Zz Cafe"], "Zz Cafe Downtown");
    assert.deepEqual(await read(q, na, exact.id), { name: "Zz Cafe Downtown", id: a["Zz Cafe"] });
    assert.deepEqual(await read(q, na, spaced.id), { name: "Zz Cafe ", id: null });
    assert.deepEqual(await read(q, FOLLOW[0], t.id), { name: "Zz Cafe Downtown", id: a["Zz Cafe"] });
  } finally {
    await pg.close();
  }
});

test("renaming to a name with records but no account: the rename doesn't fail, and leaves one row per key", async () => {
  const { pg, q, sql } = await all();
  try {
    const a = await accounts(q);
    const na = FOLLOW.find((l) => l.table === "network_accounts");
    await na.add(q, "Zz Cafe");
    await na.add(q, "Zz New Name");
    const pid = await providerId(q);
    await q("insert into customer_providers (customer, provider_id) values ('Zz Cafe', $1), ('Zz New Name', $1)", [pid]);
    await q("insert into recipes (name, equipment_model, customer) values ('House', 'Zz Grinder', 'Zz Cafe'), ('House', 'Zz Grinder', 'Zz New Name')");
    await renameOrMergeCustomer(sql, a["Zz Cafe"], "Zz New Name");
    for (const t of ["network_accounts", "customer_providers", "recipes"]) {
      const rows = await q(`select customer, customer_id from ${t}`);
      assert.deepEqual(rows, [{ customer: "Zz New Name", customer_id: a["Zz Cafe"] }], t);
    }
  } finally {
    await pg.close();
  }
});

test("a rename in other capitals gives the account's records the new capitals, names with spaces at the ends too", async () => {
  const { pg, q, sql } = await all();
  try {
    const a = await accounts(q);
    const rows = [];
    for (const l of FOLLOW.filter((x) => x.table !== "network_accounts")) for (const v of ["zz cafe", "Zz Cafe "]) rows.push({ l, v, r: (await l.add(q, v))[0] });
    await renameOrMergeCustomer(sql, a["Zz Cafe"], "ZZ Cafe");
    for (const { l, v, r } of rows) assert.deepEqual(await read(q, l, r.id), { name: "ZZ Cafe", id: a["Zz Cafe"] }, `${label(l)} "${v}"`);
  } finally {
    await pg.close();
  }
});

test("two Out Of Network rows for one account: the rename moves the one under its name, leaves the other, and doesn't fail", async () => {
  const { pg, q, sql } = await all();
  try {
    const a = await accounts(q);
    const na = FOLLOW.find((l) => l.table === "network_accounts");
    const [exact] = await na.add(q, "Zz Cafe");
    const [spaced] = await na.add(q, "Zz Cafe ");
    // The same provider on the account twice, under both spellings.
    const pid = await providerId(q);
    const [p1] = await q("insert into customer_providers (customer, provider_id) values ('Zz Cafe', $1) returning *", [pid]);
    const [p2] = await q("insert into customer_providers (customer, provider_id) values ('Zz Cafe ', $1) returning *", [pid]);
    await renameOrMergeCustomer(sql, a["Zz Cafe"], "Zz Cafe Downtown");
    assert.deepEqual(await read(q, na, exact.id), { name: "Zz Cafe Downtown", id: a["Zz Cafe"] });
    assert.deepEqual(await read(q, na, spaced.id), { name: "Zz Cafe ", id: null }, "left as it was; Link Check lists it");
    const cp = FOLLOW.find((l) => l.table === "customer_providers");
    assert.deepEqual(await read(q, cp, p1.id), { name: "Zz Cafe Downtown", id: a["Zz Cafe"] });
    assert.deepEqual(await read(q, cp, p2.id), { name: "Zz Cafe ", id: null });
  } finally {
    await pg.close();
  }
});

test("a merge moves the merged-away account's records onto the kept one by id; history rows keep their names", async () => {
  const { pg, q, sql } = await all();
  try {
    const a = await accounts(q);
    const follow = [];
    for (const l of FOLLOW) {
      const names = l.table === "network_accounts" ? ["Zz Bar-Grill "] : ["Zz Bar-Grill", "Zz Bar-Grill "];
      for (const v of names) follow.push({ l, v, r: (await l.add(q, v))[0] });
    }
    const kept = [];
    for (const l of KEPT) kept.push({ l, r: (await l.add(q, "Zz Bar-Grill"))[0] });
    // A provider both accounts have: the kept account's link stays, the other's isn't doubled.
    const pid = await providerId(q);
    const [mine] = await q("insert into customer_providers (customer, provider_id) values ('Zz Cafe', $1) returning *", [pid]);
    const [theirs] = await q("insert into customer_providers (customer, provider_id) values ('Zz Bar-Grill ', $1) returning *", [pid]);

    const res = await renameOrMergeCustomer(sql, a["Zz Bar-Grill"], "Zz Cafe", { force: true });
    assert.deepEqual([res.merged, res.id], [true, a["Zz Cafe"]]);
    for (const { l, v, r } of follow) assert.deepEqual(await read(q, l, r.id), { name: "Zz Cafe", id: a["Zz Cafe"] }, `${label(l)} "${v}"`);
    for (const { l, r } of kept) assert.deepEqual(await read(q, l, r.id), { name: "Zz Bar-Grill", id: a["Zz Cafe"] }, label(l));
    assert.equal((await q("select count(*)::int as n from customer_providers where provider_id = $1", [pid]))[0].n, 1);
    assert.deepEqual(await read(q, FOLLOW.find((l) => l.table === "customer_providers"), mine.id), { name: "Zz Cafe", id: a["Zz Cafe"] });
    assert.equal((await q("select count(*)::int as n from customer_providers where id = $1", [theirs.id]))[0].n, 0);

    const report = await linkCheckFor(sql, "zz-admin");
    for (const l of [...FOLLOW, ...KEPT]) assert.equal(linkRow(report, l).ids.onRemoved, 0, `${label(l)}: nothing left on the merged-away account`);
  } finally {
    await pg.close();
  }
});

test("a merge that keeps the renamed account takes the old account's records and history rows by id", async () => {
  const { pg, q, sql } = await all();
  try {
    const a = await accounts(q);
    // An old account off the list with the name, its history rows kept on its id from before it was removed.
    const [{ id: old }] = await q("insert into directory_customers (name) values ('Zz Cafe Twin') returning id");
    const kept = [];
    for (const l of KEPT) kept.push({ l, r: (await l.add(q, "Zz Cafe Twin"))[0] });
    await q("update directory_customers set archived = true where id = $1", [old]);
    const follow = [];
    for (const l of FOLLOW.filter((x) => x.table !== "network_accounts")) {
      follow.push({ l, r: (await l.add(q, "zz cafe twin"))[0] });
      follow.push({ l, r: (await l.add(q, "Zz Cafe "))[0] });
    }
    const res = await renameOrMergeCustomer(sql, a["Zz Cafe"], "Zz Cafe Twin", { force: true });
    assert.deepEqual([res.merged, res.id, res.kept], [true, a["Zz Cafe"], "renamed"]);
    for (const { l, r } of follow) assert.deepEqual(await read(q, l, r.id), { name: "Zz Cafe Twin", id: a["Zz Cafe"] }, label(l));
    for (const { l, r } of kept) assert.deepEqual(await read(q, l, r.id), { name: "Zz Cafe Twin", id: a["Zz Cafe"] }, label(l));
  } finally {
    await pg.close();
  }
});

test("the merge question counts the records linked to the account, names with spaces at the ends too", async () => {
  const { pg, q, sql } = await all();
  try {
    const a = await accounts(q);
    await FOLLOW[0].add(q, "Zz Bar-Grill ");
    await FOLLOW.find((l) => l.table === "account_equipment").add(q, "Zz Bar-Grill ");
    await FOLLOW.find((l) => l.table === "wo_history").add(q, " Zz Bar-Grill");
    const plan = await planCustomerRename(sql, a["Zz Bar-Grill"], "Zz Cafe");
    assert.equal(plan.kind, "merge");
    assert.deepEqual([plan.moving.calls, plan.moving.equipment, plan.moving.woHistory], [1, 1, 1]);
  } finally {
    await pg.close();
  }
});

test("0147: an invoice whose name finds no account takes its record's account when that account had the name", async () => {
  const { pg, q, runC4 } = await beforeC4();
  try {
    const a = await accounts(q);
    const cafe = a["Zz Cafe"];
    const rec = async (text) => (await q(text))[0].id;
    const svc = await rec("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-ZZ1', 'Zz Cafe', 'Open') returning id");
    const tlc = await rec("insert into service_jobs (kind, call_id, customer, status) values ('tlc', 'TLC-ZZ1', 'Zz Cafe', 'Open') returning id");
    const pm = await rec("insert into pm_jobs (customer) values ('Zz Cafe') returning id");
    const inst = await rec("insert into installs (customer, equipment) values ('Zz Cafe', 'G') returning id");
    const rb = await rec("insert into rebuilds (title, account) values ('Zz rebuild', 'Zz Cafe') returning id");
    const deal = await rec("insert into deals (customer) values ('Zz Cafe') returning id");
    const inv = async (type, id, name) => (await q("insert into invoices (entity_type, entity_id, customer) values ($1, $2, $3) returning id, customer_id", [type, id, name]))[0];

    // Zz Cafe's old names: on the Clean Names report, renamed in its history, and an account merged into it.
    const [{ id: run }] = await q("insert into customer_clean_runs (filename) values ('zz.csv') returning id");
    await q("insert into customer_clean_items (run_id, kind, customer_id, katz_name, clean_name) values ($1, 'similar', $2, 'Zz Cafe (Old)', 'Zz Cafe')", [run, cafe]);
    await q(
      `insert into activity (entity_type, entity_id, actor_name, action, detail) values
         ('customer', $1, 'zz', 'renamed', 'Renamed from “ZZ Cafe Inc” to “Zz Cafe”'),
         ('customer', $1, 'zz', 'merged', '“Zz Cafe Annex” (#77) was merged into this account. Filled in from it: phone.'),
         ('customer', $1, 'zz', 'merged', 'Renamed from “Zz Bistro” to “Zz Cafe”; the old account “Zz Corner” (#78) was merged into it.'),
         ('customer', $2, 'zz', 'renamed', 'Renamed from “Zz Elsewhere” to “Zz Bar-Grill”')`,
      [cafe, a["Zz Bar-Grill"]],
    );
    const filled = [
      await inv("service", svc, "Zz Cafe (Old)"),
      await inv("tlc", tlc, "zz cafe inc"),
      await inv("pm", pm, "Zz Cafe Annex"),
      await inv("install", inst, "Zz Bistro"),
      await inv("rebuild", rb, "Zz Corner "),
    ];
    for (const r of filled) assert.equal(r.customer_id, null);

    // Left as they are:
    const left = [
      // the record's account never had the name (a rebuild moved, its Sales Order billed someone else)
      await inv("deal", deal, "Zz Some Other Shop"),
      // another account had it
      await inv("service", await rec("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-ZZ2', 'Zz Cafe', 'Open') returning id"), "Zz Elsewhere"),
      // a record with no account
      await inv("service", await rec("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-ZZ3', 'Zz Nowhere', 'Open') returning id"), "Zz Cafe (Old)"),
      // no record, a blank name
      await inv("pm", 999999, "Zz Cafe (Old)"),
      await inv("install", 888888, "  "),
    ];
    // An id already set, and a name that finds an account.
    const given = await inv("deal", 777777, "Zz Cafe (Old)");
    await q("update invoices set customer_id = $1 where id = $2", [a["Zz Other"], given.id]);
    const named = await inv("service", await rec("insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-ZZ4', 'Zz Cafe', 'Open') returning id"), "Zz Bar-Grill");

    const before = await q("select * from invoices order by id");
    await runC4();
    const after = await q("select * from invoices order by id");
    const idOf = (id) => after.find((r) => r.id === id).customer_id;
    for (const r of filled) assert.equal(idOf(r.id), cafe, `invoice ${r.id}`);
    for (const r of left) assert.equal(idOf(r.id), null, `invoice ${r.id}`);
    assert.equal(idOf(given.id), a["Zz Other"]);
    assert.equal(idOf(named.id), a["Zz Bar-Grill"]);
    const strip = (r) => ({ ...r, customer_id: undefined });
    assert.deepEqual(after.map(strip), before.map(strip), "only customer_id changes");
  } finally {
    await pg.close();
  }
});
