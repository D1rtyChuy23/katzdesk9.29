// Customers by id, phase C1 (Chuy approved 11/24, choice 1: unmatched or ambiguous names stay unlinked): tickets, PMs,
// installs, deals and recipes carry the account's id beside its name (migration 0138). Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
const C1 = "0138_customer_id_c1.sql";

/** Migrations up to (not including) 0138, so data can be there before it runs, as on production. */
async function before0138() {
  const pg = new PGlite();
  for (const f of files.filter((f) => f < C1)) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  const q = async (t, p) => (await pg.query(t, p)).rows;
  return { pg, q, run0138: () => pg.exec(readFileSync(new URL(C1, dir), "utf8")), sql: { query: q } };
}
async function all() {
  const b = await before0138();
  await b.run0138();
  for (const f of files.filter((f) => f > C1)) await b.pg.exec(readFileSync(new URL(f, dir), "utf8"));
  return b;
}
const accounts = async (q) => {
  await q("insert into directory_customers (name) values ('Zz Cafe'), ('Zz Twins'), ('ZZ TWINS'), ('Zz Gone'), ('Zz Bar-Grill')");
  await q("update directory_customers set archived = true where name = 'Zz Gone'");
  return Object.fromEntries((await q("select id, name from directory_customers")).map((r) => [r.name, r.id]));
};
const ticket = (q, customer, id = null) =>
  q("insert into service_jobs (kind, call_id, customer, status, customer_id) values ('service', $1, $2, 'Open', $3) returning id, customer_id", [
    `SC-${Math.random().toString(36).slice(2, 8)}`,
    customer,
    id,
  ]);
const idOf = async (q, table, rowId) => (await q(`select customer_id from ${table} where id = $1`, [rowId]))[0].customer_id;

test("the backfill links exact, other-capitals and trimmed names to listed accounts, and nothing else", async () => {
  const { pg, q, run0138 } = await before0138();
  try {
    const a = await accounts(q);
    const names = ["Zz Cafe", "zz cafe", " Zz Cafe ", "zz twins", "Zz Gone", "Zz Bar Grill", "Zz Nowhere", "Walk-In", ""];
    for (const [i, c] of names.entries()) await q("insert into service_jobs (kind, call_id, customer, status) values ('service', $1, $2, 'Open')", [`SC-B${i}`, c]);
    const before = await q("select id, customer, status, updated_at from service_jobs order by id");
    await run0138();
    const after = await q("select id, customer, status, updated_at, customer_id from service_jobs order by id");
    assert.deepEqual(
      after.map((r) => r.customer_id),
      [a["Zz Cafe"], a["Zz Cafe"], a["Zz Cafe"], null, null, null, null, null, null],
    );
    // Only the new column changed.
    assert.deepEqual(after.map(({ customer_id, ...r }) => r), before);
  } finally {
    await pg.close();
  }
});

test("all five tables get the id, and the backfill covers each", async () => {
  const { pg, q, run0138 } = await before0138();
  try {
    const a = await accounts(q);
    await q("insert into pm_jobs (customer) values ('Zz Cafe')").catch(() => q("insert into pm_jobs (kind, customer) values ('pm', 'Zz Cafe')"));
    await q("insert into installs (customer, equipment) values ('zz cafe', 'G')");
    await q("insert into deals (customer) values ('Zz Cafe')").catch(() => q("insert into deals (customer, title) values ('Zz Cafe', 'x')"));
    await q("insert into recipes (name, equipment_model, customer) values ('r', 'Zz Grinder', 'Zz Cafe')");
    await run0138();
    for (const t of ["pm_jobs", "installs", "deals", "recipes"]) {
      const rows = await q(`select customer_id from ${t}`);
      assert.deepEqual(rows.map((r) => r.customer_id), [a["Zz Cafe"]], t);
    }
  } finally {
    await pg.close();
  }
});

test("new records are linked as they're saved; an id the save sets is kept", async () => {
  const { pg, q } = await all();
  try {
    const a = await accounts(q);
    assert.equal((await ticket(q, "zz cafe"))[0].customer_id, a["Zz Cafe"]);
    assert.equal((await ticket(q, "zz twins"))[0].customer_id, null);
    assert.equal((await ticket(q, "Zz Gone"))[0].customer_id, null);
    assert.equal((await ticket(q, "Zz Cafe", a["Zz Twins"]))[0].customer_id, a["Zz Twins"]);
  } finally {
    await pg.close();
  }
});

test("moving a record to another account moves its id; other edits leave it", async () => {
  const { pg, q } = await all();
  try {
    const a = await accounts(q);
    const [t] = await ticket(q, "Zz Cafe");
    await q("update service_jobs set status = 'Closed' where id = $1", [t.id]);
    assert.equal(await idOf(q, "service_jobs", t.id), a["Zz Cafe"]);
    await q("update service_jobs set customer = 'Zz Bar-Grill' where id = $1", [t.id]);
    assert.equal(await idOf(q, "service_jobs", t.id), a["Zz Bar-Grill"]);
    // A name that finds no account (a rename in progress) keeps the id it had.
    await q("update service_jobs set customer = 'Zz Bar & Grill Renamed' where id = $1", [t.id]);
    assert.equal(await idOf(q, "service_jobs", t.id), a["Zz Bar-Grill"]);
    // A statement that sets the id with the name keeps the id it set.
    await q("update service_jobs set customer = 'Zz Cafe', customer_id = $2 where id = $1", [t.id, a["Zz Twins"]]);
    assert.equal(await idOf(q, "service_jobs", t.id), a["Zz Twins"]);
  } finally {
    await pg.close();
  }
});

test("rename keeps every record on its account; merge moves the dropped account's records to the kept one", async () => {
  const { pg, q, sql } = await all();
  try {
    const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");
    const a = await accounts(q);
    const [t1] = await ticket(q, "Zz Cafe");
    const [inst] = await q("insert into installs (customer, equipment) values ('Zz Cafe', 'G') returning id");
    await renameOrMergeCustomer(sql, a["Zz Cafe"], "Zz Cafe Downtown");
    assert.equal((await q("select customer from service_jobs where id = $1", [t1.id]))[0].customer, "Zz Cafe Downtown");
    assert.equal(await idOf(q, "service_jobs", t1.id), a["Zz Cafe"]);
    assert.equal(await idOf(q, "installs", inst.id), a["Zz Cafe"]);

    // Merge Zz Bar-Grill into Zz Cafe Downtown (rename one to the other's name).
    const [t2] = await ticket(q, "Zz Bar-Grill");
    const r = await renameOrMergeCustomer(sql, a["Zz Bar-Grill"], "Zz Cafe Downtown", { force: true });
    assert.equal(r.merged, true);
    const ids = new Set([await idOf(q, "service_jobs", t1.id), await idOf(q, "service_jobs", t2.id)]);
    assert.deepEqual([...ids], [r.id]);
    const left = await q("select count(*)::int as n from service_jobs s join directory_customers d on d.id = s.customer_id where d.archived");
    assert.equal(left[0].n, 0, "no record is left on the merged-away account");
  } finally {
    await pg.close();
  }
});

test("Link Check shows the id links on the five tables", async () => {
  const { pg, q, sql } = await all();
  try {
    await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
    const a = await accounts(q);
    await ticket(q, "Zz Cafe");
    await ticket(q, "Zz Nowhere");
    await ticket(q, "Walk-In");
    await ticket(q, "Zz Cafe", a["Zz Twins"]); // linked to another account's id: shows as disagree
    const { linkCheckFor } = await import("../src/lib/ops/link-check.ts");
    const r = await linkCheckFor(sql, "zz-admin");
    const t = r.nameLinks.find((l) => l.table === "service_jobs");
    assert.deepEqual(t.ids, { linked: 2, unlinked: 1, disagree: 1 });
    assert.ok(r.nameLinks.find((l) => l.table === "installs").ids);
    assert.equal(r.nameLinks.find((l) => l.table === "account_equipment").ids, undefined);
  } finally {
    await pg.close();
  }
});
