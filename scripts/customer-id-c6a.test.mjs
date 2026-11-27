// Customers by id, phase C6 part A ("One Record Per Machine Plan", Chuy 11/26: "split"): the PM stack matches a PM and a
// ticket by account id once the PMs switch on Link Check is on (left over from C5), copies of a customer name carry the
// account's id, and moving a PM, install or deal to another customer checks the list as a ticket does. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const S = await import("../src/lib/ops/pm-stack.ts");
const SA = await import("../src/lib/ops/pm-stack-api.ts");

const files = readdirSync(new URL("../migrations/", import.meta.url)).filter((n) => n.endsWith(".sql")).sort();
let last = null;
async function fresh() {
  if (last) await last.close().catch(() => {});
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  last = pg;
  for (const name of files) await pg.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  const run = async (t, p) => (await pg.query(t, p)).rows;
  const sql = Object.assign(async (strings, ...values) => run(strings.reduce((a, x, i) => `${a}$${i}${x}`), values), { query: run });
  await run("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('zz-admin', 'zzadmin', true, true, 'admin')");
  return { pg, sql, run };
}
const idOf = async (run, t, p) => Number((await run(t, p))[0].id);
const account = (run, name) => idOf(run, "insert into directory_customers (name) values ($1) returning id", [name]);
const pmsOn = (run) =>
  run("insert into desk_settings (key, value) values ('read_by_id', $1) on conflict (key) do update set value = excluded.value", [
    JSON.stringify({ pms: { at: "2026-11-26T12:00:00Z", by: "zzadmin" } }),
  ]);
let n = 0;
/** A ticket a PM can stack on; `id` sets its account id apart from its name (a save that set the id itself). */
async function ticket(run, customer, id) {
  const t = await idOf(run, "insert into service_jobs (kind, call_id, customer, status) values ('service', $1, $2, 'Open') returning id", [`SC-C6A-${++n}`, customer]);
  if (id !== undefined) await run("update service_jobs set customer_id = $2 where id = $1", [t, id]);
  return t;
}
async function pm(run, customer, id) {
  const p = await idOf(run, "insert into pm_jobs (customer, equipment, status) values ($1, 'Faema X20', 'Awaiting Parts') returning id", [customer]);
  if (id !== undefined) await run("update pm_jobs set customer_id = $2 where id = $1", [p, id]);
  return p;
}
const offered = async (sql, p) => (await SA.listForPm(sql, p)).candidates.map((c) => c.jobId).sort((a, b) => a - b);
const takes = async (sql, t) => (await SA.listForJob(sql, t)).candidates.map((c) => c.pmId).sort((a, b) => a - b);

test("PM stack: two accounts whose names differ only in punctuation are one customer by name, two by id", async () => {
  const { sql, run } = await fresh();
  await account(run, "ZZ Joe's Cafe");
  await account(run, "ZZ Joes Cafe");
  const p = await pm(run, "ZZ Joe's Cafe");
  const same = await ticket(run, "ZZ Joe's Cafe");
  const twin = await ticket(run, "ZZ Joes Cafe");
  assert.deepEqual(await offered(sql, p), [same, twin], "by name, as before");
  assert.deepEqual(await takes(sql, twin), [p]);
  await pmsOn(run);
  assert.deepEqual(await offered(sql, p), [same], "by id: only the PM's own account");
  assert.deepEqual(await takes(sql, twin), []);
  assert.deepEqual(await takes(sql, same), [p]);
  assert.equal((await sql.query(S.stackPmSql(true), [p, twin, "zzadmin"])).length, 0, "the save check agrees");
  const pair = await SA.loadStackPair(sql, p, twin);
  assert.match(S.stackRefusal(pair.pm, pair.ticket, pair.stackedCount, pair.pmInvoiceHasLines), /is for ZZ Joe's Cafe, but ticket #\d+ is for ZZ Joes Cafe/);
  assert.equal((await sql.query(S.stackPmSql(true), [p, same, "zzadmin"])).length, 1);
});

test("PM stack: a PM and ticket on one account stack by id though their names differ", async () => {
  const { sql, run } = await fresh();
  const alpha = await account(run, "ZZ Alpha Cafe");
  const p = await pm(run, "ZZ Alpha Kitchen", alpha);
  const t = await ticket(run, "ZZ Alpha Cafe");
  assert.deepEqual(await offered(sql, p), [], "by name they differ");
  assert.equal((await sql.query(S.stackPmSql(), [p, t, "zzadmin"])).length, 0);
  await pmsOn(run);
  assert.deepEqual(await offered(sql, p), [t]);
  const listed = (await SA.listForPm(sql, p)).candidates[0];
  assert.equal(listed.customerMatches, true);
  assert.equal((await sql.query(S.stackPmSql(true), [p, t, "zzadmin"])).length, 1);
  assert.equal((await SA.listForPm(sql, p)).stackedOn.customerMatches, true);
  assert.deepEqual((await SA.listForJob(sql, t)).stacked.map((r) => [r.pmId, r.customerMatches]), [[p, true]]);
});

test("PM stack by id: names with no account still match by name; a removed account's id goes by name", async () => {
  const { sql, run } = await fresh();
  await pmsOn(run);
  const p = await pm(run, "ZZ Nobody Cafe");
  const t = await ticket(run, "ZZ Nobody Cafe");
  assert.deepEqual(await offered(sql, p), [t]);
  const gone = await idOf(run, "insert into directory_customers (name, archived) values ('ZZ Gone', true) returning id");
  const beta = await account(run, "ZZ Beta Bakery");
  const p2 = await pm(run, "ZZ Beta Bakery", gone);
  const t2 = await ticket(run, "ZZ Beta Bakery");
  assert.deepEqual(await offered(sql, p2), [t2], "the PM's removed id goes by its name, which finds Beta");
  assert.ok(beta);
  assert.equal((await sql.query(S.stackPmSql(true), [p2, t2, "zzadmin"])).length, 1);
  // Walk-in never stacks, either way.
  assert.equal(S.stackRefusal({ id: 1, customer: "Walk - In", status: "Open", stackedJobId: null, account: 9 }, { id: 2, customer: "Walk - In", status: "Open", nsSo: null, duplicateOf: null, phoneResolved: false, wo: null, callId: null, account: 9 }, 0, false), "Only a PM and ticket for a real customer can be stacked.");
});

test("moving a stacked PM or ticket to another customer: by id, the accounts decide", () => {
  const twinA = { customer: "ZZ Joe's Cafe", account: 1 };
  const twinB = { customer: "ZZ Joes Cafe", account: 2 };
  // By name the two are one customer: no refusal.
  assert.equal(S.stackCustomerRefusal("ZZ Joe's Cafe", "ZZ Joes Cafe", [{ id: 7, customer: "ZZ Joe's Cafe" }], "pm"), null);
  // By id they are two.
  assert.equal(S.stackCustomerRefusal(twinA, twinB, [{ id: 7, ...twinA }], "pm"), "This PM is stacked on ticket #7 (ZZ Joe's Cafe). Unstack it first.");
  // A rename of the PM's name on the same account is not a move.
  assert.equal(S.stackCustomerRefusal(twinA, { customer: "ZZ Joe's Cafe Downtown", account: 1 }, [{ id: 7, ...twinA }], "pm"), null);
  // A partner already on the new account passes.
  assert.equal(S.stackCustomerRefusal(twinA, twinB, [{ id: 8, customer: "ZZ Joes Cafe", account: 2 }], "ticket"), null);
});

test("moving a stacked PM or ticket: the save check reads accounts by id with PMs on", async () => {
  const { sql, run } = await fresh();
  await account(run, "ZZ Joe's Cafe");
  await account(run, "ZZ Joes Cafe");
  const p = await pm(run, "ZZ Joe's Cafe");
  const t = await ticket(run, "ZZ Joe's Cafe");
  assert.equal((await sql.query(S.stackPmSql(), [p, t, "zzadmin"])).length, 1);
  assert.equal(await SA.stackEditRefusal(sql, "pm", p, "ZZ Joes Cafe"), null, "by name the twin is the same customer");
  await pmsOn(run);
  assert.equal(await SA.stackEditRefusal(sql, "pm", p, "ZZ Joes Cafe"), `This PM is stacked on ticket #${t} (ZZ Joe's Cafe). Unstack it first.`);
  assert.equal(await SA.stackEditRefusal(sql, "ticket", t, "ZZ Joes Cafe"), `PM #${p} is stacked on this ticket (ZZ Joe's Cafe). Unstack it first.`);
  assert.equal(await SA.stackEditRefusal(sql, "pm", p, "ZZ Joe's Cafe"), null, "unchanged");
  assert.equal(await SA.stackEditRefusal(sql, "pm", p, "zz joe's cafe"), null, "the same account in other capitals");
  const { updatePmFor } = await import("../src/lib/ops/api.ts");
  await assert.rejects(updatePmFor(sql, { id: p, customer: "ZZ Joes Cafe" }, "zz-admin"), /This PM is stacked on ticket/);
});

test("moving a PM, install or deal to another customer puts it on a listed account, as a ticket's move does", async () => {
  const { sql, run } = await fresh();
  await account(run, "ZZ Alpha Cafe");
  await account(run, "ZZ Other Cafe");
  const A = await import("../src/lib/ops/api.ts");
  const p = await pm(run, "ZZ Alpha Cafe");
  const inst = await idOf(run, "insert into installs (customer, complete, equip_status, archived) values ('ZZ Alpha Cafe', false, 'Not Ready', false) returning id");
  const deal = await idOf(run, "insert into deals (customer) values ('ZZ Alpha Cafe') returning id");
  const saves = {
    pm: (customer) => A.updatePmFor(sql, { id: p, customer }, "zz-admin"),
    install: (customer) => A.updateInstallFor(sql, { id: inst, customer }, { userId: "zz-admin" }),
    deal: (customer) => A.updateDealFor(sql, { id: deal, customer }, "zz-admin"),
  };
  const table = { pm: "pm_jobs", install: "installs", deal: "deals" };
  const own = { pm: p, install: inst, deal };
  for (const [kind, save] of Object.entries(saves)) {
    await assert.rejects(save("ZZ Nowhere Cafe"), /ZZ Nowhere Cafe isn't on the customer list/, `${kind}: a name not on the list`);
    await save("zz other cafe");
    const row = (await run(`select customer, customer_id from ${table[kind]} where id = $1`, [own[kind]]))[0];
    assert.equal(row.customer, "ZZ Other Cafe", `${kind}: the list's spelling`);
    assert.ok(row.customer_id != null, `${kind}: on the account`);
  }
  // A record already under a name no account has keeps it when a save sends that name back.
  const older = await pm(run, "ZZ Gone Cafe");
  await A.updatePmFor(sql, { id: older, customer: "ZZ Gone Cafe", notes: "still here" }, "zz-admin");
  assert.equal((await run("select customer from pm_jobs where id = $1", [older]))[0].customer, "ZZ Gone Cafe");
});
