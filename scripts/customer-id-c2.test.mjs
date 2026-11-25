// Customers by id, phase C2 ("One Record Per Machine Plan", Chuy approved 11/24): account equipment, retired machines,
// warehouse records, stock actions, rebuilds and modules carry the account's id beside its name (migrations 0141 and
// 0142), by the same rule as C1 (0138). Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
const C2 = "0141_customer_id_c2.sql";

/** Migrations up to (not including) 0141, so data can be there before it runs, as on production. */
async function beforeC2() {
  const pg = new PGlite();
  for (const f of files.filter((f) => f < C2)) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  const q = async (t, p) => (await pg.query(t, p)).rows;
  const runC2 = async () => {
    for (const f of files.filter((f) => f >= C2)) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  };
  return { pg, q, runC2, sql: { query: q } };
}
async function all() {
  const b = await beforeC2();
  await b.runC2();
  return b;
}
const accounts = async (q) => {
  await q("insert into directory_customers (name) values ('Zz Cafe'), ('Zz Twins'), ('ZZ TWINS'), ('Zz Gone'), ('Zz Bar-Grill')");
  await q("update directory_customers set archived = true where name = 'Zz Gone'");
  return Object.fromEntries((await q("select id, name from directory_customers")).map((r) => [r.name, r.id]));
};

let seq = 0;
/** Every name column C2 links: its table, the name column, the id column beside it, and how to add a row with a name. */
const LINKS = [
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
  {
    table: "asset_stock_actions",
    name: "customer",
    id: "customer_id",
    add: (q, v) => q("insert into asset_stock_actions (asset_id, kind, status, customer, asked_by) values ($1, 'assign', 'pending', $2, 'zz') returning *", [++seq, v]),
  },
  { table: "rebuilds", name: "account", id: "account_id", add: (q, v) => q("insert into rebuilds (title, account) values ('Zz rebuild', $1) returning *", [v]) },
  { table: "modules", name: "assigned_customer", id: "assigned_customer_id", add: (q, v) => q("insert into modules (module_id, assigned_customer) values ($1, $2) returning *", [`ZZM-${++seq}`, v]) },
];
const idOf = async (q, l, rowId) => (await q(`select ${l.id} as v from ${l.table} where id = $1`, [rowId]))[0].v;

test("the backfill links exact, other-capitals and trimmed names on every C2 column, and nothing else changes", async () => {
  const { pg, q, runC2 } = await beforeC2();
  try {
    const a = await accounts(q);
    const names = ["Zz Cafe", "zz cafe", " Zz Cafe ", "zz twins", "Zz Gone", "Zz Bar Grill", "Zz Nowhere", "Walk-In"];
    const made = [];
    for (const l of LINKS) for (const v of names) made.push({ l, row: (await l.add(q, v))[0] });
    const snapshot = async () => {
      const out = [];
      for (const { l, row } of made) out.push((await q(`select * from ${l.table} where id = $1`, [row.id]))[0]);
      return out;
    };
    const before = await snapshot();
    const historyBefore = (await q("select count(*)::int as n from equipment_history"))[0].n;
    await runC2();
    const after = await snapshot();
    assert.equal((await q("select count(*)::int as n from equipment_history"))[0].n, historyBefore, "filling ids writes no equipment history");
    for (const l of LINKS) {
      const ids = [];
      for (const { l: ml, row } of made) if (ml === l) ids.push(await idOf(q, l, row.id));
      assert.deepEqual(ids, [a["Zz Cafe"], a["Zz Cafe"], a["Zz Cafe"], null, null, null, null, null], `${l.table}.${l.name}`);
    }
    // Only the new id columns changed: names, dates and everything else are as they were.
    const strip = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !LINKS.some((l) => l.id === k)));
    assert.deepEqual(after.map(strip), before);
  } finally {
    await pg.close();
  }
});

test("new C2 records are linked as they're saved; an id the save sets is kept", async () => {
  const { pg, q } = await all();
  try {
    const a = await accounts(q);
    for (const l of LINKS) {
      assert.equal((await l.add(q, "zz cafe"))[0][l.id], a["Zz Cafe"], `${l.table}.${l.name}`);
      assert.equal((await l.add(q, "zz twins"))[0][l.id], null, `${l.table}.${l.name} ambiguous`);
      const [r] = await l.add(q, "Zz Cafe");
      await q(`update ${l.table} set ${l.id} = $2 where id = $1`, [r.id, a["Zz Twins"]]);
      assert.equal(await idOf(q, l, r.id), a["Zz Twins"], `${l.table}.${l.name}: an id set by a statement stays`);
    }
  } finally {
    await pg.close();
  }
});

test("moving a C2 record to another account moves its id; other edits, and the other name columns, leave it", async () => {
  const { pg, q } = await all();
  try {
    const a = await accounts(q);
    for (const l of LINKS) {
      const [r] = await l.add(q, "Zz Cafe");
      await q(`update ${l.table} set ${l.name} = 'Zz Bar-Grill' where id = $1`, [r.id]);
      assert.equal(await idOf(q, l, r.id), a["Zz Bar-Grill"], `${l.table}.${l.name}`);
      await q(`update ${l.table} set ${l.name} = 'Zz Nowhere At All' where id = $1`, [r.id]);
      assert.equal(await idOf(q, l, r.id), null, `${l.table}.${l.name}: a name with no account has no id`);
    }
    // A warehouse record names up to three accounts; each id follows its own name only.
    const [w] = await q("insert into assets (kind, model, site, customer_owned, sold_to, stock_hold_customer) values ('equip', 'Zz Brewer', 'Barn', 'Zz Cafe', 'Zz Cafe', 'Zz Cafe') returning *");
    await q("update assets set sold_to = 'Zz Bar-Grill', status = 'sold' where id = $1", [w.id]);
    const [after] = await q("select customer_owned_id, sold_to_id, stock_hold_customer_id from assets where id = $1", [w.id]);
    assert.deepEqual(after, { customer_owned_id: a["Zz Cafe"], sold_to_id: a["Zz Bar-Grill"], stock_hold_customer_id: a["Zz Cafe"] });
    await q("update assets set stock_hold_customer = null, notes = 'released' where id = $1", [w.id]);
    assert.equal((await q("select stock_hold_customer_id from assets where id = $1", [w.id]))[0].stock_hold_customer_id, null);
  } finally {
    await pg.close();
  }
});

test("an account added, restored or removed later links or unlinks the C2 records under its name", async () => {
  const { pg, q } = await all();
  try {
    await accounts(q);
    const rows = [];
    for (const l of LINKS) rows.push({ l, newer: (await l.add(q, "zz new place"))[0], gone: (await l.add(q, "Zz Gone"))[0] });
    const historyBefore = (await q("select count(*)::int as n from equipment_history"))[0].n;
    const [{ id: added }] = await q("insert into directory_customers (name) values ('Zz New Place') returning id");
    const gone = (await q("select id from directory_customers where name = 'Zz Gone'"))[0].id;
    await q("update directory_customers set archived = false where id = $1", [gone]);
    for (const { l, newer, gone: g } of rows) {
      assert.equal(await idOf(q, l, newer.id), added, `${l.table}.${l.name} added`);
      assert.equal(await idOf(q, l, g.id), gone, `${l.table}.${l.name} restored`);
    }
    await q("update directory_customers set archived = true where id = $1", [gone]);
    for (const { l, gone: g } of rows) assert.equal(await idOf(q, l, g.id), null, `${l.table}.${l.name} removed`);
    assert.equal((await q("select count(*)::int as n from equipment_history"))[0].n, historyBefore, "relinking writes no equipment history");
  } finally {
    await pg.close();
  }
});

test("rename keeps every C2 record on its account; merge moves the dropped account's records to the kept one", async () => {
  const { pg, q, sql } = await all();
  try {
    const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");
    const a = await accounts(q);
    const mine = [];
    for (const l of LINKS) mine.push({ l, row: (await l.add(q, "Zz Cafe"))[0] });
    // A module on the account's unit, and its place, as the desk saves them.
    await q("update modules set location = 'Zz Cafe', assigned_unit_id = 1 where assigned_customer = 'Zz Cafe'");
    await renameOrMergeCustomer(sql, a["Zz Cafe"], "Zz Cafe Downtown");
    for (const { l, row } of mine) {
      assert.equal((await q(`select ${l.name} as v from ${l.table} where id = $1`, [row.id]))[0].v, "Zz Cafe Downtown", `${l.table}.${l.name} renamed`);
      assert.equal(await idOf(q, l, row.id), a["Zz Cafe"], `${l.table}.${l.name} keeps its account`);
    }

    const theirs = [];
    for (const l of LINKS) theirs.push({ l, row: (await l.add(q, "Zz Bar-Grill"))[0] });
    const r = await renameOrMergeCustomer(sql, a["Zz Bar-Grill"], "Zz Cafe Downtown", { force: true });
    assert.equal(r.merged, true);
    for (const { l, row } of [...mine, ...theirs]) assert.equal(await idOf(q, l, row.id), r.id, `${l.table}.${l.name} on the kept account`);
  } finally {
    await pg.close();
  }
});

test("a decided stock action keeps the name it was decided under, so a rename unlinks it until C4", async () => {
  const { pg, q, sql } = await all();
  try {
    const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");
    const a = await accounts(q);
    const [done] = await q("insert into asset_stock_actions (asset_id, kind, status, customer, asked_by) values (1, 'assign', 'approved', 'Zz Cafe', 'zz') returning *");
    assert.equal(done.customer_id, a["Zz Cafe"]);
    await renameOrMergeCustomer(sql, a["Zz Cafe"], "Zz Cafe Downtown");
    const [after] = await q("select customer, customer_id from asset_stock_actions where id = $1", [done.id]);
    assert.deepEqual(after, { customer: "Zz Cafe", customer_id: null });
  } finally {
    await pg.close();
  }
});

test("Link Check shows the id links on every C2 column", async () => {
  const { pg, q, sql } = await all();
  try {
    await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
    const a = await accounts(q);
    for (const l of LINKS) {
      await l.add(q, "Zz Cafe");
      await l.add(q, "Zz Nowhere");
      await l.add(q, "Walk-In");
      const [r] = await l.add(q, "Zz Cafe");
      await q(`update ${l.table} set ${l.id} = $2 where id = $1`, [r.id, a["Zz Twins"]]);
    }
    const { linkCheckFor } = await import("../src/lib/ops/link-check.ts");
    const report = await linkCheckFor(sql, "zz-admin");
    for (const l of LINKS) {
      const row = report.nameLinks.find((x) => x.table === l.table && x.column === l.name);
      // assets rows also carry the other two columns blank, which never count as unlinked.
      assert.deepEqual(row.ids, { linked: 2, unlinked: 1, disagree: 1, onRemoved: 0, offRule: 1 }, `${l.table}.${l.name}`);
    }
    // A place, not an account: no id.
    assert.equal(report.nameLinks.find((x) => x.table === "modules" && x.column === "location").ids, undefined);
  } finally {
    await pg.close();
  }
});

test("review: putting a unit back on an install takes its id from its name now, not the snapshot's", async () => {
  const { pg, q } = await all();
  try {
    const { keepRemovedSql, putBackInstallUnitSql } = await import("../src/lib/ops/inspection-api.ts");
    const a = await accounts(q);
    const [inst] = await q("insert into installs (customer, equipment) values ('Zz Cafe', 'G') returning id");
    const [unit] = await q("insert into account_equipment (customer, catalog_model, equipment_name) values ('Zz Cafe', 'Zz Brewer', 'Zz Brewer') returning id, customer_id");
    assert.equal(unit.customer_id, a["Zz Cafe"]);
    await q("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [inst.id, unit.id]);
    await q(keepRemovedSql(), [inst.id, unit.id, "{}"]);
    const [removed] = await q("select id from install_units_removed where unit_id = $1", [unit.id]);
    await q("delete from install_inspection_units where equipment_id = $1", [unit.id]);
    await q("delete from account_equipment where id = $1", [unit.id]);
    // The account is removed while the unit is off the install.
    await q("update directory_customers set archived = true where id = $1", [a["Zz Cafe"]]);
    await q(putBackInstallUnitSql(), [removed.id, "zz"]);
    const [back] = await q("select customer, customer_id from account_equipment where id = $1", [unit.id]);
    assert.deepEqual(back, { customer: "Zz Cafe", customer_id: null }, "a removed account's id never comes back with the unit");
  } finally {
    await pg.close();
  }
});

test("review: a hard-deleted account leaves its C2 records with no id", async () => {
  const { pg, q } = await all();
  try {
    const a = await accounts(q);
    const rows = [];
    for (const l of LINKS) rows.push({ l, row: (await l.add(q, "Zz Bar-Grill"))[0] });
    await q("delete from directory_customers where id = $1", [a["Zz Bar-Grill"]]);
    for (const { l, row } of rows) assert.equal(await idOf(q, l, row.id), null, `${l.table}.${l.name}`);
  } finally {
    await pg.close();
  }
});

test("review: the generic id trigger refuses arguments that don't name real column pairs", async () => {
  const { pg, q } = await all();
  try {
    await q("create table zz_probe (id serial primary key, who text, who_id int)");
    await q("create trigger zz_probe_bad before insert on zz_probe for each row execute function katz_fill_customer_ids('who', 'whom_id')");
    await assert.rejects(() => q("insert into zz_probe (who) values ('Zz Cafe')"), /no column who or whom_id/);
    await q("drop trigger zz_probe_bad on zz_probe");
    await q("create trigger zz_probe_odd before insert on zz_probe for each row execute function katz_fill_customer_ids('who')");
    await assert.rejects(() => q("insert into zz_probe (who) values ('Zz Cafe')"), /pairs/);
  } finally {
    await pg.close();
  }
});
