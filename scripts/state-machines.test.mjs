import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// The app's status fields, in one registry (Chuy, 11/9). These tests keep the registry, the database and the
// status lists typed around the code from drifting apart. No rule here changes what a status does.

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const SM = await import("../src/lib/ops/state-machines.ts");
const { renderStateMachinesDoc } = SM;

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("every machine names its states once, and its closed and starting states are among them", () => {
  const ids = SM.STATE_MACHINES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 10);
  for (const m of SM.STATE_MACHINES) {
    assert.equal(new Set(m.states).size, m.states.length, m.id);
    for (const s of m.closed) assert.ok(m.states.includes(s), `${m.id}: closed ${s}`);
    if (m.initial != null) assert.ok(m.states.includes(m.initial), `${m.id}: initial ${m.initial}`);
    assert.ok(m.label && m.table && m.column && m.source && m.notes.length, m.id);
  }
  assert.equal(SM.machine("ticket").closed.join("|"), "Completed|Cancelled|Phone Resolved");
  assert.throws(() => SM.machine("nope"), /No state machine "nope"/);
});

test("the database agrees: each column's default is the starting state, and each check lists the same states", async () => {
  const pg = new PGlite();
  try {
    for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    for (const m of SM.STATE_MACHINES) {
      const col = (await pg.query("select column_default from information_schema.columns where table_name = $1 and column_name = $2", [m.table, m.column])).rows[0];
      assert.ok(col, `${m.id}: ${m.table}.${m.column} is a real column`);
      const def = /^'(.*)'::text$/.exec(col.column_default ?? "")?.[1] ?? null;
      assert.equal(def, m.initial, `${m.id}: default`);
      const checks = (
        await pg.query(
          `select pg_get_constraintdef(c.oid) as def from pg_constraint c join pg_class t on t.oid = c.conrelid
            where t.relname = $1 and c.contype = 'c' and pg_get_constraintdef(c.oid) ~ ('\\m' || $2 || '\\M')`,
          [m.table, m.column],
        )
      ).rows.map((r) => [...r.def.matchAll(/'([^']*)'::text/g)].map((x) => x[1]).sort());
      assert.equal(checks.length > 0, m.dbCheck, `${m.id}: has a check`);
      for (const listed of checks) assert.deepEqual(listed, [...m.states].sort(), `${m.id}: check`);
    }
  } finally {
    await pg.close();
  }
});

test("SQL helpers spell a machine's closed states for a query", () => {
  assert.equal(SM.closedSql("ticket"), "('Completed', 'Cancelled', 'Phone Resolved')");
  assert.equal(SM.closedSql("pm"), "('Completed', 'Cancelled')");
  assert.equal(SM.isClosed("rebuild", "Cancelled"), true);
  assert.equal(SM.isClosed("rebuild", "Testing"), false);
  assert.equal(SM.isClosed("asset", null), false);
});

test("a closed-status list typed into a query matches a machine's, or is a known exception", () => {
  const dir = new URL("../src/lib/ops/", import.meta.url);
  const closedSets = new Set(SM.STATE_MACHINES.filter((m) => m.closed.length).map((m) => [...m.closed].sort().join("|")));
  const odd = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
    const text = readFileSync(new URL(name, dir), "utf8");
    for (const hit of text.matchAll(/status (?:not )?in \(((?:'[^']*'(?:, ?)?)+)\)/g)) {
      const set = [...hit[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
      if (!set.some((s) => s === "Completed" || s === "Cancelled")) continue; // another table's own words
      if (!closedSets.has([...set].sort().join("|"))) odd.push(`${name}: ${set.join(", ")}`);
    }
  }
  assert.deepEqual(odd.sort(), [...SM.KNOWN_ODD_STATUS_LISTS].sort());
});

test("docs/state-machines.md is the registry, written out", () => {
  assert.equal(read("docs/state-machines.md"), renderStateMachinesDoc());
});
