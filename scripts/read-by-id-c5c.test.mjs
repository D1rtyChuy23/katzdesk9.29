// Reading by id, phase C5 part 3 ("One Record Per Machine Plan", Chuy approved 11/24): the PMs area. A PM's runbook
// plans and bills the units of the PM's own account, takes intervals from that account's earlier PMs, and Runbook
// Readiness and a unit's model change follow it, by the account's id once the PMs switch on Link Check is on. Made-up
// data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { readByIdFor, READ_AREAS } = await import("../src/lib/ops/read-by-id.ts");
const { pmAccountId, pmEarlierVisits, sameAccountAsPm } = await import("../src/lib/ops/pm-account.ts");
const { loadPmRunbookPlan } = await import("../src/lib/ops/pm-runbook-api.ts");
const { planModelChange } = await import("../src/lib/ops/unit-model-change.ts");
const { buildReadiness } = await import("../src/lib/ops/pm-runbook-readiness.ts");
const { matchE4XWide } = await import("../src/lib/ops/pm-runbook.ts");

const SITE = "ZZ Model Cafe";
const OLD = "ZZ Model Cafe Old";

async function fresh() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.exec("create unique index if not exists directory_customers_name_lower_uidx on directory_customers (lower(name))");
  const run = async (t, p) => (await pg.query(t, p)).rows;
  const sql = Object.assign(async (strings, ...values) => run(strings.reduce((a, x, i) => `${a}$${i}${x}`), values), { query: run });
  await run("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
  await run("insert into directory_customers (name) values ($1), ('ZZ Other Cafe')", [SITE]);
  await run("insert into directory_equipment (name) values ('Linea PB'), ('Linea Classic')");
  const ids = Object.fromEntries((await run("select id, name from directory_customers")).map((r) => [r.name, r.id]));
  return { pg, sql, run, cafe: ids[SITE], other: ids["ZZ Other Cafe"] };
}
const pmsOn = (run) =>
  run("insert into desk_settings (key, value) values ('read_by_id', $1) on conflict (key) do update set value = excluded.value", [
    JSON.stringify({ pms: { at: "2026-11-26T12:00:00Z", by: "zzadmin" } }),
  ]);
const unitAt = async (run, customer, id) => {
  const u = (await run("insert into account_equipment (customer, catalog_model, equipment_name) values ($1, 'Linea PB', 'Linea PB') returning id", [customer]))[0].id;
  if (id !== undefined) await run("update account_equipment set customer_id = $2 where id = $1", [u, id]);
  return u;
};
const pmAt = async (run, customer, id, extra = "") => {
  const p = (await run(`insert into pm_jobs (customer, equipment, status${extra ? ", done, completed_at" : ""}) values ($1, 'Linea PB', $2${extra ? ", true, '2026-10-01'" : ""}) returning id`, [customer, extra ? "Completed" : "Pending Scheduling"]))[0].id;
  if (id !== undefined) await run("update pm_jobs set customer_id = $2 where id = $1", [p, id]);
  return p;
};

test("PMs is its own area", () => {
  assert.deepEqual(READ_AREAS.map((a) => a.area), ["accounts", "tickets", "pms"]);
});

test("a PM's runbook account: its id with PMs on and the PM's own name, else by name", async () => {
  const { run, sql, cafe } = await fresh();
  const pm = await pmAt(run, SITE);
  assert.equal(await pmAccountId(sql, pm, SITE), null, "switch off");
  await pmsOn(run);
  assert.equal(await pmAccountId(sql, pm, SITE), cafe);
  assert.equal(await pmAccountId(sql, pm, "zz model-cafe"), cafe, "the same name in other capitals and punctuation");
  assert.equal(await pmAccountId(sql, pm, "ZZ Other Cafe"), null, "a save that changes the PM's customer plans by the new name");
  const loose = await pmAt(run, "ZZ No Such Place");
  assert.equal(await pmAccountId(sql, loose, "ZZ No Such Place"), null, "a PM with no account id");
});

test("the runbook plans the PM account's units: by name, then by id", async () => {
  const { run, sql, cafe, other } = await fresh();
  const pm = await pmAt(run, SITE);
  // A unit a rename left under the old name (its id is the Cafe's), and one under the Cafe's name whose id is another's.
  const kept = await unitAt(run, OLD, cafe);
  const drift = await unitAt(run, SITE, other);
  const off = await loadPmRunbookPlan(sql, SITE, "Linea PB", pm);
  assert.deepEqual(off.rows.map((r) => r.id), [drift]);
  assert.equal(off.planned[0].accountId, drift);
  await pmsOn(run);
  const on = await loadPmRunbookPlan(sql, SITE, "Linea PB", pm);
  assert.deepEqual(on.rows.map((r) => r.id), [kept]);
  assert.equal(on.planned[0].accountId, kept);
  // Planned for another name (a completion that changes the customer): by that name.
  assert.deepEqual((await loadPmRunbookPlan(sql, "ZZ Other Cafe", "Linea PB", pm)).rows.map((r) => r.id), []);
});

test("earlier PMs for intervals: by name, then by the PM's account id", async () => {
  const { run, sql, cafe } = await fresh();
  const pm = await pmAt(run, SITE);
  const same = await pmAt(run, SITE, undefined, "done");
  const old = await pmAt(run, OLD, cafe, "done");
  await pmAt(run, SITE, undefined); // open: not an earlier visit
  assert.deepEqual((await pmEarlierVisits(sql, SITE, pm, null)).map((r) => r.id), [same]);
  assert.deepEqual((await pmEarlierVisits(sql, SITE, pm, cafe)).map((r) => r.id).sort(), [same, old].sort());
});

test("the runbook's own saves take a unit on the PM's account by its id once it reads by id", () => {
  assert.equal(sameAccountAsPm({ customer: OLD, customer_id: 5 }, SITE, 5), true);
  assert.equal(sameAccountAsPm({ customer: SITE, customer_id: 9 }, SITE, 5), false, "another account's unit under the same name");
  assert.equal(sameAccountAsPm({ customer: "zz model-cafe", customer_id: null }, SITE, 5), true, "no id: by name");
  assert.equal(sameAccountAsPm({ customer: OLD, customer_id: 5 }, SITE, null), false, "by name: as before");
  assert.equal(sameAccountAsPm({ customer: "ZZ MODEL CAFE", customer_id: 9 }, SITE, null), true);
});

test("Runbook Readiness: a PM with its account id takes that account's units, and units with no listed id by name", () => {
  const match = (piece) => {
    const h = matchE4XWide(piece);
    return h ? { runbookId: "eversys-e4-xwide", model: h.model } : null;
  };
  const unit = (id, customer, customerId, listed) => ({ id, customer, customerId, listed, catalogModel: "e'4m X-Wide", equipmentName: "e'4m X-Wide", serial: `S${id}`, installDate: "2024-01-01" });
  const units = [unit(10, "Cafe Uno Old", 5, true), unit(11, "Cafe Uno", 9, true), unit(12, "Cafe Uno", null, false), unit(13, "cafe uno", 7, false)];
  const line = "e'4m X-Wide\ne'4m X-Wide\ne'4m X-Wide\ne'4m X-Wide";
  const byName = buildReadiness([{ id: 1, customer: "Cafe Uno", equipment: line, status: "Pending Scheduling" }], units, match);
  assert.deepEqual(byName.map((r) => r.accountId), [11, 12, 13, null]);
  const byId = buildReadiness([{ id: 1, customer: "Cafe Uno", equipment: line, status: "Pending Scheduling", customerId: 5 }], units, match);
  assert.deepEqual(byId.map((r) => r.accountId), [10, 12, 13, null]);
});

test("a unit's model change re-pins the PMs on its account by id once PMs reads by id", async () => {
  const { run, sql, cafe } = await fresh();
  const unit = await unitAt(run, SITE);
  // A PM a rename left under the old name: its id is the Cafe's.
  const pm = await pmAt(run, OLD, cafe);
  const plan = (await planModelChange(sql, { id: unit, customer: SITE, catalogModel: "Linea PB" }, "Linea Classic")).pins;
  assert.deepEqual(plan, [], "by name the PM isn't the Cafe's");
  await pmsOn(run);
  const pins = (await planModelChange(sql, { id: unit, customer: SITE, catalogModel: "Linea PB" }, "Linea Classic")).pins;
  assert.deepEqual(pins.map((p) => p.pm), [pm]);
});

test("Link Check's PMs side by side", async () => {
  const { run, sql, cafe } = await fresh();
  await unitAt(run, OLD, cafe);
  await pmAt(run, OLD, cafe, "done");
  await pmAt(run, SITE);
  const area = (await readByIdFor(sql, "zz-admin")).areas.find((a) => a.area === "pms");
  const list = (key) => {
    const l = area.lists.find((x) => x.key === key);
    return [l.present, l.byName, l.byId, l.accounts, l.onlyByName, l.onlyById];
  };
  assert.deepEqual(list("runbookUnits"), [true, 0, 1, 1, 0, 1]);
  assert.deepEqual(list("earlierPms"), [true, 0, 1, 1, 0, 1]);
  assert.deepEqual(list("openPms"), [true, 1, 1, 0, 0, 0]);
});
