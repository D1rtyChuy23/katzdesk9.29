import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { stackCustomerRefusal, stackPmSql, stackRefusal, unstackPmSql } = await import("../src/lib/ops/pm-stack.ts");
const { stackedPmLock } = await import("../src/lib/ops/invoice.ts");
const { approvePmInvoiceSql, pmInvoiceLock } = await import("../src/lib/ops/invoice-api.ts");
const { explainUnstack, listForJob, listForPm } = await import("../src/lib/ops/pm-stack-api.ts");

const pg = new PGlite();
const dir = new URL("../migrations/", import.meta.url);
for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
  await pg.exec(readFileSync(new URL(name, dir), "utf8"));
}
await pg.exec("select setval('pm_jobs_id_seq', 5000); select setval('service_jobs_id_seq', 5000);");
const sql = { query: async (text, params) => (await pg.query(text, params)).rows };

let n = 0;
async function ticket(fields = {}) {
  n += 1;
  const row = await pg.query(
    `insert into service_jobs (kind, call_id, customer, wo, status, ns_so, phone_resolved, duplicate_of)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [
      fields.kind ?? "service",
      fields.callId ?? `SC-STACK-${n}`,
      fields.customer === undefined ? "Levy GRB" : fields.customer,
      fields.wo ?? null,
      fields.status ?? "Open",
      fields.nsSo ?? null,
      fields.phoneResolved ?? false,
      fields.duplicateOf ?? null,
    ],
  );
  return Number(row.rows[0].id);
}
async function pm(fields = {}) {
  n += 1;
  const row = await pg.query(
    `insert into pm_jobs (customer, equipment, status, technician, style, stacked_job_id)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      fields.customer ?? "Levy GRB",
      fields.equipment ?? "Faema X20",
      fields.status ?? "Awaiting Parts",
      fields.technician ?? null,
      fields.style ?? null,
      fields.stackedJobId ?? null,
    ],
  );
  return Number(row.rows[0].id);
}
async function charge(jobId, sourceKey) {
  await pg.query(
    "insert into ticket_charges (job_id, item, qty, rate, kind, sort, source_key) values ($1, 'PARTS : X', 1, 10, 'part', 1, $2)",
    [jobId, sourceKey],
  );
}

const basePm = { id: 32, customer: "Levy GRB", status: "Awaiting Parts", stackedJobId: null };
const baseTicket = {
  id: 523,
  customer: "Levy GRB",
  status: "Open",
  nsSo: null,
  duplicateOf: null,
  phoneResolved: false,
  wo: "WO-0361",
  callId: "SC-202608-544",
};

test("stackRefusal names the first reason", () => {
  assert.equal(stackRefusal({ ...basePm, status: "Cancelled" }, { ...baseTicket, status: "Cancelled" }, 0, false), "PM #32 is cancelled.");
  assert.equal(stackRefusal(basePm, { ...baseTicket, status: "Cancelled" }, 0, false), "Ticket #523 is cancelled.");
  assert.equal(stackRefusal(basePm, { ...baseTicket, status: "Phone Resolved" }, 0, false), "Ticket #523 was phone resolved, so there is no visit to bill.");
  assert.equal(stackRefusal(basePm, { ...baseTicket, phoneResolved: true }, 0, false), "Ticket #523 was phone resolved, so there is no visit to bill.");
  assert.equal(stackRefusal(basePm, { ...baseTicket, nsSo: "SO4401" }, 0, false), "Ticket #523 is billed (SO4401). Clear its Sales Order first.");
  assert.equal(stackRefusal(basePm, { ...baseTicket, duplicateOf: 500 }, 0, false), "Ticket #523 was merged into #500. Stack the PM there.");
  assert.equal(stackRefusal({ ...basePm, stackedJobId: 523 }, baseTicket, 1, false), "PM #32 is already on this ticket.");
  assert.equal(stackRefusal({ ...basePm, stackedJobId: 500 }, baseTicket, 0, false), "PM #32 is already on ticket #500. Unstack it first.");
  assert.equal(stackRefusal({ ...basePm, customer: "Walk-in" }, { ...baseTicket, customer: "Walk-in" }, 0, false), "Only a PM and ticket for a real customer can be stacked.");
  assert.equal(stackRefusal({ ...basePm, customer: "  " }, baseTicket, 0, false), "Only a PM and ticket for a real customer can be stacked.");
  assert.equal(stackRefusal(basePm, { ...baseTicket, customer: "Other Co" }, 0, false), "PM #32 is for Levy GRB, but ticket #523 is for Other Co.");
  assert.equal(stackRefusal(basePm, baseTicket, 10, false), "Ticket #523 already carries 10 PMs.");
  assert.equal(stackRefusal(basePm, baseTicket, 0, true), "PM #32 already has its own approved invoice, so it stays billed there.");
  assert.equal(stackRefusal({ ...basePm, status: "Completed" }, { ...baseTicket, status: "Completed" }, 0, false), null);
  // Invoiced in NetSuite (10/28): its charges are locked, so a PM put on it could never be billed there.
  assert.equal(stackRefusal(basePm, { ...baseTicket, invoiced: "INV4402" }, 0, false), "Ticket #523 is invoiced in NetSuite (INV4402). Bill the PM on its own.");
});

test("a ticket invoiced in NetSuite takes no PM: it isn't offered, and stacking writes nothing", async () => {
  const t = await ticket({ customer: "Zz Stack Invoiced", status: "Completed" });
  const p = await pm({ customer: "Zz Stack Invoiced", status: "Completed" });
  await pg.query("insert into ticket_invoices (job_id, ns_invoice, status, total) values ($1, 'INV4402', 'Open', 50)", [t]);
  assert.ok(!(await listForPm(sql, p)).candidates.some((c) => c.jobId === t), "not offered");
  assert.equal((await sql.query(stackPmSql(), [p, t, "Oliver"])).length, 0, "nothing written");
  // A Voided invoice doesn't lock it.
  await pg.query("update ticket_invoices set status = 'Voided' where job_id = $1", [t]);
  assert.ok((await listForPm(sql, p)).candidates.some((c) => c.jobId === t));
  assert.equal((await sql.query(stackPmSql(), [p, t, "Oliver"])).length, 1);
});

test("stacking a completed PM on a completed ticket writes both activity rows", async () => {
  await pg.query(
    `insert into service_jobs (id, kind, call_id, customer, wo, status) values (99, 'service', 'SC-PORSCHE-99', 'Porsche - Houston', 'WO-9257', 'Completed')`,
  );
  await pg.query(
    `insert into pm_jobs (id, customer, equipment, status, technician) values (4, 'Porsche - Houston', 'Linea PB + Swift', 'Completed', 'Oliver')`,
  );
  const forPm = await listForPm(sql, 4);
  assert.ok(forPm.candidates.some((c) => c.jobId === 99), "completed ticket #99 is a candidate even with completed_at null");
  const forJob = await listForJob(sql, 99);
  assert.ok(forJob.candidates.some((p) => p.pmId === 4), "completed PM #4 is a candidate even with completed_at null");
  assert.equal((await pg.query("select completed_at from service_jobs where id = 99")).rows[0].completed_at, null);
  assert.equal((await pg.query("select completed_at from pm_jobs where id = 4")).rows[0].completed_at, null);
  const saved = await sql.query(stackPmSql(), [4, 99, "Oliver"]);
  assert.equal(saved.length, 1);
  assert.equal(Number(saved[0].id), 4);
  const linked = await pg.query("select stacked_job_id from pm_jobs where id = 4");
  assert.equal(Number(linked.rows[0].stacked_job_id), 99);
  const acts = await pg.query(
    "select entity_type, entity_id, action, detail from activity where action = 'stacked' and entity_id in (4, 99) order by id",
  );
  assert.equal(acts.rows.length, 2);
  assert.equal(acts.rows[0].entity_type, "pm");
  assert.equal(acts.rows[0].detail, "Stacked on ticket #99 (WO-9257)");
  assert.equal(acts.rows[1].entity_type, "service");
  assert.equal(Number(acts.rows[1].entity_id), 99);
  assert.equal(acts.rows[1].detail, "PM #4 stacked on this ticket");
  const again = await sql.query(stackPmSql(), [4, 99, "Oliver"]);
  assert.equal(again.length, 0);
  const still = await pg.query("select count(*)::int as n from activity where action = 'stacked' and entity_type = 'pm' and entity_id = 4");
  assert.equal(Number(still.rows[0].n), 1);
});

test("stacking Levy on its open ticket locks the PM invoice onto that ticket", async () => {
  await pg.query(
    `insert into service_jobs (id, kind, call_id, customer, wo, status) values (523, 'service', 'SC-202608-544', 'Levy GRB', 'WO-0361', 'Open')`,
  );
  await pg.query(
    `insert into pm_jobs (id, customer, equipment, status, style) values (32, 'Levy GRB', 'Faema X20', 'Awaiting Parts', '36 month PM')`,
  );
  const saved = await sql.query(stackPmSql(), [32, 523, "Oliver"]);
  assert.equal(saved.length, 1);
  const sentence = "This PM is billed on ticket #523 (WO-0361). Open the ticket's Invoicing tab.";
  assert.equal(stackedPmLock({ jobId: 523, wo: "WO-0361", callId: "SC-202608-544" }), sentence);
  assert.equal(stackedPmLock({ jobId: 523, wo: "  ", callId: "SC-1" }), "This PM is billed on ticket #523 (SC-1). Open the ticket's Invoicing tab.");
  assert.equal(stackedPmLock({ jobId: 523, wo: null, callId: null }), "This PM is billed on ticket #523. Open the ticket's Invoicing tab.");
  assert.equal(await pmInvoiceLock(sql, 32), sentence);
});

test("the statement writes nothing for every stack refusal", async () => {
  const cancelledPm = await pm({ status: "Cancelled" });
  const openTicket = await ticket();
  assert.equal((await sql.query(stackPmSql(), [cancelledPm, openTicket, "Oliver"])).length, 0);

  const live = await pm();
  const cancelledTicket = await ticket({ status: "Cancelled" });
  assert.equal((await sql.query(stackPmSql(), [live, cancelledTicket, "Oliver"])).length, 0);

  const phone = await ticket({ status: "Phone Resolved" });
  assert.equal((await sql.query(stackPmSql(), [live, phone, "Oliver"])).length, 0);
  const flagged = await ticket({ status: "Open", phoneResolved: true });
  assert.equal((await sql.query(stackPmSql(), [live, flagged, "Oliver"])).length, 0);

  const billed = await ticket({ nsSo: "SO4401" });
  assert.equal((await sql.query(stackPmSql(), [live, billed, "Oliver"])).length, 0);

  const mergedInto = await ticket();
  const merged = await ticket({ duplicateOf: mergedInto });
  assert.equal((await sql.query(stackPmSql(), [live, merged, "Oliver"])).length, 0);

  const other = await ticket({ customer: "Porsche - Houston", wo: "WO-1" });
  assert.equal((await sql.query(stackPmSql(), [4, other, "Oliver"])).length, 0);
  const still = await pg.query("select stacked_job_id from pm_jobs where id = 4");
  assert.equal(Number(still.rows[0].stacked_job_id), 99);

  const walkPm = await pm({ customer: "Walk-in" });
  const walkTicket = await ticket({ customer: "Walk-in" });
  assert.equal((await sql.query(stackPmSql(), [walkPm, walkTicket, "Oliver"])).length, 0);
  const blankPm = await pm({ customer: " " });
  assert.equal((await sql.query(stackPmSql(), [blankPm, openTicket, "Oliver"])).length, 0);

  const otherCo = await ticket({ customer: "Other Co" });
  assert.equal((await sql.query(stackPmSql(), [live, otherCo, "Oliver"])).length, 0);

  const full = await ticket();
  for (let i = 0; i < 10; i += 1) await pm({ stackedJobId: full });
  const eleventh = await pm();
  assert.equal((await sql.query(stackPmSql(), [eleventh, full, "Oliver"])).length, 0);
  assert.equal(Number((await pg.query("select stacked_job_id from pm_jobs where id = $1", [eleventh])).rows[0].stacked_job_id ?? 0), 0);

  const invoicedPm = await pm();
  const invoicedTicket = await ticket();
  const inv = await pg.query("insert into invoices (entity_type, entity_id, customer) values ('pm', $1, 'Levy GRB') returning id", [invoicedPm]);
  await pg.query("insert into invoice_lines (invoice_id, item, qty, rate) values ($1, 'Kit', 1, 10)", [inv.rows[0].id]);
  assert.equal((await sql.query(stackPmSql(), [invoicedPm, invoicedTicket, "Oliver"])).length, 0);

  const headerOnly = await pm();
  const headerTicket = await ticket();
  await pg.query("insert into invoices (entity_type, entity_id, customer) values ('pm', $1, 'Levy GRB')", [headerOnly]);
  const headerSaved = await sql.query(stackPmSql(), [headerOnly, headerTicket, "Oliver"]);
  assert.equal(headerSaved.length, 1);
});

test("unstack waits for this PM's lines and a clear Sales Order, and a deleted ticket drops the link", async () => {
  await charge(523, "pmkit:3:piece:x#1:EV1");
  const cleared = await sql.query(unstackPmSql(), [32, "Oliver"]);
  assert.equal(cleared.length, 1);
  await sql.query(stackPmSql(), [32, 523, "Oliver"]);

  await pg.query("delete from ticket_charges where job_id = 523");
  await charge(523, "pmkit:32:piece:faema x20#1:EV1");
  assert.equal((await sql.query(unstackPmSql(), [32, "Oliver"])).length, 0);
  assert.equal(await explainUnstack(sql, 32), "Take PM #32's lines off ticket #523 first.");
  assert.equal(Number((await pg.query("select stacked_job_id from pm_jobs where id = 32")).rows[0].stacked_job_id), 523);

  await pg.query("delete from ticket_charges where job_id = 523");
  const part = await pg.query(
    "insert into machine_parts (pm_job_id, piece_key, machine_label, item) values (32, 'piece:faema x20#1', 'Faema X20', 'PARTS : EVER104120') returning id",
  );
  await charge(523, `mp:${part.rows[0].id}`);
  assert.equal((await sql.query(unstackPmSql(), [32, "Oliver"])).length, 0);

  await pg.query("delete from ticket_charges where job_id = 523");
  await charge(523, "pmkit:320:piece:x#1:EV1");
  const not320 = await sql.query(unstackPmSql(), [32, "Oliver"]);
  assert.equal(not320.length, 1);
  await sql.query(stackPmSql(), [32, 523, "Oliver"]);
  await pg.query("delete from ticket_charges where job_id = 523");

  const pm3 = await pm();
  await sql.query(stackPmSql(), [pm3, 523, "Oliver"]);
  await charge(523, "pmkit:32:piece:faema x20#1:EV9");
  const pm3off = await sql.query(unstackPmSql(), [pm3, "Oliver"]);
  assert.equal(pm3off.length, 1);
  assert.equal((await pg.query("select stacked_job_id from pm_jobs where id = $1", [pm3])).rows[0].stacked_job_id, null);
  assert.equal(Number((await pg.query("select stacked_job_id from pm_jobs where id = 32")).rows[0].stacked_job_id), 523);

  await pg.query("update service_jobs set ns_so = 'SO4401' where id = 523");
  await pg.query("delete from ticket_charges where job_id = 523");
  assert.equal((await sql.query(unstackPmSql(), [32, "Oliver"])).length, 0);
  assert.equal(await explainUnstack(sql, 32), "Ticket #523 is billed (SO4401). Clear its Sales Order before unstacking PM #32.");
  assert.equal(Number((await pg.query("select stacked_job_id from pm_jobs where id = 32")).rows[0].stacked_job_id), 523);
  await pg.query("update service_jobs set ns_so = null where id = 523");

  const off = await sql.query(unstackPmSql(), [32, "Oliver"]);
  assert.equal(off.length, 1);
  assert.equal((await pg.query("select stacked_job_id from pm_jobs where id = 32")).rows[0].stacked_job_id, null);
  const notes = await pg.query(
    "select entity_type, action from activity where action = 'unstacked' and entity_id in (32, 523) order by id",
  );
  assert.equal(notes.rows.filter((r) => r.entity_type === "pm" && Number(r.entity_id) === 32 || r.entity_type === "pm").length >= 1, true);
  const pair = await pg.query(
    "select entity_type, detail from activity where action = 'unstacked' and (entity_id = 32 or entity_id = 523) order by id desc limit 2",
  );
  assert.equal(pair.rows.length, 2);
  assert.equal((await sql.query(unstackPmSql(), [32, "Oliver"])).length, 0);

  const goneTicket = await ticket({ customer: "Porsche - Houston" });
  const gonePm = await pm({ customer: "Porsche - Houston" });
  assert.equal((await sql.query(stackPmSql(), [gonePm, goneTicket, "Oliver"])).length, 1);
  await pg.query("delete from service_jobs where id = $1", [goneTicket]);
  assert.equal((await pg.query("select stacked_job_id from pm_jobs where id = $1", [gonePm])).rows[0].stacked_job_id, null);

  const tlc = await ticket({ kind: "tlc", customer: "Levy GRB", wo: null, callId: "TLC-STACK-1" });
  const tlcPm = await pm();
  assert.equal((await sql.query(stackPmSql(), [tlcPm, tlc, "Oliver"])).length, 1);
  const tlcAct = await pg.query("select entity_type, detail from activity where action = 'stacked' and entity_id = $1", [tlc]);
  assert.equal(tlcAct.rows[0].entity_type, "tlc");
  assert.equal(tlcAct.rows[0].detail, `PM #${tlcPm} stacked on this ticket`);
  const pmAct = await pg.query("select detail from activity where action = 'stacked' and entity_type = 'pm' and entity_id = $1", [tlcPm]);
  assert.equal(pmAct.rows[0].detail, `Stacked on ticket #${tlc} (TLC-STACK-1)`);
});

test("an unchanged customer saves, a real change is refused, and matching the partner is allowed", () => {
  const ticketPartner = [{ id: 523, customer: "Other Co" }];
  assert.equal(stackCustomerRefusal("Levy GRB", "Levy GRB", ticketPartner, "pm"), null);
  assert.equal(
    stackCustomerRefusal("Levy GRB", "New Co", [{ id: 523, customer: "Levy GRB" }], "pm"),
    "This PM is stacked on ticket #523 (Levy GRB). Unstack it first.",
  );
  assert.equal(stackCustomerRefusal("Other Co", "Levy GRB", [{ id: 523, customer: "Levy GRB" }], "pm"), null);
  assert.equal(
    stackCustomerRefusal("Levy GRB", "New Co", [{ id: 32, customer: "Levy GRB" }], "ticket"),
    "PM #32 is stacked on this ticket (Levy GRB). Unstack it first.",
  );
  assert.equal(stackCustomerRefusal("Levy GRB", "Levy, GRB", [{ id: 32, customer: "Other Co" }], "ticket"), null);
});

test("approving a stacked PM's invoice writes nothing, and an unstacked one does", async () => {
  const job = await ticket({ wo: "WO-RACE", customer: "Race Co" });
  const id = await pm({ customer: "Race Co", stackedJobId: job });
  const args = (item, total) => [
    "pm",
    id,
    "Race Co",
    null,
    null,
    "Race Co",
    null,
    null,
    null,
    total,
    "Oliver",
    [item],
    ["Gasket"],
    [1],
    [total],
    ["part"],
  ];
  assert.equal((await sql.query(approvePmInvoiceSql(), args("PARTS : X", 10))).length, 0);
  assert.equal(Number((await pg.query("select count(*)::int as n from invoices where entity_type = 'pm' and entity_id = $1", [id])).rows[0].n), 0);

  await pg.query("update pm_jobs set stacked_job_id = null where id = $1", [id]);
  const saved = await sql.query(approvePmInvoiceSql(), args("PARTS : X", 10));
  assert.equal(saved.length, 1);
  const lines = await pg.query(
    "select l.item from invoice_lines l join invoices i on i.id = l.invoice_id where i.entity_type = 'pm' and i.entity_id = $1",
    [id],
  );
  assert.equal(lines.rows[0].item, "PARTS : X");

  await pg.query("update pm_jobs set stacked_job_id = $2 where id = $1", [id, job]);
  assert.equal((await sql.query(approvePmInvoiceSql(), args("PARTS : Y", 99))).length, 0);
  const still = await pg.query(
    "select l.item, i.total::float as total from invoices i join invoice_lines l on l.invoice_id = i.id where i.entity_type = 'pm' and i.entity_id = $1",
    [id],
  );
  assert.equal(still.rows.length, 1);
  assert.equal(still.rows[0].item, "PARTS : X");
  assert.equal(Number(still.rows[0].total), 10);
});
