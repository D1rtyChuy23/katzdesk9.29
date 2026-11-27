// Follow-up to C6 (#214), from Chuy's read-only check of f640892 (11/26): the PM stack lists say enough to pick from
// (both ticket numbers, a date, the customer when it differs), and the open-PM counts share one rule and say what they
// leave out. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const TS = await import("../src/lib/ops/ticket-status.ts");
const L = await import("../src/lib/ops/pm-stack-labels.ts");
const SA = await import("../src/lib/ops/pm-stack-api.ts");
const RB = await import("../src/lib/ops/read-by-id.ts");

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
  return { sql, run };
}
const idOf = async (run, t, p) => Number((await run(t, p))[0].id);

test("one open-PM rule: not done, not Completed or Cancelled, not moved to a ticket, in TypeScript and SQL alike", async () => {
  const { run } = await fresh();
  const job = await idOf(run, "insert into service_jobs (kind, call_id, customer, status) values ('service', 'SC-ZZ-1', 'ZZ Cafe', 'Open') returning id");
  const cases = [
    { status: "In Progress", done: false, moved: null, open: true },
    { status: "In Progress", done: true, moved: null, open: false },
    { status: "Completed", done: false, moved: null, open: false },
    { status: "Cancelled", done: false, moved: null, open: false },
    { status: "Awaiting Parts", done: false, moved: job, open: false },
  ];
  for (const c of cases) {
    const id = await idOf(run, "insert into pm_jobs (customer, status, done, moved_job_id) values ('ZZ Cafe', $1, $2, $3) returning id", [c.status, c.done, c.moved]);
    c.id = id;
    assert.equal(TS.isOpenPm({ status: c.status, done: c.done, movedJobId: c.moved }), c.open, JSON.stringify(c));
  }
  const open = (await run(`select p.id from pm_jobs p where ${TS.openPmSql("p")} order by p.id`)).map((r) => r.id);
  assert.deepEqual(open, cases.filter((c) => c.open).map((c) => c.id));
});

test("Link Check's open-PM lists use the rule and say what they leave out: not on an account, and Walk-In", async () => {
  const { sql, run } = await fresh();
  await run("insert into directory_customers (name) values ('ZZ Cafe'), ('Walk - In')");
  const open = (customer, extra = {}) =>
    run("insert into pm_jobs (customer, status, done) values ($1, $2, $3)", [customer, extra.status ?? "In Progress", extra.done ?? false]);
  await open("ZZ Cafe");
  await open("ZZ Cafe");
  await open("ZZ Cafe", { done: true }); // ticked done: closed everywhere now
  await open("ZZ Nowhere Cafe"); // not on an account
  await open("Walk - In");
  const r = await RB.readByIdFor(sql, "zz-admin");
  const list = (area, key) => r.areas.find((a) => a.area === area).lists.find((l) => l.key === key);
  const readiness = list("pms", "openPms");
  assert.deepEqual([readiness.byName, readiness.notOnAccount, readiness.leftOut], [2, 1, 1], "2 on ZZ Cafe, 1 not on an account, Walk-In left out");
  const map = list("map", "openPms");
  assert.deepEqual([map.byName, map.notOnAccount, map.leftOut], [3, 1, 0], "the Map counts Walk-In's account; 1 not on an account");
  // Every open PM is in one of the three, and the PMs page's Active counts them all.
  assert.equal(readiness.byName + readiness.notOnAccount + readiness.leftOut, 4);
  assert.equal(map.byName + map.notOnAccount + map.leftOut, 4);
  assert.match(RB.listGapText(readiness), /^1 not on an account · 1 Walk-In left out$/);
  assert.equal(RB.listGapText({ notOnAccount: 0, leftOut: 0, leftOutLabel: "Walk-In" }), "");
});

test("the PM stack lists: both ticket numbers, a date, and the customer only when it differs", async () => {
  const { sql, run } = await fresh();
  await run("insert into directory_customers (name) values ('ZZ Cafe')");
  const pm = await idOf(run, "insert into pm_jobs (customer, status, projected) values ('ZZ Cafe', 'In Progress', '2026-11-20') returning id");
  const t = await idOf(run, "insert into service_jobs (kind, call_id, wo, customer, status, received, scheduled) values ('service', 'SC-202610-183', 'WO-1000', 'ZZ Cafe', 'Dispatched', '2026-10-30', '2026-11-03') returning id");
  const done = await idOf(run, "insert into service_jobs (kind, call_id, customer, status, received, completed_at) values ('service', 'SC-202606-197', 'ZZ Cafe', 'Completed', '2026-06-01', '2026-06-04') returning id");
  const offered = (await SA.listForPm(sql, pm)).candidates;
  const row = (id) => offered.find((c) => c.jobId === id);
  assert.deepEqual([row(t).date, row(t).dateKind], ["2026-11-03", "scheduled"]);
  assert.deepEqual([row(done).date, row(done).dateKind], ["2026-06-04", "completed"]);
  assert.equal(L.stackTicketText(row(t)), "Ticket #" + t + " · WO-1000 · SC-202610-183 · Dispatched · scheduled Nov 3, 2026");
  assert.equal(L.stackTicketText(row(done)), "Ticket #" + done + " · SC-202606-197 · Completed · completed Jun 4, 2026");
  assert.equal(L.ticketNumbers({ wo: "WO-1000", callId: "WO-1000" }), "WO-1000", "the same number once");
  assert.equal(
    L.stackTicketText({ ...row(t), customer: "ZZ Other Cafe", customerMatches: false }),
    "Ticket #" + t + " · WO-1000 · SC-202610-183 · Dispatched · scheduled Nov 3, 2026 · ZZ Other Cafe",
  );
  const pms = (await SA.listForJob(sql, t)).candidates;
  assert.deepEqual([pms[0].date, pms[0].dateKind], ["2026-11-20", "due"]);
  assert.equal(L.stackPmText(pms[0]), `PM #${pm} · ZZ Cafe · In Progress · due Nov 20, 2026`);
  assert.equal(L.stackPmText({ pmId: 9, customer: "ZZ Cafe", status: "Completed", equipment: null, customerMatches: true, date: null, dateKind: null }), "PM #9 · ZZ Cafe · Completed");
  assert.equal(L.NO_UNBILLED_TICKETS, "No unbilled tickets for this customer.");
});
