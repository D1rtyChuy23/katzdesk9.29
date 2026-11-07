// The rebuild WO link (11/6) against every write it can meet, both orders, the second waiting on the first's locks:
// Approve, Warehouse's Save for Approval, a Charges save, an install's Approve, a second link, a ticket merged into an
// install, Merge installs, a WO-duplicate merge, and Remove; Merge installs' own one-invoice check; and the note that a
// rebuild's invoice is on a Sales Order (0122). Not part of `npm test`: it needs a real Postgres (PGlite has one
// connection). Run it only against a throwaway local server, made-up data only:
//
//   KD_RACE_PG=postgres://postgres@127.0.0.1:55437 node --experimental-strip-types scripts/rebuild-link-races.mjs
//
// It drops and makes the database kdrace_rebuild_link there, and refuses any host but 127.0.0.1 or localhost.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import pg from "pg";

const url = new URL(process.env.KD_RACE_PG ?? "postgres://postgres@127.0.0.1:55437");
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("A throwaway local Postgres only (127.0.0.1 or localhost).");
await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL = "postgres://127.0.0.1:9/katzdesk-test-unused";
pg.types.setTypeParser(20, Number);
const base = { host: url.hostname, port: Number(url.port || 5432), user: decodeURIComponent(url.username || "postgres"), password: decodeURIComponent(url.password) || undefined };
const L = await import("../src/lib/ops/rebuild-link-api.ts");
const I = await import("../src/lib/ops/invoice-api.ts");
const C = await import("../src/lib/ops/charges-api.ts");
const M = await import("../src/lib/ops/ticket-install-merge.ts");
const P = await import("../src/lib/ops/install-projects.ts");
const W = await import("../src/lib/ops/wo-duplicates.ts");

const DB = "kdrace_rebuild_link";
const admin = new pg.Client({ ...base, database: "postgres" });
await admin.connect();
await admin.query(`drop database if exists ${DB}`);
await admin.query(`create database ${DB}`);
await admin.end();
const db = { ...base, database: DB };
const pool = new pg.Pool({ ...db, max: 4 });
const MIGRATIONS = new URL("../migrations/", import.meta.url);
for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(readFileSync(new URL(f, MIGRATIONS), "utf8"));
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw new Error(`${f}: ${e.message}`);
  } finally {
    c.release();
  }
}
const q = async (t, p) => (await pool.query(t, p)).rows;
const sql = Object.assign(async (s, ...v) => q(s.reduce((a, x, i) => `${a}$${i}${x}`), v), { query: q });
await q("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin')");

const CAFE = "Test Race Cafe";
let n = 0;
const rebuild = async (account = "Katz shop / stock") => Number((await q("insert into rebuilds (title, account) values ('Test race refurb', $1) returning id", [account]))[0].id);
const own = async (rb, lines) => {
  const inv = Number((await q("insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('rebuild', $1, 'Katz shop / stock', 0, 'chuy', now() - interval '1 hour') returning id", [rb]))[0].id);
  for (const [i, l] of lines.entries()) await q("insert into invoice_lines (invoice_id, item, qty, rate, kind, sort) values ($1, $2, $3, $4, 'part', $5)", [inv, l[0], l[1], l[2], i + 1]);
};
const ticket = async (wo, customer = CAFE, status = "Completed") =>
  Number((await q("insert into service_jobs (kind, call_id, customer, wo, status, technician) values ('service', $1, $2, $3, $4, 'Test Tech') returning id", [`SC-RACE-${++n}`, customer, wo ?? `WO-${7100 + n}`, status]))[0].id);
const install = async (wo) => Number((await q("insert into installs (customer, wo, complete, equip_status) values ($1, $2, false, 'Not Ready') returning id", [CAFE, wo ?? `WO-${7200 + ++n}`]))[0].id);
const STAMP = (col) => `(extract(epoch from ${col}) * 1000000)::bigint::text`;
const stampOf = async (job) => (await q(`select ${STAMP("updated_at")} as s from service_jobs where id = $1`, [job]))[0].s;
const ver = async (t, id) => (await q("select invoice_version($1, $2) as v", [t, id]))[0].v;
/** An install as Find stamps it: its row, then its invoice. */
const installStamp = async (id) => (await q(`select ${STAMP("updated_at")} || '|' || coalesce(invoice_version('install', id), '') as s from installs where id = $1`, [id]))[0].s;
const lines = (t, id) =>
  q(
    t === "job"
      ? "select item, qty::float8 as qty, source_key from ticket_charges where job_id = $1 order by sort, id"
      : "select l.item, l.qty::float8 as qty, l.source_key from invoices v join invoice_lines l on l.invoice_id = v.id where v.entity_type = $2 and v.entity_id = $1 order by l.sort, l.id",
    t === "job" ? [id] : [id, t],
  );
const waitingNow = async () => (await q("select count(*)::int as n from pg_stat_activity where datname = $1 and wait_event_type = 'Lock'", [DB]))[0].n > 0;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs `first` in an open transaction, starts `second` (which must wait for a lock), commits `first`, returns both. */
async function race(first, second) {
  const a = new pg.Client(db);
  await a.connect();
  const b = new pg.Client(db);
  await b.connect();
  try {
    await a.query("begin");
    const fr = await a.query(first[0], first[1]);
    const bp = b.query(second[0], second[1]);
    await pause(400);
    const waited = await waitingNow();
    await a.query("commit");
    return { first: fr.rows, second: (await bp).rows, waited };
  } finally {
    await a.end();
    await b.end();
  }
}
/** The link statement; `keep`: its lines stay on its own invoice's Sales Order, `note`: noted there now (0122). */
const linkArgs = (rb, kind, id, ownV, stamp, keep = false, note = false, job = null) => [L.linkRebuildSql(), [rb, null, job, kind, id, "chuy", ownV, stamp, "linked", "linked", keep, note]];
const approveArgs = (type, id, seen, items) => [
  I.approveRecordInvoiceSql(),
  [type, id, CAFE, null, null, null, null, null, null, 10, "chuy", seen, items.map((x) => x[0]), items.map(() => ""), items.map((x) => x[1]), items.map((x) => x[2]), items.map(() => "part"), null, false, items.map((x) => x[3] ?? null)],
];
const saveArgs = (job, cur, qty) => [
  C.replaceTicketChargesSql(),
  [job, cur.map((c) => c.item), cur.map(() => ""), cur.map((c) => qty(c)), cur.map((c) => Number(c.rate)), cur.map((c) => c.kind), false, cur.map((c) => Number(c.id)), null, null, null, cur.map((c) => c.source_key), false],
];
const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

// 1. Approving its own invoice holds the locks; the link waits, then sees the new version (fresh) and writes nothing.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const job = await ticket();
  const seen = await ver("rebuild", rb);
  const r = await race(approveArgs("rebuild", rb, seen, [["TEST-A", 1, 10], ["TEST-B", 2, 20]]), linkArgs(rb, "job", job, seen, await stampOf(job)));
  check("approve, then link: the link waits and writes nothing", r.waited && r.first.length === 1 && r.second.length === 0 && (await lines("rebuild", rb)).length === 2 && (await lines("job", job)).length === 0);
}
// 2. The link holds the locks; the approve waits, finds it linked, and writes nothing.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const job = await ticket();
  const seen = await ver("rebuild", rb);
  const r = await race(linkArgs(rb, "job", job, seen, await stampOf(job)), approveArgs("rebuild", rb, seen, [["TEST-A", 5, 10]]));
  check("link, then approve: the approve waits and writes nothing", r.waited && r.first.length === 1 && r.second.length === 0 && (await lines("rebuild", rb)).length === 0 && (await lines("job", job)).length === 1);
}
// 3. No invoice yet: an approve that makes one holds the locks; the link (seen: none) waits and sees it, fresh.
{
  const rb = await rebuild();
  const job = await ticket();
  const r = await race(approveArgs("rebuild", rb, null, [["TEST-NEW", 1, 10]]), linkArgs(rb, "job", job, null, await stampOf(job)));
  check("a new invoice, then link: the link waits and writes nothing", r.waited && r.second.length === 0 && (await lines("rebuild", rb)).length === 1);
}
// 4. Two links of one rebuild to two tickets: the second waits and finds it linked.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const t1 = await ticket();
  const t2 = await ticket();
  const seen = await ver("rebuild", rb);
  const r = await race(linkArgs(rb, "job", t1, seen, await stampOf(t1)), linkArgs(rb, "job", t2, seen, await stampOf(t2)));
  check("two links: the second waits and writes nothing", r.waited && r.second.length === 0 && (await lines("job", t1)).length === 1 && (await lines("job", t2)).length === 0);
}
// 5. A Charges save holds the ticket; the unlink waits, sees the ticket changed, writes nothing; then unlinks fresh.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10], ["TEST-B", 1, 20]]);
  const job = await ticket();
  assert.equal((await q(...linkArgs(rb, "job", job, await ver("rebuild", rb), await stampOf(job)))).length, 1);
  const cur = await q("select id, item, qty, rate, kind, source_key from ticket_charges where job_id = $1 order by sort, id", [job]);
  const un = [L.unlinkRebuildSql(), [rb, null, job, "chuy", await stampOf(job), 2, null, null, null, null, null, "unlinked", "unlinked"]];
  const r = await race(saveArgs(job, cur, (c) => (c.item === "TEST-A" ? 4 : Number(c.qty))), un);
  const onJob = await lines("job", job);
  check("Charges save, then unlink: the unlink waits and writes nothing", r.waited && r.second.length === 0 && onJob.length === 2 && (await lines("rebuild", rb)).length === 0);
  const again = await q(L.unlinkRebuildSql(), [rb, null, job, "chuy", await stampOf(job), 2, null, null, null, null, null, "unlinked", "unlinked"]);
  const back = await lines("rebuild", rb);
  check("unlinked again: the edited lines come back once", again.length === 1 && back.length === 2 && back.find((l) => l.item === "TEST-A").qty === 4 && (await lines("job", job)).length === 0);
}
// 6. The unlink holds the ticket; a Charges save from a panel opened before waits, and writes nothing (no line twice).
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const job = await ticket();
  assert.equal((await q(...linkArgs(rb, "job", job, await ver("rebuild", rb), await stampOf(job)))).length, 1);
  const cur = await q("select id, item, qty, rate, kind, source_key from ticket_charges where job_id = $1", [job]);
  const r = await race([L.unlinkRebuildSql(), [rb, null, job, "chuy", await stampOf(job), 1, null, null, null, null, null, "unlinked", "unlinked"]], saveArgs(job, cur, () => 9));
  check("unlink, then a Charges save: the save waits and writes nothing", r.waited && r.first.length === 1 && r.second.length === 0 && (await lines("job", job)).length === 0 && (await lines("rebuild", rb)).length === 1);
}
// 7. An install's invoice approved while the link waits: the link sees the new version (fresh) and writes nothing.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const ins = await install();
  await q("insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at) values ('install', $1, $2, 0, 'chuy', now() - interval '1 hour')", [ins, CAFE]);
  const r = await race(approveArgs("install", ins, await ver("install", ins), [["TEST-BREWER", 1, 500]]), linkArgs(rb, "install", ins, await ver("rebuild", rb), await installStamp(ins)));
  check("install approve, then link: the link waits and writes nothing", r.waited && r.first.length === 1 && r.second.length === 0 && (await lines("rebuild", rb)).length === 1 && (await lines("install", ins)).length === 1);
}
// 8. The link onto an install holds the locks; an approve opened before waits, and writes nothing over the new lines.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const ins = await install();
  await q("insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at) values ('install', $1, $2, 0, 'chuy', now() - interval '1 hour')", [ins, CAFE]);
  const iv = await ver("install", ins);
  const r = await race(linkArgs(rb, "install", ins, await ver("rebuild", rb), await installStamp(ins)), approveArgs("install", ins, iv, [["TEST-BREWER", 1, 500]]));
  const il = await lines("install", ins);
  check("link, then install approve: the approve waits and writes nothing", r.waited && r.first.length === 1 && r.second.length === 0 && il.length === 1 && il[0].source_key?.startsWith(`rb:${rb}:`));
}
// 9. Unlink from an install while an approve waits: the approve writes nothing; the line is the rebuild's once.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const ins = await install();
  assert.equal((await q(...linkArgs(rb, "install", ins, await ver("rebuild", rb), await installStamp(ins)))).length, 1);
  const keyed = (await lines("install", ins)).map((l) => [l.item, l.qty, 10, l.source_key]);
  const r = await race([L.unlinkRebuildSql(), [rb, ins, null, "chuy", await installStamp(ins), 1, null, null, null, null, null, "unlinked", "unlinked"]], approveArgs("install", ins, await ver("install", ins), keyed));
  check("unlink, then install approve: the approve waits and writes nothing", r.waited && r.first.length === 1 && r.second.length === 0 && (await lines("install", ins)).length === 0 && (await lines("rebuild", rb)).length === 1);
}
// 10. A link onto a ticket holds the locks; a merge of that ticket into an install, confirmed before, waits and stops.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const job = await ticket("WO-7300", CAFE, "Scheduled");
  const ins = await install("WO-7300");
  const p = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: job, installId: ins });
  const a = new pg.Client(db);
  await a.connect();
  await a.query("begin");
  const linked = await a.query(...linkArgs(rb, "job", job, await ver("rebuild", rb), await stampOf(job)));
  const merging = M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId: job, installId: ins, stamps: p.stamps, billedSo: "", billedOn: "" }).then((r) => ({ r }), (e) => ({ e: e.message }));
  await pause(400);
  const waited = await waitingNow();
  await a.query("commit");
  await a.end();
  const m = await merging;
  check("link, then a ticket-into-install merge: the merge waits and merges nothing", linked.rows.length === 1 && waited && !!m.e && (await lines("job", job)).length === 1);
  const p2 = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: job, installId: ins });
  await M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId: job, installId: ins, stamps: p2.stamps, billedSo: "", billedOn: "" });
  const after = (await q("select install_id, job_id from rebuilds where id = $1", [rb]))[0];
  const il = await lines("install", ins);
  check("merged after: the rebuild and its keyed lines are on the install", after.install_id === ins && after.job_id === null && il.length === 1 && il[0].source_key?.startsWith(`rb:${rb}:`));
}
// 11. Warehouse's Save for Approval vs a link, both orders.
{
  const SD = "Katz Coffee Service Dept.";
  const save = (rb) => [I.saveForApprovalSql(), [rb, SD, null, null, SD, null, null, null, 10, "wes", ["TEST-A"], [""], [1], [10], ["part"], ["katzcoffeeservicedept"]]];
  const rb = await rebuild(SD);
  const job = await ticket();
  const r = await race(save(rb), linkArgs(rb, "job", job, null, await stampOf(job)));
  check("Warehouse save, then link: the link waits and writes nothing", r.waited && r.first.length === 1 && r.second.length === 0 && (await lines("rebuild", rb)).length === 1);
  const rb2 = await rebuild(SD);
  const job2 = await ticket(undefined, SD);
  const r2 = await race(linkArgs(rb2, "job", job2, null, await stampOf(job2)), save(rb2));
  check("link, then Warehouse save: the save waits and writes nothing", r2.waited && r2.first.length === 1 && r2.second.length === 0 && (await lines("rebuild", rb2)).length === 0);
}
// 12. Merge installs confirmed before a link onto the install it drops (11/6 review, A and A2): it waits, and merges
//     nothing, so the rebuild is never left on an install off the board.
for (const withInvoice of [false, true]) {
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10], ["TEST-B", 2, 20]]);
  const keep = await install();
  const drop = await install();
  if (withInvoice) await q("insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at) values ('install', $1, $2, 0, 'chuy', now() - interval '1 hour')", [drop, CAFE]);
  const a = new pg.Client(db);
  await a.connect();
  await a.query("begin");
  const linked = await a.query(...linkArgs(rb, "install", drop, await ver("rebuild", rb), await installStamp(drop)));
  const merging = P.mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop }).then((r) => ({ r }), (e) => ({ e: e.message }));
  await pause(500);
  const waited = await waitingNow();
  await a.query("commit");
  await a.end();
  const m = await merging;
  const r = (await q("select install_id from rebuilds where id = $1", [rb]))[0];
  const d = (await q("select archived from installs where id = $1", [drop]))[0];
  check(
    `link onto the install Merge installs drops${withInvoice ? ", with an invoice" : ""}: the merge waits and merges nothing`,
    linked.rows.length === 1 && waited && !!m.e && r.install_id === drop && d.archived === false && (await lines("install", drop)).length === 2 && (await lines("install", keep)).length === 0,
    { merge: m.e ?? m.r },
  );
}
// 13. A ticket-into-install merge and an Unlink at once (11/6 review, C): Postgres may stop one for a deadlock. The
//     Unlink then says the rebuild changed; nothing is lost or billed twice either way.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const job = await ticket("WO-8301", CAFE, "Scheduled");
  const ins = await install("WO-8301");
  const v0 = await L.getRebuildLinkFor(sql, rb, "u-owner");
  const f = await L.findRebuildLinksFor(sql, { id: rb, pick: { kind: "job", id: job } }, "u-owner");
  await L.setRebuildLinkFor(sql, { id: rb, expect: { installId: null, jobId: null }, to: f.candidates[0].target, seen: { own: v0.own.version, current: null, target: f.candidates[0].project.stamp }, salesOrder: "not" }, "u-owner");
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  const p = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: job, installId: ins });
  const a = new pg.Client(db);
  await a.connect();
  await a.query("begin");
  await a.query("select id from service_jobs where id = $1 for update", [job]);
  const unlinking = L.setRebuildLinkFor(sql, { id: rb, expect: { installId: null, jobId: job }, to: null, seen: { own: v.own.version, current: v.current.stamp, target: null } }, "u-owner").then(
    (r) => ({ r: r.message }),
    (e) => ({ e: e.message }),
  );
  await pause(300);
  const aq = async (t, prm) => (await a.query(t, prm)).rows;
  const bound = Object.assign(async (s, ...vals) => aq(s.reduce((acc, x, i) => `${acc}$${i}${x}`), vals), { query: aq });
  const merged = await M.mergeTicketIntoInstallFor(bound, "u-owner", { jobId: job, installId: ins, stamps: p.stamps, billedSo: "", billedOn: "" }).then(
    () => true,
    (e) => e.message,
  );
  await a.query("commit").catch(() => a.query("rollback").catch(() => null));
  await a.end();
  const un = await unlinking;
  const keyed = [...(await lines("install", ins)), ...(await lines("rebuild", rb)), ...(await lines("job", job)).filter((l) => l.source_key)];
  const billed = (await lines("install", ins)).length + (await lines("rebuild", rb)).length;
  check(
    "a ticket-into-install merge and an Unlink at once: one wins, the other says so, and the line is on one bill",
    (un.r || /changed since you looked/.test(un.e ?? "")) && billed === 1 && keyed.length >= 1,
    { merged, unlink: un },
  );
}
// 14. A WO-duplicate merge and an Unlink at once (11/6 review, D): the same.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const extra = await ticket("WO-8401", CAFE, "Scheduled");
  const keeper = await ticket("WO-8401", CAFE, "Scheduled");
  assert.equal((await q(...linkArgs(rb, "job", extra, await ver("rebuild", rb), await stampOf(extra)))).length, 1);
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  const a = new pg.Client(db);
  await a.connect();
  await a.query("begin");
  await a.query("select id from service_jobs where id = any($1::int[]) order by id for update", [[keeper, extra]]);
  const unlinking = L.setRebuildLinkFor(sql, { id: rb, expect: { installId: null, jobId: extra }, to: null, seen: { own: v.own.version, current: v.current.stamp, target: null } }, "u-owner").then(
    (r) => ({ r: r.message }),
    (e) => ({ e: e.message }),
  );
  await pause(300);
  const stamps = await a.query("select id, updated_at::text as u from service_jobs where id = any($1::int[])", [[keeper, extra]]);
  const su = (id) => stamps.rows.find((x) => Number(x.id) === id).u;
  const merged = await a
    .query(W.mergeTicketsSql(), [keeper, extra, "chuy", CAFE, null, null, null, null, null, "Test Tech", "WO-8401", null, null, null, null, null, "Normal", su(keeper), su(extra)])
    .then((r) => r.rows.length, (e) => e.message);
  await a.query("commit").catch(() => a.query("rollback").catch(() => null));
  await a.end();
  const un = await unlinking;
  const onBills = (await lines("job", keeper)).length + (await lines("job", extra)).length + (await lines("rebuild", rb)).length;
  check("a WO-duplicate merge and an Unlink at once: one wins, the other says so, and the line is on one bill", (un.r || /changed since you looked/.test(un.e ?? "")) && onBills === 1, { merged, unlink: un });
}

// 15. A link onto an install holds its locks; Remove, checked before the link committed, waits on the install row,
// then sees the install changed and removes nothing (11/6 review, round 6).
{
  const ins = await install();
  const rb = await rebuild();
  const a = new pg.Client(db);
  await a.connect();
  await a.query("begin");
  const linked = await a.query(...linkArgs(rb, "install", ins, await ver("rebuild", rb), await installStamp(ins)));
  const removing = P.archiveInstallFor(sql, "u-owner", ins).then(() => "removed", (e) => e.message);
  await pause(400);
  const waited = await waitingNow();
  await a.query("commit");
  await a.end();
  const r = await removing;
  const off = (await q("select archived from installs where id = $1", [ins]))[0].archived;
  check("a link, then Remove: Remove waits and removes nothing", linked.rows.length === 1 && waited && off === false && /changed while you removed it/.test(r), { r });
}
// 16. A ticket merged into an install brings a linked rebuild while Remove waits: the same.
{
  const ins = await install("WO-8501");
  const job = await ticket("WO-8501", CAFE, "Scheduled");
  const rb = await rebuild();
  assert.equal((await q(...linkArgs(rb, "job", job, await ver("rebuild", rb), await stampOf(job)))).length, 1);
  const p = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: job, installId: ins });
  const a = new pg.Client(db);
  await a.connect();
  await a.query("begin");
  const aq = async (t, prm) => (await a.query(t, prm)).rows;
  const bound = Object.assign(async (s, ...vals) => aq(s.reduce((acc, x, i) => `${acc}$${i}${x}`), vals), { query: aq });
  await M.mergeTicketIntoInstallFor(bound, "u-owner", { jobId: job, installId: ins, stamps: p.stamps, billedSo: "", billedOn: "" });
  const removing = P.archiveInstallFor(sql, "u-owner", ins).then(() => "removed", (e) => e.message);
  await pause(400);
  const waited = await waitingNow();
  await a.query("commit");
  await a.end();
  const r = await removing;
  const off = (await q("select archived from installs where id = $1", [ins]))[0].archived;
  const on = (await q("select install_id from rebuilds where id = $1", [rb]))[0].install_id;
  check("a ticket merge brings a rebuild, then Remove: Remove waits and removes nothing", waited && off === false && on === ins && /changed while you removed it/.test(r), { r });
}
// 17. The keeper's invoice approved while Merge installs, checked before, waits: the merge reads the approval fresh and
// refuses, so a rebuild linked to the drop isn't left on a bill that took nothing of it (11/6 review, round 6).
{
  const keep = await install();
  const drop = await install();
  const rb = await rebuild(CAFE);
  await q("insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at) values ('install', $1, $2, 0, 'chuy', now() - interval '1 day')", [keep, CAFE]);
  assert.equal((await q(...linkArgs(rb, "install", drop, await ver("rebuild", rb), await installStamp(drop)))).length, 1);
  const a = new pg.Client(db);
  await a.connect();
  await a.query("begin");
  const appr = await a.query(...approveArgs("install", keep, await ver("install", keep), [["TEST-BREWER", 1, 500]]));
  const merging = P.mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop }).then(() => "merged", (e) => e.message);
  await pause(500);
  const waited = await waitingNow();
  await a.query("commit");
  await a.end();
  const m = await merging;
  const on = (await q("select install_id from rebuilds where id = $1", [rb]))[0].install_id;
  const dropOff = (await q("select archived from installs where id = $1", [drop]))[0].archived;
  check(
    "an Approve of the keeper's invoice, then Merge installs: the merge waits and merges nothing",
    appr.rows.length === 1 && waited && on === drop && dropOff === false && /couldn't bill there/.test(m),
    { m },
  );
}

// 18. Not the link's own: an Approve that puts a line on the drop's empty invoice holds its lock while Merge installs,
// checked before, waits. One install takes one invoice, and the keeper has its own: the merge reads both invoices again
// on its locked rows and refuses, rather than leave the line on the archived drop (11/6 review, round 7).
{
  const keep = await install();
  const drop = await install();
  const kInv = Number((await q("insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at) values ('install', $1, $2, 50, 'chuy', now()) returning id", [keep, CAFE]))[0].id);
  await q("insert into invoice_lines (invoice_id, item, qty, rate, kind, sort) values ($1, 'TEST-K18', 1, 50, 'part', 1)", [kInv]);
  await q("insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at) values ('install', $1, $2, 0, 'chuy', now())", [drop, CAFE]);
  const a = new pg.Client(db);
  await a.connect();
  await a.query("begin");
  const appr = await a.query(...approveArgs("install", drop, await ver("install", drop), [["TEST-D18", 1, 75]]));
  const merging = P.mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop }).then(() => "merged", (e) => e.message);
  await pause(500);
  const waited = await waitingNow();
  await a.query("commit");
  await a.end();
  const m = await merging;
  const dropOff = (await q("select archived from installs where id = $1", [drop]))[0].archived;
  check(
    "an Approve puts a line on the drop's invoice, then Merge installs: the merge waits and merges nothing",
    appr.rows.length === 1 && waited && dropOff === false && /both have an invoice/.test(m),
    { m },
  );
}

// 19. A note that the rebuild's invoice is on a Sales Order holds the rebuild (linked before 11/6, its own lines still
// there); a not-yet link, checked before, waits. The note changes no version: the link reads it fresh and moves nothing.
{
  const job = await ticket("WO-8601", CAFE, "Scheduled");
  const rb = await rebuild(CAFE);
  await q("update rebuilds set job_id = $2 where id = $1", [rb, job]);
  await own(rb, [["TEST-A", 1, 10], ["TEST-B", 1, 20]]);
  const seen = await ver("rebuild", rb);
  const r = await race([L.noteRebuildSalesOrderSql(), [rb, null, job, "chuy", seen, "noted"]], linkArgs(rb, "job", job, seen, await stampOf(job), false, false, job));
  check(
    "a note that its invoice is on a Sales Order, then a not-yet link: the link waits, reads the note fresh, and moves nothing",
    r.waited && r.first[0].noted === 1 && r.second.length === 0 && (await lines("rebuild", rb)).length === 2 && (await lines("job", job)).length === 0,
    r,
  );
}
// 20. The not-yet link holds the rebuild; the note waits, finds its invoice gone (its lines are on the ticket now), and
// notes nothing.
{
  const job = await ticket("WO-8602", CAFE, "Scheduled");
  const rb = await rebuild(CAFE);
  await q("update rebuilds set job_id = $2 where id = $1", [rb, job]);
  await own(rb, [["TEST-A", 1, 10]]);
  const seen = await ver("rebuild", rb);
  const r = await race(linkArgs(rb, "job", job, seen, await stampOf(job), false, false, job), [L.noteRebuildSalesOrderSql(), [rb, null, job, "chuy", seen, "noted"]]);
  const left = (await q("select count(*)::int as n from invoices where entity_type = 'rebuild' and entity_id = $1", [rb]))[0].n;
  check("a not-yet link, then a note: the note waits, finds its invoice gone, and notes nothing", r.waited && r.first.length === 1 && r.second[0].noted === 0 && (await lines("job", job)).length === 1 && left === 0, r);
}
// 21. Its own invoice approved again (other lines) while a yes link waits: the link reads the new version fresh and
// neither links it nor notes lines the person never answered for.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const job = await ticket();
  const seen = await ver("rebuild", rb);
  const r = await race(approveArgs("rebuild", rb, seen, [["TEST-A", 1, 10], ["TEST-B", 2, 20]]), linkArgs(rb, "job", job, seen, await stampOf(job), true, true));
  const noted = (await q("select rebuild_invoice_on_so($1) as s", [rb]))[0].s;
  const linked = (await q("select job_id from rebuilds where id = $1", [rb]))[0].job_id;
  check("an approve, then a yes link: the link waits, reads the new version, and links and notes nothing", r.waited && r.first.length === 1 && r.second.length === 0 && noted === false && linked === null && (await lines("rebuild", rb)).length === 2, r);
}
// 22. The yes link holds the rebuild; an Approve of its own invoice, checked before, waits, finds it linked, and writes
// nothing: the note still counts.
{
  const rb = await rebuild();
  await own(rb, [["TEST-A", 1, 10]]);
  const job = await ticket();
  const seen = await ver("rebuild", rb);
  const r = await race(linkArgs(rb, "job", job, seen, await stampOf(job), true, true), approveArgs("rebuild", rb, seen, [["TEST-A", 5, 10]]));
  const noted = (await q("select rebuild_invoice_on_so($1) as s", [rb]))[0].s;
  const mine = await lines("rebuild", rb);
  check(
    "a yes link, then an approve: the approve waits and writes nothing, and the note still counts",
    r.waited && r.first.length === 1 && r.first[0].noted === 1 && r.second.length === 0 && noted === true && mine.length === 1 && mine[0].qty === 1 && (await lines("job", job)).length === 0,
    r,
  );
}

await pool.end();
const admin2 = new pg.Client({ ...base, database: "postgres" });
await admin2.connect();
await admin2.query(`drop database if exists ${DB}`);
await admin2.end();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail && !r.ok ? ` — ${JSON.stringify(r.detail)}` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
