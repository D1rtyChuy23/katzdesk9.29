// Move a PM to a service ticket, and back (Chuy, 11/18). The case: WO-1107, PM #171, a Mazzer hopper repair filed as
// a PM. Made-up accounts and people; the shapes copy that case.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const M = await import("../src/lib/ops/pm-to-ticket.ts");
const C = await import("../src/lib/ops/corrigo.ts");
const { previewCorrigoRecords } = await import("../src/lib/ops/corrigo-import.ts");
const { updatePmFor } = await import("../src/lib/ops/api.ts");

async function freshDb() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await query("insert into directory_customers (name) values ('ZZ Halcyon - Southtown')");
  await query("insert into desk_accounts (user_id, username, approved, is_admin) values ('u_boss', 'boss.zz', true, true), ('u_tech', 'tech.zz', true, false)");
  const pm = async (extra = {}) => {
    const f = { customer: "ZZ Halcyon - Southtown", status: "Scheduled", technician: "Sam ZZ", wo: "WO-1107", projected: "2026-11-19", received: "2026-11-12",
      equipment: "Mazzer Super Jolly", notes: "Hopper cracked", corrigo_id: "C-1107", service_location: "ZZ Halcyon - Southtown", po: "PO-77", vendor_po: null,
      sched_time: "09:00", work_done: null, completed_at: null, ...extra };
    const cols = Object.keys(f);
    return Number((await query(`insert into pm_jobs (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f)))[0].id);
  };
  const stampOf = async (id) => (await M.previewPmMoveFor(sql, "u_boss", id)).stamp;
  const move = async (id) => M.movePmToTicketFor(sql, "u_boss", { pmId: id, stamp: await stampOf(id) });
  const job = async (id) => (await query("select *, to_char(received, 'YYYY-MM-DD') as rec, to_char(scheduled, 'YYYY-MM-DD') as sch, to_char(completed_at, 'YYYY-MM-DD') as done_on from service_jobs where id = $1", [id]))[0];
  const pmRow = async (id) => (await query("select *, to_char(projected, 'YYYY-MM-DD') as proj, to_char(completed_at, 'YYYY-MM-DD') as done_on from pm_jobs where id = $1", [id]))[0];
  return { pg, sql, query, pm, move, job, pmRow, stampOf };
}

test("WO-1107's shape: the PM becomes a Field Service ticket on the same account with its WO, tech, status, dates and Corrigo fields", async () => {
  const { pg, sql, query, pm, move, job, pmRow } = await freshDb();
  try {
    const id = await pm();
    const preview = await M.previewPmMoveFor(sql, "u_boss", id);
    assert.deepEqual([preview.refusal, preview.pmStatus, preview.ticketStatus, preview.wo], [null, "Scheduled", "Dispatched", "WO-1107"]);
    const res = await move(id);
    assert.match(res.callId, /^SC-202611-\d+$/);
    const t = await job(res.jobId);
    assert.deepEqual(
      [t.kind, t.customer, t.call_type, t.status, t.done, t.technician, t.wo, t.rec, t.sch, t.sched_time, t.equipment, t.notes, t.po, t.corrigo_id, t.service_location, t.moved_from_pm_id, t.issue],
      ["service", "ZZ Halcyon - Southtown", "Field Service", "Dispatched", false, "Sam ZZ", "WO-1107", "2026-11-12", "2026-11-19", "09:00", "Mazzer Super Jolly", "Hopper cracked", "PO-77", "C-1107", "ZZ Halcyon - Southtown", id, `Moved from PM #${id}`],
    );
    // The PM stays, closed, pointing at the ticket; its WO and Corrigo id went with the work.
    const p = await pmRow(id);
    assert.deepEqual([p.status, p.done, p.wo, p.corrigo_id, p.moved_job_id, p.customer, p.technician], [M.MOVED_STATUS, true, null, null, res.jobId, "ZZ Halcyon - Southtown", "Sam ZZ"]);
    // The log keeps the PM as it was.
    const [logRow] = await query("select pm_id, job_id, moved_by, pm_before from pm_ticket_moves");
    assert.deepEqual([logRow.pm_id, logRow.job_id, logRow.moved_by, logRow.pm_before.wo, logRow.pm_before.status, logRow.pm_before.corrigo_id], [id, res.jobId, "boss.zz", "WO-1107", "Scheduled", "C-1107"]);
    assert.equal("stamp" in logRow.pm_before, false);
    // History on both.
    const acts = await query("select entity_type, entity_id, action from activity order by id");
    assert.deepEqual(acts.map((a) => [a.entity_type, a.entity_id, a.action]), [["pm", id, "moved-to-ticket"], ["service", res.jobId, "moved-from-pm"]]);
    // The ticket knows where it came from.
    const info = await M.pmMoveInfoFor(sql, res.jobId);
    assert.deepEqual([info.pmId, info.movedBy, info.refusal], [id, "boss.zz", null]);
  } finally {
    await pg.close();
  }
});

test("each PM status maps to a ticket status, and back; a completed PM is a completed, done ticket", async () => {
  const { pg, pm, move, job } = await freshDb();
  try {
    for (const [pmStatus, ticketStatus] of Object.entries(M.PM_TO_TICKET_STATUS)) {
      const id = await pm({ status: pmStatus, wo: null, corrigo_id: null, completed_at: pmStatus === "Completed" ? "2026-11-14" : null, work_done: pmStatus === "Completed" ? "Replaced hopper" : null });
      const t = await job((await move(id)).jobId);
      assert.equal(t.status, ticketStatus, pmStatus);
      assert.equal(t.done, ["Completed", "Cancelled"].includes(ticketStatus), pmStatus);
      if (pmStatus === "Completed") assert.deepEqual([t.done_on, t.work_done], ["2026-11-14", "Replaced hopper"]);
    }
    for (const s of ["Pending Scheduling", "Scheduled", "Awaiting Parts", "In Progress", "Completed", "Cancelled"]) {
      assert.ok(M.TICKET_TO_PM_STATUS[M.PM_TO_TICKET_STATUS[s]], s);
    }
  } finally {
    await pg.close();
  }
});

test("a later Corrigo import of the WO updates the ticket, never the PM", async () => {
  const { pg, sql, pm, move } = await freshDb();
  try {
    const id = await pm();
    const { jobId } = await move(id);
    const { records } = C.parseCorrigoMatrix([
      ["ST#", "Operational Status", "Customer Name", "Type", "Problem Description", "Date Completed", "P.O. #"],
      ["1107", "Completed", "ZZ Halcyon - Southtown", "PM", "Mazzer hopper", "11/19/2026", "PO-77"],
    ]);
    const preview = await previewCorrigoRecords(sql, records);
    const row = preview.rows.find((r) => r.canonicalWo === "WO-1107");
    assert.deepEqual([row.board, row.action, row.jobId], ["service", "update", jobId]);
  } finally {
    await pg.close();
  }
});

test("refused: not an Admin, a stale window, stacked on a ticket, billing on it, or moved already; nothing is written", async () => {
  const { pg, sql, query, pm, move, stampOf } = await freshDb();
  try {
    const plain = await pm();
    await assert.rejects(M.movePmToTicketFor(sql, "u_tech", { pmId: plain, stamp: await stampOf(plain) }), new RegExp(M.ADMIN_ONLY.slice(0, 20)));
    const stamp = await stampOf(plain);
    await query("update pm_jobs set notes = 'changed', updated_at = now() + interval '1 second' where id = $1", [plain]);
    await assert.rejects(M.movePmToTicketFor(sql, "u_boss", { pmId: plain, stamp }), /changed since this window opened/);

    const ticket = Number((await query("insert into service_jobs (kind, call_id, customer) values ('service', 'SC-ZZ-1', 'ZZ Halcyon - Southtown') returning id"))[0].id);
    const stacked = await pm({ wo: "WO-2001", stacked_job_id: ticket });
    await assert.rejects(move(stacked), /stacked on a ticket/);

    const ns = await pm({ wo: "WO-2002" });
    await query("insert into record_ns_billing (pm_id, wo, wo_key) values ($1, 'WO-2002', 'wo2002')", [ns]).catch(async () => {
      await query("insert into record_ns_invoices (pm_id, ns_invoice, wo) values ($1, 'INV-ZZ', 'WO-2002')", [ns]);
    });
    await assert.rejects(move(ns), /NetSuite billing/);

    const billed = await pm({ wo: "WO-2003" });
    const inv = Number((await query("insert into invoices (entity_type, entity_id, customer) values ('pm', $1, 'ZZ Halcyon - Southtown') returning id", [billed]))[0].id);
    await query("insert into invoice_lines (invoice_id, item, qty, rate) values ($1, 'LABOR', 1, 100)", [inv]);
    await assert.rejects(move(billed), /invoice with lines/);

    const once = await pm({ wo: "WO-2004" });
    await move(once);
    await assert.rejects(move(once), /moved to a service ticket already/);

    assert.equal((await query("select count(*)::int as n from service_jobs where moved_from_pm_id is not null"))[0].n, 1);
    assert.equal((await query("select count(*)::int as n from pm_ticket_moves"))[0].n, 1);
  } finally {
    await pg.close();
  }
});

test("a moved PM can't be edited, and leaves the PM board, search and the account's PMs", async () => {
  const { pg, sql, query, pm, move } = await freshDb();
  try {
    const id = await pm();
    await move(id);
    await assert.rejects(updatePmFor(sql, { id, notes: "late edit" }, "u_boss"), /moved to a service ticket/);
    const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
    assert.match(api, /select \* from pm_jobs where moved_job_id is null order by received desc/);
    assert.match(api, /where lower\(customer\) = lower\(\$\{name\}\) and moved_job_id is null/);
    for (const [file, text] of [
      ["src/lib/ops/analytics-api.ts", "from pm_jobs where moved_job_id is null"],
      ["src/lib/ops/export-reports.ts", "from pm_jobs where moved_job_id is null"],
      ["src/lib/ops/billing-report-api.ts", "from pm_jobs where moved_job_id is null"],
      ["src/lib/ops/teams-reports.ts", "and p.moved_job_id is null"],
      ["src/lib/ops/record-billing-api.ts", "and p.moved_job_id is null"],
      ["src/lib/ops/pm-runbook-readiness-api.ts", "and moved_job_id is null"],
      ["src/lib/ops/wo-search.ts", "where moved_job_id is null and"],
    ]) {
      assert.ok(readFileSync(new URL(`../${file}`, import.meta.url), "utf8").includes(text), file);
    }
    assert.equal((await query("select count(*)::int as n from pm_jobs where moved_job_id is null and lower(customer) = lower('ZZ Halcyon - Southtown')"))[0].n, 0);
  } finally {
    await pg.close();
  }
});

test("Move back: the PM takes the ticket's work as it is now and opens again; the ticket is closed as Cancelled; nothing is deleted", async () => {
  const { pg, sql, query, pm, move, job, pmRow } = await freshDb();
  try {
    const id = await pm();
    const { jobId } = await move(id);
    // Work went on on the ticket meanwhile.
    await query("update service_jobs set technician = 'Ana ZZ', status = 'Completed', done = true, work_done = 'Replaced hopper', completed_at = '2026-11-19', updated_at = now() where id = $1", [jobId]);
    const info = await M.pmMoveInfoFor(sql, jobId);
    await assert.rejects(M.undoPmMoveFor(sql, "u_tech", { jobId, stamp: info.stamp }), new RegExp(M.ADMIN_ONLY.slice(0, 20)));
    const back = await M.undoPmMoveFor(sql, "u_boss", { jobId, stamp: info.stamp });
    assert.deepEqual(back, { pmId: id, status: "Completed" });
    const p = await pmRow(id);
    assert.deepEqual([p.moved_job_id, p.status, p.done, p.technician, p.wo, p.corrigo_id, p.work_done, p.done_on, p.proj], [null, "Completed", true, "Ana ZZ", "WO-1107", "C-1107", "Replaced hopper", "2026-11-19", "2026-11-19"]);
    const t = await job(jobId);
    assert.deepEqual([t.duplicate_of, t.status, t.done, t.wo, t.corrigo_id, t.moved_from_pm_id], [null, "Cancelled", true, null, null, id]);
    assert.match(t.notes, new RegExp(`Moved back to PM #${id} by boss\\.zz\\.$`));
    const [logRow] = await query("select undone_by, job_before_undo from pm_ticket_moves");
    assert.deepEqual([logRow.undone_by, logRow.job_before_undo.wo, logRow.job_before_undo.technician], ["boss.zz", "WO-1107", "Ana ZZ"]);
    assert.equal(await M.pmMoveInfoFor(sql, jobId), null);
    // The PM can go again; it makes a new ticket.
    const again = await move(id);
    assert.notEqual(again.jobId, jobId);
    assert.equal((await job(again.jobId)).wo, "WO-1107");
  } finally {
    await pg.close();
  }
});

test("Move back is refused once the ticket has charges, is billed, or changed since the window opened", async () => {
  const { pg, sql, query, pm, move } = await freshDb();
  try {
    const id = await pm();
    const { jobId } = await move(id);
    const stamp = (await M.pmMoveInfoFor(sql, jobId)).stamp;
    await query("update service_jobs set notes = 'edited', updated_at = now() + interval '1 second' where id = $1", [jobId]);
    await assert.rejects(M.undoPmMoveFor(sql, "u_boss", { jobId, stamp }), /changed since this window opened/);
    await query("insert into ticket_charges (job_id, item, qty, rate) values ($1, 'LABOR', 1, 95)", [jobId]);
    const info = await M.pmMoveInfoFor(sql, jobId);
    assert.match(info.refusal, /has charges/);
    await assert.rejects(M.undoPmMoveFor(sql, "u_boss", { jobId, stamp: info.stamp }), /has charges/);
    const id2 = await pm({ wo: "WO-1108", corrigo_id: null });
    const second = await move(id2);
    await query("update service_jobs set ns_so = 'SO-9' where id = $1", [second.jobId]);
    assert.match((await M.pmMoveInfoFor(sql, second.jobId)).refusal, /billed/);
    // Neither PM moved back.
    assert.deepEqual((await query("select moved_job_id from pm_jobs where id = any($1::int[]) order by id", [[id, id2]])).map((r) => r.moved_job_id), [jobId, second.jobId]);
  } finally {
    await pg.close();
  }
});
