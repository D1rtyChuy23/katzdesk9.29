// Customers by id, phase C3 ("One Record Per Machine Plan", Chuy approved 11/24): work order history, network tables,
// invoices, module stops and move requests carry the account's id beside its name (migrations 0145 and 0146). Work
// order history and the network tables follow their account on a rename, as C1 and C2 do. Invoices, module stops, move
// requests and stock actions keep the name as it was (choice 2), so their id is kept too: set when the row is saved,
// filled when an account appears, never cleared by a rename or a removal. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
const C3 = "0145_customer_id_c3.sql";

async function beforeC3() {
  const pg = new PGlite();
  for (const f of files.filter((f) => f < C3)) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  const q = async (t, p) => (await pg.query(t, p)).rows;
  const runC3 = async () => {
    for (const f of files.filter((f) => f >= C3 && f < "0147")) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  };
  return { pg, q, runC3, sql: { query: q } };
}
async function all() {
  const b = await beforeC3();
  await b.runC3();
  for (const f of files.filter((f) => f >= "0147")) await b.pg.exec(readFileSync(new URL(f, dir), "utf8"));
  return b;
}
const accounts = async (q) => {
  await q("insert into directory_customers (name) values ('Zz Cafe'), ('Zz Twins'), ('ZZ TWINS'), ('Zz Gone'), ('Zz Bar-Grill')");
  await q("update directory_customers set archived = true where name = 'Zz Gone'");
  return Object.fromEntries((await q("select id, name from directory_customers")).map((r) => [r.name, r.id]));
};

let seq = 0;
const runId = async (q) => (await q("insert into wo_history_runs (filename) values ('zz.csv') returning id"))[0].id;
const providerId = async (q) => (await q("insert into network_providers (name) values ($1) returning id", [`Zz Provider ${++seq}`]))[0].id;
const moduleId = async (q) => (await q("insert into modules (module_id) values ($1) returning id", [`ZZM-${++seq}`]))[0].id;
/** Every name column C3 links. sticky: keeps its id through a rename or removal. */
const LINKS = [
  { table: "wo_history", name: "customer", id: "customer_id", add: async (q, v) => q("insert into wo_history (run_id, history_ref, customer) values ($1, $2, $3) returning *", [await runId(q), `ZZ-${++seq}`, v]) },
  { table: "network_accounts", name: "customer", id: "customer_id", add: (q, v) => q("insert into network_accounts (customer) values ($1) returning *", [v]) },
  { table: "customer_providers", name: "customer", id: "customer_id", add: async (q, v) => q("insert into customer_providers (customer, provider_id) values ($1, $2) returning *", [v, await providerId(q)]) },
  { table: "invoices", name: "customer", id: "customer_id", sticky: true, add: (q, v) => q("insert into invoices (entity_type, entity_id, customer) values ('service', $1, $2) returning *", [++seq, v]) },
  { table: "module_stops", name: "customer", id: "customer_id", sticky: true, add: async (q, v) => q("insert into module_stops (module_id, kind, customer) values ($1, 'assigned', $2) returning *", [await moduleId(q), v]) },
  {
    table: "equipment_move_requests",
    name: "from_customer",
    id: "from_customer_id",
    sticky: true,
    add: (q, v) => q("insert into equipment_move_requests (unit_id, from_customer, to_customer, serial, asked_by) values ($1, $2, 'Walk-In', 'SN', 'zz') returning *", [++seq, v]),
  },
  {
    table: "equipment_move_requests",
    name: "to_customer",
    id: "to_customer_id",
    sticky: true,
    add: (q, v) => q("insert into equipment_move_requests (unit_id, from_customer, to_customer, serial, asked_by) values ($1, 'Walk-In', $2, 'SN', 'zz') returning *", [++seq, v]),
  },
];
const idOf = async (q, l, rowId) => (await q(`select ${l.id} as v from ${l.table} where id = $1`, [rowId]))[0].v;

test("the backfill links exact, other-capitals and trimmed names on every C3 column, and nothing else changes", async () => {
  const { pg, q, runC3 } = await beforeC3();
  try {
    const a = await accounts(q);
    const names = ["Zz Cafe", "zz cafe ", " Zz Cafe", "zz twins", "Zz Gone", "Zz Bar Grill", "Zz Nowhere", "Walk-In"];
    const made = [];
    for (const l of LINKS) {
      for (const v of names) {
        // network_accounts takes one row per name in any capitals: its other-capitals rows go in as their own names.
        if (l.table === "network_accounts" && made.some((m) => m.l === l && m.v.trim().toLowerCase() === v.trim().toLowerCase())) {
          made.push({ l, v, row: null });
          continue;
        }
        made.push({ l, v, row: (await l.add(q, v))[0] });
      }
    }
    const snap = async () => {
      const out = [];
      for (const { l, row } of made) if (row) out.push((await q(`select * from ${l.table} where id = $1`, [row.id]))[0]);
      return out;
    };
    const before = await snap();
    await runC3();
    const after = await snap();
    for (const l of LINKS) {
      const got = [];
      for (const m of made) if (m.l === l && m.row) got.push([m.v, await idOf(q, l, m.row.id)]);
      const want = { "Zz Cafe": a["Zz Cafe"], "zz cafe ": a["Zz Cafe"], " Zz Cafe": a["Zz Cafe"] };
      for (const [v, id] of got) assert.equal(id, want[v] ?? null, `${l.table}.${l.name} "${v}"`);
    }
    const ids = new Set(LINKS.map((l) => l.id));
    const strip = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !ids.has(k)));
    assert.deepEqual(after.map(strip), before);
  } finally {
    await pg.close();
  }
});

test("new C3 records are linked as they're saved; an id the save sets is kept; a name change moves the id", async () => {
  const { pg, q } = await all();
  try {
    const a = await accounts(q);
    for (const l of LINKS) {
      const [r] = await l.add(q, "zz cafe");
      assert.equal(r[l.id], a["Zz Cafe"], `${l.table}.${l.name}`);
      await q(`update ${l.table} set ${l.name} = 'Zz Bar-Grill' where id = $1`, [r.id]);
      assert.equal(await idOf(q, l, r.id), a["Zz Bar-Grill"], `${l.table}.${l.name}: moved`);
      await q(`update ${l.table} set ${l.name} = 'Zz Nowhere At All' where id = $1`, [r.id]);
      assert.equal(await idOf(q, l, r.id), null, `${l.table}.${l.name}: a name with no account has no id`);
      await q(`update ${l.table} set ${l.id} = $2 where id = $1`, [r.id, a["Zz Twins"]]);
      assert.equal(await idOf(q, l, r.id), a["Zz Twins"], `${l.table}.${l.name}: an id set by a statement stays`);
      if (l.table === "network_accounts") await q("delete from network_accounts where id = $1", [r.id]);
    }
  } finally {
    await pg.close();
  }
});

test("rename: work order history and the network tables follow the account; history rows keep the old name and their id", async () => {
  const { pg, q, sql } = await all();
  try {
    const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");
    const a = await accounts(q);
    const rows = [];
    for (const l of LINKS) rows.push({ l, row: (await l.add(q, "Zz Cafe"))[0] });
    await renameOrMergeCustomer(sql, a["Zz Cafe"], "Zz Cafe Downtown");
    for (const { l, row } of rows) {
      const name = (await q(`select ${l.name} as v from ${l.table} where id = $1`, [row.id]))[0].v;
      assert.equal(name, l.sticky ? "Zz Cafe" : "Zz Cafe Downtown", `${l.table}.${l.name} name`);
      assert.equal(await idOf(q, l, row.id), a["Zz Cafe"], `${l.table}.${l.name} keeps its account`);
    }
  } finally {
    await pg.close();
  }
});

test("history rows keep their id when the account is removed, and are filled when an account appears", async () => {
  const { pg, q } = await all();
  try {
    const a = await accounts(q);
    for (const l of LINKS.filter((x) => x.sticky)) {
      const [kept] = await l.add(q, "Zz Bar-Grill");
      const [waiting] = await l.add(q, `zz later ${l.table} ${l.id}`);
      assert.equal(waiting[l.id], null);
      await q("update directory_customers set archived = true where id = $1", [a["Zz Bar-Grill"]]);
      assert.equal(await idOf(q, l, kept.id), a["Zz Bar-Grill"], `${l.table}.${l.name}: removing the account keeps the id`);
      await q("update directory_customers set archived = false where id = $1", [a["Zz Bar-Grill"]]);
      const [{ id: added }] = await q("insert into directory_customers (name) values ($1) returning id", [`Zz Later ${l.table} ${l.id}`]);
      assert.equal(await idOf(q, l, waiting.id), added, `${l.table}.${l.name}: a new account fills a row with no id`);
    }
    // The rows that follow their name (work order history, network tables) unlink when their account is removed, as in C1.
    const [w] = await LINKS[0].add(q, "Zz Bar-Grill");
    await q("update directory_customers set archived = true where id = $1", [a["Zz Bar-Grill"]]);
    assert.equal(await idOf(q, LINKS[0], w.id), null);
  } finally {
    await pg.close();
  }
});

test("a hard-deleted account leaves its C3 records with no id, history rows too", async () => {
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

test("Link Check shows the id links on every C3 column; a history row only counts off the rule when it could link and doesn't", async () => {
  const { pg, q, sql } = await all();
  try {
    await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
    const a = await accounts(q);
    for (const l of LINKS) {
      const tag = l.table === "network_accounts";
      await l.add(q, "Zz Cafe");
      await l.add(q, "Zz Nowhere");
      await l.add(q, "Walk-In");
      const [r] = await l.add(q, tag ? "Zz Bar-Grill" : "Zz Cafe");
      await q(`update ${l.table} set ${l.id} = $2 where id = $1`, [r.id, a["Zz Twins"]]);
    }
    const { linkCheckFor } = await import("../src/lib/ops/link-check.ts");
    const report = await linkCheckFor(sql, "zz-admin");
    for (const l of LINKS) {
      const row = report.nameLinks.find((x) => x.table === l.table && x.column === l.name);
      // A history row on another account's id is how a rename leaves it: not off the rule.
      assert.deepEqual(row.ids, { linked: 2, unlinked: 1, disagree: 1, onRemoved: 0, offRule: l.sticky ? 0 : 1 }, `${l.table}.${l.name}`);
      assert.equal(!!row.sticky, !!l.sticky);
    }
    // An account number, not a name: no id.
    assert.equal(report.nameLinks.find((x) => x.table === "invoices" && x.column === "bill_account").ids, undefined);
  } finally {
    await pg.close();
  }
});

test("stock actions (C2) keep their id like the other history rows: a decided one keeps it through a rename", async () => {
  const { pg, q, sql } = await all();
  try {
    const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");
    const a = await accounts(q);
    const [done] = await q("insert into asset_stock_actions (asset_id, kind, status, customer, asked_by) values (1, 'assign', 'approved', 'Zz Cafe', 'zz') returning *");
    const [open] = await q("insert into asset_stock_actions (asset_id, kind, status, customer, asked_by) values (2, 'assign', 'pending', 'Zz Cafe', 'zz') returning *");
    await renameOrMergeCustomer(sql, a["Zz Cafe"], "Zz Cafe Downtown");
    const after = await q("select id, customer, customer_id from asset_stock_actions where id = any($1) order by id", [[done.id, open.id]]);
    assert.deepEqual(after, [
      { id: done.id, customer: "Zz Cafe", customer_id: a["Zz Cafe"] },
      { id: open.id, customer: "Zz Cafe Downtown", customer_id: a["Zz Cafe"] },
    ]);
  } finally {
    await pg.close();
  }
});

test("merge: every C3 row moves to the kept one; history rows by id (C4)", async () => {
  const { pg, q, sql } = await all();
  try {
    const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");
    const a = await accounts(q);
    const rows = [];
    for (const l of LINKS) rows.push({ l, row: (await l.add(q, "Zz Bar-Grill"))[0] });
    const r = await renameOrMergeCustomer(sql, a["Zz Bar-Grill"], "Zz Cafe", { force: true });
    assert.equal(r.merged, true);
    for (const { l, row } of rows) {
      assert.equal(await idOf(q, l, row.id), r.id, `${l.table}.${l.name}`);
      const name = (await q(`select ${l.name} as v from ${l.table} where id = $1`, [row.id]))[0].v;
      assert.equal(name, l.sticky ? "Zz Bar-Grill" : "Zz Cafe", `${l.table}.${l.name}: a history row keeps its name`);
    }
  } finally {
    await pg.close();
  }
});

test("an invoice saved again (ON CONFLICT DO UPDATE) keeps its id with the same name and follows a new one", async () => {
  const { pg, q } = await all();
  try {
    const a = await accounts(q);
    const upsert = (name) =>
      q(
        `insert into invoices (entity_type, entity_id, customer) values ('service', 4242, $1)
         on conflict (entity_type, entity_id) do update set customer = excluded.customer, updated_at = now()
         returning customer_id`,
        [name],
      );
    assert.equal((await upsert("Zz Cafe"))[0].customer_id, a["Zz Cafe"]);
    // Kept through a rename: the invoice still reads "Zz Cafe".
    await q("update directory_customers set name = 'Zz Cafe Downtown' where id = $1", [a["Zz Cafe"]]);
    assert.equal((await upsert("Zz Cafe"))[0].customer_id, a["Zz Cafe"], "the same name keeps the id");
    assert.equal((await upsert("Zz Bar-Grill"))[0].customer_id, a["Zz Bar-Grill"], "a new name takes its own account's id");
  } finally {
    await pg.close();
  }
});
