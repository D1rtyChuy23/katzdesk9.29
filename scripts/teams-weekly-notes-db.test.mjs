// Teams notes, 11/2 (Chuy), read from a real database: the weekly Purchase Order pull, the reps' serviced / Pipeline /
// installs sections, the regions and Service Monkeys, and the get-ready list. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { approveChat, chatCards, poUses, waitingPieces } = await import("../src/lib/ops/teams-reports.ts");
const { loadPartUses } = await import("../src/lib/ops/part-usage-api.ts");
const { useKey } = await import("../src/lib/ops/po-report.ts");

const pg = new PGlite();
const dir = new URL("../migrations/", import.meta.url);
for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
const one = async (text, params) => (await sql.query(text, params))[0];

// Friday Nov 6, 2026 in Chicago (CST): 4:30 PM, before that week's pull, and 5:30 PM, after it.
const BEFORE_FIVE = new Date("2026-11-06T22:30:00Z");
const NOW = new Date("2026-11-06T23:30:00Z");
// Monday morning, and the next Friday evening.
const MONDAY = new Date("2026-11-09T14:00:00Z");
const NEXT_FRIDAY = new Date("2026-11-13T23:30:00Z");
// Saturday morning: the reps' notes pick up from Friday's.
const SATURDAY = new Date("2026-11-07T15:00:00Z");

await sql.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('admin', 'Chuy', true, true)");
await sql.query(
  `insert into directory_customers (name, account_rep, address) values
     ('Zz Blue Door', 'Sean Marshall', '100 Main St, Houston, TX 77002'),
     ('Zz Katy Cafe', 'Sean Marshall', '5 Mason Rd, Katy, TX 77494'),
     ('Zz Dallas Deli', 'Lizbeth Romero', '1 Elm St, Dallas, TX 75201'),
     ('Zz Austin Brew', 'Amanda Logg', '9 Congress Ave, Austin, TX 78701')`,
);

const item = async (sku, parent, description, extra = {}) =>
  (
    await one(
      `insert into billing_items (sku, parent, item, description, kind, item_class, rate, merged_into)
       values ($1, $2, $3, $4, $5, $6, 10, $7) returning id`,
      [sku, parent, `${parent} : ${sku}`, description, extra.kind ?? "part", extra.cls === undefined ? "Parts" : extra.cls, extra.merged ?? null],
    )
  ).id;
const ev = await item("ZZEV1", "PARTS", "Eversys Zz Gasket");
await item("ZZBUNN1", "BUNN PARTS", "");
await item("WFZZ1", "WATER FILTERS", "Everpure Zz Cartridge", { cls: "Water Filters" });
await item("ZZEQUIP1", "EQUIPMENT", "Bunn Zz Brewer", { kind: "equipment", cls: "Equipment" });
await item("ZZOLD1", "PARTS", "Eversys Zz Old Gasket", { merged: ev });
const tamp = await item("ZZTAMP", "PARTS", "Zz Tamper");
await item("ZZRAN1", "PARTS", "Rancilio Zz Valve");
await item("ZZDJD1", "PARTS", "de Jong Duke Zz Motor");

const job = async (call, customer, extra = {}) =>
  (
    await one(
      `insert into service_jobs (kind, call_id, customer, status, done, completed_at, scheduled, received, technician, technician2, wo, issue, work_done, duplicate_of)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning id`,
      [
        extra.kind ?? "service",
        call,
        customer,
        extra.status ?? "Completed",
        extra.done ?? true,
        extra.completed ?? null,
        extra.scheduled ?? null,
        extra.received ?? "2026-10-01",
        extra.tech ?? null,
        extra.tech2 ?? null,
        extra.wo ?? null,
        extra.issue ?? null,
        extra.work ?? null,
        extra.dup ?? null,
      ],
    )
  ).id;
const charge = (jobId, sku, qty, kind = "part") =>
  sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, $2, '', $3, 10, $4, 1)", [jobId, sku, qty, kind]);
// A status change as the ticket window logs it.
const closed = (kind, id, detail, at) => sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail, created_at) values ($1, $2, 'Chuy', $3, $4, $5)", [kind, id, kind === "pm" ? "updated" : "status", detail, at]);

// Tickets with parts. Oct 30 is the week before; Oct 31 to Nov 6 this week; Nov 7 the next.
const sc903 = await job("SC-903", "Zz Katy Cafe", { completed: "2026-10-30", tech: "Josh", wo: "WO-903" });
await charge(sc903, "ZZTAMP", 5);
const sc901 = await job("SC-901", "Zz Blue Door", { completed: "2026-11-02", tech: "Ryan Gloria", wo: "WO-901", work: "Replaced the gasket" });
await charge(sc901, "PARTS : ZZEV1", 2);
await charge(sc901, "WATER FILTERS : WFZZ1", 1);
await charge(sc901, "Service : TRIPCHARGE", 1, "trip");
// Reclassed out of Parts after it is reported, and back.
await charge(sc901, "ZZRAN1", 1);
const sc902 = await job("SC-902", "Zz Katy Cafe", { completed: "2026-11-06", tech: "Josh", wo: "WO-902", issue: "Leak" });
await charge(sc902, "PARTS : ZZEV1", 1);
await charge(sc902, "ZZBUNN1", 3);
await charge(sc902, "EQUIPMENT : ZZEQUIP1", 1);
// An old number merged into ZZEV1 counts as ZZEV1.
await charge(sc902, "PARTS : ZZOLD1", 1);
// Taken off after it is reported, and used nowhere else.
await charge(sc902, "ZZDJD1", 1);
const tlc = await job("TL-1", "Zz Blue Door", { kind: "tlc", completed: "2026-11-05" });
await charge(tlc, "ZZTAMP", 1);
const sc930 = await job("SC-930", "Zz Blue Door", { completed: "2026-11-03" });
await charge(sc930, "ZZTAMP", 4);
// Reported this week, then merged into another ticket.
const sc931 = await job("SC-931", "Zz Katy Cafe", { completed: "2026-11-03" });
await charge(sc931, "ZZTAMP", 3);
const sc904 = await job("SC-904", "Zz Katy Cafe", { completed: "2026-11-07" });
await charge(sc904, "ZZTAMP", 6);
const cancelled = await job("SC-905", "Zz Blue Door", { status: "Cancelled", completed: "2026-11-05" });
await charge(cancelled, "ZZTAMP", 7);

// Serviced with no completed date typed: the day it was closed, from its history; else the day it came in.
const sc911 = await job("SC-911", "Zz Dallas Deli", { status: "Phone Resolved", work: "Reset the brewer" });
await closed("service", sc911, "Open → Phone Resolved", "2026-11-01T16:00:00Z");
const sc914 = await job("SC-914", "Zz Blue Door", {});
await closed("service", sc914, "Scheduled → Completed", "2026-11-05T15:00:00Z");
await job("SC-915", "Zz Blue Door", { received: "2026-11-04" });
// A ticket merged into another one is that ticket's.
await job("SC-912", "Zz Dallas Deli", { completed: "2026-11-05", dup: sc901 });

// Open calls.
await job("SC-907", "Zz Blue Door", { status: "Scheduled", done: false, scheduled: "2026-11-09", tech: "Ryan Gloria", issue: "Grinder jam" });
await job("SC-908", "Zz Dallas Deli", { status: "Open", done: false });
// Completed on the board but not marked done: not an open call.
await job("SC-909", "Zz Katy Cafe", { status: "Completed", done: false });
await job("SC-910", "Zz Austin Brew", { status: "Open", done: false, tech: "Lance Oden", tech2: "Josh" });
// Scheduled inside Sean's Serviced days but not done: open, not serviced.
await job("SC-913", "Zz Katy Cafe", { status: "Scheduled", done: false, scheduled: "2026-11-05", tech: "Josh" });
await job("SC-916", "Zz Blue Door", { status: "Open", done: false });

// PMs.
await sql.query(
  `insert into pm_jobs (customer, status, done, completed_at, projected, technician, wo, work_done, stacked_job_id) values
     ('Zz Blue Door', 'Completed', true, '2026-11-05', null, 'Josh', 'WO-950', 'PM done', null),
     ('Zz Blue Door', 'Completed', true, '2026-11-05', null, 'Josh', 'WO-951', 'Billed on the ticket', $1),
     ('Zz Katy Cafe', 'Cancelled', true, '2026-11-05', null, 'Josh', 'WO-952', null, null),
     ('Zz Katy Cafe', 'Scheduled', false, null, '2026-11-05', 'Josh', 'WO-953', null, null)`,
  [sc901],
);

// A PM's machine parts, reported this week; it is billed on a ticket later.
const p5 = (await one("insert into pm_jobs (customer, status, done, completed_at, technician, wo) values ('Zz Katy Cafe', 'Completed', true, '2026-11-03', 'Josh', 'WO-960') returning id")).id;
await sql.query(
  "insert into machine_parts (pm_job_id, piece_key, machine_label, billing_item_id, item, qty) values ($1, 'zz-piece', 'Zz Grinder', $2, 'PARTS : ZZTAMP', 2)",
  [p5, tamp],
);

// The Pipeline.
await sql.query(
  `insert into deals (customer, producer, equipment, machines, good_to_order, ordered, eta, completion, archived, date_of_deal) values
     ('Zz Blue Door', 'Sean Marshall', null, '[{"equipment":"La Marzocco Linea PB","serial":"","powerVoltage":""}]', true, true, 'Nov 20', null, false, '2026-10-01'),
     ('Zz Katy Cafe', null, E'Bunn Axiom\\nMazzer Mini', null, true, false, null, null, false, '2026-10-15'),
     ('Zz Blue Door', 'Sean Marshall', 'Done deal', null, true, true, null, 'complete', false, '2026-09-01'),
     ('Zz Blue Door', 'Sean Marshall', 'Lost deal', null, false, false, null, 'fell', false, '2026-09-02'),
     ('Zz Blue Door', 'Sean Marshall', 'Removed deal', null, false, false, null, null, true, '2026-09-03'),
     ('Zz Dallas Deli', 'Lizbeth Romero', null, null, false, false, null, null, false, '2026-10-20')`,
);

// The Board.
const machines = (list) => JSON.stringify(list.map((m) => ({ serial: "", powerVoltage: "", ...m })));
const install = async (customer, extra = {}) =>
  (
    await one(
      `insert into installs (customer, account_rep, install_date, sched_time, machines, equipment, equip_status, complete, archived, duplicate_of)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [
        customer,
        extra.rep ?? null,
        extra.date ?? null,
        extra.time ?? null,
        extra.machines ?? null,
        extra.equipment ?? null,
        extra.status ?? "Not Ready",
        extra.complete ?? false,
        extra.archived ?? false,
        extra.dup ?? null,
      ],
    )
  ).id;
const full = { powerVoltage: "120V", plug: "5-15P", water: "1/4 line" };
const i1 = await install("Zz Blue Door", {
  rep: "Sean Marshall",
  date: "2026-11-09",
  time: "09:30",
  machines: machines([{ equipment: "La Marzocco Linea PB" }, { equipment: "Mazzer Super Jolly", powerVoltage: "120V", plug: "5-15P" }]),
});
await install("Zz Katy Cafe", { date: "2026-11-20", machines: machines([{ equipment: "Bunn Axiom DV", powerVoltage: "120V", plug: "5-15P" }]) });
await install("Zz Katy Cafe", { rep: "Sean Marshall", date: "2026-11-10", machines: machines([{ equipment: "Bunn Axiom DV" }]), complete: true });
await install("Zz Katy Cafe", { rep: "Sean Marshall", date: "2026-11-10", machines: machines([{ equipment: "Bunn Axiom DV" }]), archived: true });
await install("Zz Katy Cafe", { rep: "Sean Marshall", date: "2026-11-10", machines: machines([{ equipment: "Bunn Axiom DV" }]), status: "Installed" });
// Flagged "Possible duplicate" when it was made: still open on the Board, so still on the notes.
await install("Zz Blue Door", { rep: "Sean Marshall", date: "2026-11-10", machines: machines([{ equipment: "Bunn Axiom DV" }]), dup: i1 });
await install("Zz Blue Door", { rep: "Sean Marshall", machines: machines([{ equipment: "La Marzocco Linea PB", ...full }]) });
const i6 = await install("Zz Dallas Deli", { rep: "Lizbeth Romero", date: "2026-11-12", machines: machines([{ equipment: "Bunn ITCB-DV", serial: "IT-77", ...full }]) });
const i7 = await install("Zz Austin Brew", { date: "2026-11-06", machines: machines([{ equipment: "Mazzer Super Jolly", powerVoltage: "120V", plug: "5-15P" }]) });
// No rep: the get-ready list only. The 15th is the last day of next week; the 16th and yesterday aren't on it.
await install("Zz Walk In", { date: "2026-11-15", machines: machines([{ equipment: "Bunn Axiom DV", ...full }]) });
await install("Zz Walk In", { date: "2026-11-16", machines: machines([{ equipment: "Fetco CBS-2152", ...full }]) });
await install("Zz Walk In", { date: "2026-11-05", machines: machines([{ equipment: "Bunn ITCB-DV", ...full }]) });
await install("Zz Walk In", { date: "2026-11-09", time: "08:00", machines: machines([{ equipment: "Mazzer Super Jolly", powerVoltage: "120V", plug: "5-15P" }]) });

// Pre-inspection: the Linea has its pictures (Drain is N/A); the Super Jolly has Power but not Space.
const unit = async (installId, customer, model, extra = {}) => {
  const id = (
    await one("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, install_date) values ($1, $2, $2, $3, $4, $5) returning id", [
      customer,
      model,
      extra.serial ?? null,
      extra.serial ? extra.serial.toLowerCase() : null,
      extra.installed ?? null,
    ])
  ).id;
  await sql.query("insert into install_inspection_units (install_id, equipment_id, visit_kind) values ($1, $2, $3)", [installId, id, extra.kind ?? null]);
  return id;
};
const photo = (installId, equipmentId, category) =>
  sql.query("insert into install_inspection_photos (install_id, equipment_id, category, data_url) values ($1, $2, $3, 'data:image/png;base64,AA')", [installId, equipmentId, category]);
const linea = await unit(i1, "Zz Blue Door", "La Marzocco Linea PB");
const jolly = await unit(i1, "Zz Blue Door", "Mazzer Super Jolly");
for (const c of ["power", "water", "space"]) await photo(i1, linea, c);
await sql.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, 'drain', 'N/A'), ($1, $2, 'power', 'Pass')", [i1, linea]);
await photo(i1, jolly, "power");
// Liz's install: an Admin overrode the pre-inspection, so no pictures are asked for.
await unit(i6, "Zz Dallas Deli", "Bunn ITCB-DV");
await sql.query("insert into install_inspections (install_id, override_reason) values ($1, 'Customer sent photos by text')", [i6]);
// Amanda's install: the Super Jolly is already on the account, so it is pre-inspected and nothing is pulled for it.
const onSite = await unit(i7, "Zz Austin Brew", "Mazzer Super Jolly", { serial: "SJ-OLD", installed: "2025-01-10" });
await sql.query("update installs set machines = $2 where id = $1", [i7, machines([{ equipment: "Mazzer Super Jolly", powerVoltage: "120V", plug: "5-15P", unitId: onSite }])]);

// An install's approved invoice, reported this week; the install is merged into another one later.
const i13 = await install("Zz Walk In", { machines: machines([{ equipment: "Bunn Axiom DV", ...full }]) });
const i14 = await install("Zz Walk In", { machines: machines([{ equipment: "Bunn Axiom DV", ...full }]) });
const inv13 = (await one("insert into invoices (entity_type, entity_id, customer, approved_at, approved_by) values ('install', $1, 'Zz Walk In', '2026-11-04T15:00:00Z', 'Chuy') returning id", [i13])).id;
await sql.query("insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort) values ($1, 'WATER FILTERS : WFZZ1', '', 2, 10, 'part', 1)", [inv13]);

// The warehouse.
await sql.query(
  `insert into assets (kind, model, serial, qty, site, pallet, level, status, install_id, sold_to, origin_site, origin_pallet, origin_level, shop_test, stock_hold, customer_owned) values
     ('equip', 'La Marzocco Linea PB', 'LP-500', 1, 'field', null, null, 'assigned', $1, 'Zz Blue Door', 'barn-back', 'A', 2, 'needs-test', null, null),
     ('equip', 'Mazzer Super Jolly', 'SJ-1', 1, 'barn-front', 'C', 1, 'ready', null, null, null, null, null, 'tested', null, null),
     ('equip', 'Mazzer Super Jolly', null, 2, 'barn-back', 'B', 3, 'ready', null, null, null, null, null, null, null, null),
     ('equip', 'Bunn ITCB-DV', 'IT-77', 1, 'barn-back', 'D', 1, 'ready', null, null, null, null, null, null, null, null),
     ('equip', 'Mazzer Super Jolly', 'SJ-3', 1, 'barn-back', 'B', 1, 'ready', null, null, null, null, null, 'tested', null, 'Zz Someone'),
     ('equip', 'Mazzer Super Jolly', 'SJ-4', 1, 'barn-back', 'B', 2, 'ready', null, null, null, null, null, 'tested', 'assign', null),
     ('equip', 'Mazzer Super Jolly', 'SJ-5', 1, 'barn-back', 'B', 4, 'sold', null, 'Zz Other', null, null, null, 'tested', null, null),
     ('module', 'Mazzer Super Jolly', 'SJ-6', 1, 'barn-back', 'B', 5, 'ready', null, null, null, null, null, 'tested', null, null)`,
  [i1],
);

// Sean's chat was last sent Wednesday morning, and again today: today's doesn't move where Serviced starts.
await sql.query(
  `insert into teams_drafts (chat, body, approved_by, approved_at) values
     ('rep-sean', 'old', 'Chuy', '2026-11-04T15:00:00Z'),
     ('rep-sean', 'older', 'Chuy', '2026-10-28T15:00:00Z'),
     ('rep-sean', 'today', 'Chuy', '2026-11-06T15:00:00Z')`,
);

const card = async (id, now = NOW) => (await chatCards(sql, now)).find((c) => c.id === id);
const text = async (id, now = NOW) => (await card(id, now)).text;
const pulls = async () => sql.query("select seq, week_to::text, week_from::text, uses from teams_po_pulls order by week_to");
const intro = (from, to, pulled) =>
  `Parts and water filters used, by manufacturer, in the week ${from} to ${to}, and any used earlier but entered since the last report. Pulled ${pulled} for Monday morning. Place the orders in NetSuite.`;

test("Purchase Order Requests: each Friday 5 PM pulls the week, by manufacturer, parts and water filters only", async () => {
  // Before 5 PM on Friday it is still the week before: the first pull ever covers that week alone.
  assert.equal(
    await text("purchase-orders", BEFORE_FIVE),
    `${intro("Sat Oct 24", "Fri Oct 30", "Fri Nov 6 at 4:30 PM")}\n\nOther · 1 part, 5 pieces\n- ZZTAMP · Zz Tamper · 5`,
  );
  assert.equal(
    await text("purchase-orders"),
    [
      intro("Sat Oct 31", "Fri Nov 6", "Fri Nov 6 at 5:30 PM"),
      // 2 on SC-901, and 1 + 1 (the merged old number) on SC-902.
      "Eversys · 1 part, 4 pieces\n- ZZEV1 · Zz Gasket · 4",
      // No description: Bunn from its NetSuite group.
      "Bunn · 1 part, 3 pieces\n- ZZBUNN1 · 3",
      // SC-901's one and the install invoice's two.
      "Everpure · 1 part, 3 pieces\n- WFZZ1 · Zz Cartridge · 3",
      "de Jong Duke · 1 part, 1 piece\n- ZZDJD1 · Zz Motor · 1",
      "Rancilio · 1 part, 1 piece\n- ZZRAN1 · Zz Valve · 1",
      // The TLC visit's one, SC-930's four, SC-931's three and the PM's two. Not the equipment, the cancelled ticket,
      // last week's (pulled already) or next week's.
      "Other · 1 part, 10 pieces\n- ZZTAMP · Zz Tamper · 10",
    ].join("\n\n"),
  );
  const saved = await pulls();
  assert.deepEqual(
    saved.map((p) => [p.week_from, p.week_to]),
    [
      ["2026-10-24", "2026-10-30"],
      ["2026-10-31", "2026-11-06"],
    ],
  );
  // Each pull keeps what it reported, ticket by ticket: equipment too, though the note doesn't list it.
  assert.deepEqual(saved[0].uses, [{ k: `service:${sc903}`, p: tamp, q: 5 }]);
  // Not the equipment either: only the parts the note lists go into a pull.
  assert.equal(saved[1].uses.length, 11);
  assert.deepEqual(saved.map((p) => p.seq), [1, 2]);
});

test("Sean's note: serviced since his last note, open calls, the Pipeline and installs", async () => {
  assert.equal(
    await text("rep-sean"),
    [
      "Your accounts: the service we did, open calls, the Pipeline and installs.",
      // From Wednesday's note on. Not: the TLC visit, the cancelled call, the PM billed on SC-901, the cancelled PM,
      // the call and the PM not done yet, or the merged ticket. SC-914 has no completed date: the day it was closed.
      // SC-915 has none and no history: the day it came in.
      [
        "Serviced since Wed Nov 4",
        "- Zz Katy Cafe · 2026-11-06 · Service call · WO-902 · Josh · Leak",
        "- Zz Blue Door · 2026-11-05 · Service call · SC-914",
        "- Zz Blue Door · 2026-11-05 · PM · WO-950 · Josh · PM done",
        "- Zz Blue Door · 2026-11-04 · Service call · SC-915",
      ].join("\n"),
      // Soonest first, no date last. Not the call that is Completed on the board.
      "Open service calls\n- Zz Katy Cafe · Scheduled · 2026-11-05 · SC-913\n- Zz Blue Door · Scheduled · 2026-11-09 · SC-907 · Grinder jam\n- Zz Blue Door · Open · SC-916",
      // Newest deal first; the one with no rep of its own is the account's rep.
      "Pipeline\n- Zz Katy Cafe · Bunn Axiom, Mazzer Mini · Good to order\n- Zz Blue Door · La Marzocco Linea PB · Ordered · ETA Nov 20",
      [
        "Installs",
        "- Zz Blue Door · 2026-11-09 · Missing power notes (La Marzocco Linea PB) · Missing water notes (La Marzocco Linea PB) · Needs pre-inspection pictures (Mazzer Super Jolly)",
        "- Zz Blue Door · 2026-11-10 · Missing power notes (Bunn Axiom DV) · Missing water notes (Bunn Axiom DV) · Needs pre-inspection pictures",
        "- Zz Katy Cafe · 2026-11-20 · Missing water notes (Bunn Axiom DV) · Needs pre-inspection pictures",
        "- Zz Blue Door · No install date · Needs pre-inspection pictures",
      ].join("\n"),
    ].join("\n\n"),
  );
});

test("Liz's and Amanda's notes look back a week with no earlier note, and only list their accounts", async () => {
  assert.equal(
    await text("rep-liz"),
    [
      "Your accounts: the service we did, open calls, the Pipeline and installs.",
      "Serviced since Fri Oct 30\n- Zz Dallas Deli · 2026-11-01 · Phone Resolved · SC-911 · Reset the brewer",
      "Open service calls\n- Zz Dallas Deli · Open · SC-908",
      "Pipeline\n- Zz Dallas Deli · No equipment listed · Needs good to order",
      "Installs\n- Zz Dallas Deli · 2026-11-12 · Power and water notes and pictures are in",
    ].join("\n\n"),
  );
  assert.equal(
    await text("rep-amanda"),
    [
      "Your accounts: the service we did, open calls, the Pipeline and installs.",
      "Serviced since Fri Oct 30\nNone.",
      "Open service calls\n- Zz Austin Brew · Open · SC-910",
      "Pipeline\nNone open.",
      "Installs\n- Zz Austin Brew · 2026-11-06 · Power and water notes and pictures are in",
    ].join("\n\n"),
  );
});

test("a rep's note approved today stays approved; tomorrow's starts from today", async () => {
  const body = await text("rep-amanda");
  await sql.query("insert into teams_drafts (chat, body, approved_by, approved_at) values ('rep-amanda', $1, 'Chuy', $2)", [body, NOW.toISOString()]);
  assert.equal((await card("rep-amanda")).approved, true);
  const saturday = await card("rep-amanda", SATURDAY);
  assert.equal(saturday.approved, false);
  assert.match(saturday.text, /\n\nServiced since Fri Nov 6\nNone\.\n\n/);
});

test("regions: who has each call so far, then the calls with no tech", async () => {
  assert.equal(await text("dfw"), "Open service calls in this region, and who has them.\n\nAssigned so far\nNone.\n\nNo tech yet\n- Zz Dallas Deli · Open · SC-908");
  assert.equal(
    await text("sa-atx"),
    "Open service calls in this region, and who has them.\n\nAssigned so far (Joshua Harper 1, Lance Oden 1)\n- Lance Oden & Joshua Harper · Zz Austin Brew · Open · SC-910\n\nNo tech yet\nNone.",
  );
});

test("Service Monkeys: each tech's open calls, the calls outside DFW and SA/ATX with no tech, and the get-ready list", async () => {
  assert.equal(
    await text("service-monkeys"),
    [
      "Each tech's open calls, the calls outside Dallas–Fort Worth and San Antonio–Austin that still need a tech, and the equipment to get ready for installs this week and next.",
      "Joshua Harper · 2 open calls\n- Zz Katy Cafe · Scheduled · 2026-11-05 · SC-913\n- Zz Austin Brew · Open · SC-910 · SA/ATX",
      "Lance Oden · 1 open call\n- Zz Austin Brew · Open · SC-910 · SA/ATX",
      "Ryan Gloria · 1 open call\n- Zz Blue Door · Scheduled · 2026-11-09 · SC-907 · Grinder jam",
      // Dallas's call with no tech is the DFW chat's.
      "No tech yet\n- Zz Blue Door · Open · SC-916",
      [
        "Get ready: installs this week and next",
        // Amanda's Super Jolly today is already at the site. On Monday the 8 AM install goes first and takes the
        // shop-tested Super Jolly; the 9:30 one gets one of the two on the Back B-L3 row. Not the customer's own unit,
        // the one held for approval, the sold one or a module.
        "- 2026-11-09 8a · Zz Walk In · Mazzer Super Jolly · to pull from Front · C-L1 (SN SJ-1) · 2 more in stock",
        "- 2026-11-09 9:30a · Zz Blue Door · La Marzocco Linea PB · SN LP-500 · pulled from Back · A-L2 · needs shop test",
        "- 2026-11-09 9:30a · Zz Blue Door · Mazzer Super Jolly · to pull from Back · B-L3 · 1 more in stock",
        // The possible duplicate is still on the Board, so it is here too.
        "- 2026-11-10 · Zz Blue Door · Bunn Axiom DV · none in stock",
        // The ITCB with its own serial in stock.
        "- 2026-11-12 · Zz Dallas Deli · Bunn ITCB-DV · SN IT-77 · to pull from Back · D-L1",
        // The last day of next week is on it; the 16th, the 20th and yesterday aren't.
        "- 2026-11-15 · Zz Walk In · Bunn Axiom DV · none in stock",
      ].join("\n"),
    ].join("\n\n"),
  );
});

test("drafting the notes writes nothing once the week is pulled", async () => {
  const counts = async () =>
    (
      await sql.query(
        `select (select count(*)::int from install_inspection_units) as units, (select count(*)::int from install_inspections) as heads,
                (select count(*)::int from assets) as assets, (select count(*)::int from teams_drafts) as drafts,
                (select count(*)::int from teams_po_pulls) as pulls, (select max(pulled_at)::text from teams_po_pulls) as pulled_at,
                (select max(updated_at)::text from installs) as installs, (select max(updated_at)::text from assets) as assets_at`,
      )
    )[0];
  // An install with machines but no pre-inspection units yet is not given any by the notes.
  await install("Zz Katy Cafe", { rep: "Sean Marshall", date: "2026-11-11", machines: machines([{ equipment: "Bunn Axiom DV", ...full }]) });
  const before = await counts();
  await chatCards(sql, NOW);
  await chatCards(sql, MONDAY);
  assert.deepEqual(await counts(), before);
  assert.match(await text("rep-sean"), /- Zz Katy Cafe · 2026-11-11 · Needs pre-inspection pictures\n/);
});

test("the next Friday's pull has only what is new: late, back-dated, moved, merged, and taken off", async () => {
  const before = await card("purchase-orders");
  await approveChat(sql, "admin", "purchase-orders", before.text, NOW);
  // Monday reads Friday's pull, still approved, even with parts entered since.
  await charge(sc901, "ZZBUNN1", 2);
  assert.equal((await card("purchase-orders", MONDAY)).approved, true);
  assert.equal((await card("purchase-orders", MONDAY)).text, before.text);
  // Back-dated into a week already pulled.
  const late = await job("SC-920", "Zz Katy Cafe", { completed: "2026-10-29" });
  await charge(late, "WATER FILTERS : WFZZ1", 1);
  // A reported ticket's date moves past the next Friday: not taken off, and not counted again later.
  await sql.query("update service_jobs set completed_at = '2026-11-18' where id = $1", [sc902]);
  // A reported ticket merged into an install, its charges copied onto the install's invoice, not approved yet.
  await sql.query("update service_jobs set duplicate_of = id, merged_install_id = $2 where id = $1", [sc930, i1]);
  const inv = (await one("insert into invoices (entity_type, entity_id, customer) values ('install', $1, 'Zz Blue Door') returning id", [i1])).id;
  await sql.query("insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort) values ($1, 'ZZTAMP', '', 4, 10, 'part', 1)", [inv]);
  // A reported ticket merged into another (its charges move to the keeper), a reported PM billed on a ticket, and an
  // install with a reported invoice merged into another install.
  await sql.query("update ticket_charges set job_id = $2 where job_id = $1", [sc931, sc903]);
  await sql.query("update service_jobs set duplicate_of = $2 where id = $1", [sc931, sc903]);
  await sql.query("update pm_jobs set stacked_job_id = $2 where id = $1", [p5, sc904]);
  await sql.query("update installs set archived = true, duplicate_of = $2 where id = $1", [i13, i14]);
  await sql.query("update invoices set entity_id = $2 where id = $1", [inv13, i14]);
  // A reported piece taken off, a reported part's only line deleted, and a reported part reclassed out of Parts.
  await sql.query("update ticket_charges set qty = 1 where job_id = $1 and item = 'PARTS : ZZEV1'", [sc901]);
  await sql.query("delete from ticket_charges where job_id = $1 and item = 'ZZDJD1'", [sc902]);
  await sql.query("update billing_items set item_class = 'Service' where sku = 'ZZRAN1'");
  const next = await card("purchase-orders", NEXT_FRIDAY);
  assert.equal(next.approved, false);
  assert.equal(
    next.text,
    [
      intro("Sat Nov 7", "Fri Nov 13", "Fri Nov 13 at 5:30 PM"),
      "Bunn · 1 part, 2 pieces\n- ZZBUNN1 · 2",
      "Everpure · 1 part, 1 piece\n- WFZZ1 · Zz Cartridge · 1",
      // SC-904's six. The PM is billed on SC-904 now, so its two count as two of those six (Parts → Usage counts a
      // ticket's parts once), and they were reported already: four are new.
      "Other · 1 part, 4 pieces\n- ZZTAMP · Zz Tamper · 4",
      // The reclassed valve isn't taken off: it wasn't taken off a ticket.
      "Taken off tickets after an earlier report\n- ZZDJD1 · Zz Motor · -1\n- ZZEV1 · Zz Gasket · -1",
    ].join("\n\n"),
  );
  // Looking again doesn't pull again.
  assert.equal((await card("purchase-orders", new Date("2026-11-16T14:00:00Z"))).text, next.text);
  // The install's invoice is approved: SC-930's four are the ones reported already. The moved SC-902 isn't new either.
  await sql.query("update invoices set approved_at = '2026-11-16T15:00:00Z', approved_by = 'Chuy' where id = $1", [inv]);
  // The wrong part fixed on SC-920 (a water filter that was a Bunn part), and TL-1's tamper moved to the ticket it
  // belonged on: off one, on the other, nothing for the tamper.
  await sql.query("update ticket_charges set item = 'ZZBUNN1' where job_id = $1", [late]);
  await sql.query("update ticket_charges set job_id = $2 where job_id = $1", [tlc, sc904]);
  // The valve is back in Parts: reported already, so not again.
  await sql.query("update billing_items set item_class = 'Parts' where sku = 'ZZRAN1'");
  assert.equal(
    await text("purchase-orders", new Date("2026-11-20T23:30:00Z")),
    `${intro("Sat Nov 14", "Fri Nov 20", "Fri Nov 20 at 5:30 PM")}\n\nBunn · 1 part, 1 piece\n- ZZBUNN1 · 1\n\nTaken off tickets after an earlier report\n- WFZZ1 · Zz Cartridge · -1`,
  );
  // The pull keeps each move: the tamper off TL-1 and onto SC-904, the filter off SC-920 and its Bunn part on.
  const bunn = Number((await one("select id from billing_items where sku = 'ZZBUNN1'")).id);
  const filter = Number((await one("select id from billing_items where sku = 'WFZZ1'")).id);
  assert.deepEqual(
    (await pulls()).find((p) => p.week_to === "2026-11-20").uses,
    [
      { k: `service:${late}`, p: bunn, q: 1 },
      { k: `service:${late}`, p: filter, q: -1 },
      { k: `service:${sc904}`, p: tamp, q: 1 },
      { k: `tlc:${tlc}`, p: tamp, q: -1 },
    ].sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.p - b.p)),
  );
  // Nobody looks the week after. The next pull, a week later, has that week's parts too.
  const sc940 = await job("SC-940", "Zz Katy Cafe", { completed: "2026-11-25" });
  await charge(sc940, "ZZTAMP", 2);
  const december = await text("purchase-orders", new Date("2026-12-04T23:30:00Z"));
  assert.equal(december, `${intro("Sat Nov 28", "Fri Dec 4", "Fri Dec 4 at 5:30 PM")}\n\nOther · 1 part, 2 pieces\n- ZZTAMP · Zz Tamper · 2`);
  // A look whose clock is behind (the skipped week's Friday evening) shows the newest pull and saves nothing older.
  assert.equal(await text("purchase-orders", new Date("2026-11-27T23:30:00Z")), december);
  assert.deepEqual(
    (await pulls()).map((p) => [p.seq, p.week_to]),
    [
      [1, "2026-10-30"],
      [2, "2026-11-06"],
      [3, "2026-11-13"],
      [4, "2026-11-20"],
      [5, "2026-12-04"],
    ],
  );
});

test("a correction on merged or stacked work is taken off; pieces waiting to show are held", async () => {
  // A database of its own, with nothing but these. All made up.
  const db = new PGlite();
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(name, dir), "utf8"));
  const q = { query: async (t, params) => (await db.query(t, params)).rows };
  const row = async (t, params) => (await q.query(t, params))[0];
  await q.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('admin', 'Chuy', true, true)");
  const part = async (sku, description, cls = "Parts") =>
    Number((await row("insert into billing_items (sku, parent, item, description, kind, item_class, rate) values ($1, 'PARTS', $2, $3, 'part', $4, 10) returning id", [sku, `PARTS : ${sku}`, description, cls])).id);
  const ids = {};
  for (const x of ["A", "B", "C", "D", "F", "G", "H"]) ids[x] = await part(`ZZ${x}1`, `Bunn Zz Valve ${x}`);
  ids.E = await part("WFZZE", "Everpure Zz Cartridge E", "Water Filters");
  const ticket = async (call) =>
    Number((await row("insert into service_jobs (kind, call_id, customer, status, done, received, completed_at) values ('service', $1, 'Zz Owl', 'Completed', true, '2026-11-01', '2026-11-04') returning id", [call])).id);
  const charge = async (jobId, x, n, sourceKey = null) =>
    Number((await row("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort, source_key) values ($1, $2, '', $3, 10, 'part', 1, $4) returning id", [jobId, `PARTS : ZZ${x}1`.replace("ZZE1", "WFZZE"), n, sourceKey])).id);
  const pmWith = async (x, n) => {
    const pm = Number((await row("insert into pm_jobs (customer, status, done, completed_at, wo) values ('Zz Owl', 'Completed', true, '2026-11-04', 'WO-1') returning id")).id);
    const mp = Number((await row("insert into machine_parts (pm_job_id, piece_key, machine_label, billing_item_id, item, qty) values ($1, 'zz', 'Zz Brewer', $2, 'x', $3) returning id", [pm, ids[x], n])).id);
    return { pm, mp };
  };
  const mergeTickets = async (extra, keeper) => {
    await q.query("update ticket_charges set job_id = $2 where job_id = $1", [extra, keeper]);
    await q.query("update service_jobs set duplicate_of = $2 where id = $1", [extra, keeper]);
  };
  const intoInstall = async (jobId, x, n) => {
    const ins = Number((await row("insert into installs (customer, install_date, machines) values ('Zz Owl', '2026-11-10', '[]') returning id")).id);
    await q.query("update service_jobs set duplicate_of = id, merged_install_id = $2 where id = $1", [jobId, ins]);
    const inv = Number((await row("insert into invoices (entity_type, entity_id, customer) values ('install', $1, 'Zz Owl') returning id", [ins])).id);
    const line = Number((await row("insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort) values ($1, $2, '', $3, 10, 'part', 1) returning id", [inv, `PARTS : ZZ${x}1`, n])).id);
    return { ins, inv, line };
  };
  const approve = (inv) => q.query("update invoices set approved_at = '2026-11-10T18:00:00Z', approved_by = 'Chuy' where id = $1", [inv]);
  const po = async (at) => (await chatCards(q, at)).find((c) => c.id === "purchase-orders").text;

  // H1: one visit entered as two tickets, 2 valves on each. H2: a ticket merged into one with none of its part.
  const k1 = await ticket("SC-1");
  const e1 = await ticket("SC-2");
  await charge(k1, "A", 2);
  const doubled = await charge(e1, "A", 2);
  const k2 = await ticket("SC-3");
  const e2 = await ticket("SC-4");
  await charge(e2, "B", 3);
  // H3 and G: tickets merged into installs later, not as billed.
  const t3 = await ticket("SC-5");
  await charge(t3, "C", 3);
  const t7 = await ticket("SC-6");
  await charge(t7, "G", 2);
  // H4: a ticket's charge and its QuickBooks line for the same part: one use.
  const k4 = await ticket("SC-7");
  const e4 = await ticket("SC-8");
  await charge(e4, "D", 2);
  await q.query("insert into wo_history_runs (filename) values ('zz.xlsx')");
  const h = Number((await row("insert into wo_history (run_id, history_ref, wo, completed, customer, invoice_date, job_id) values (1, 'H1', 'WO-77', '2026-11-04', 'Zz Owl', '2026-11-04', $1) returning id", [e4])).id);
  await q.query("insert into wo_history_lines (history_id, line_type, kind, item_code, qty) values ($1, 'Item', 'part', 'ZZD1', 2)", [h]);
  // H5, S and T8: PMs with machine parts, billed on tickets later.
  const t5 = await ticket("SC-9");
  await charge(t5, "E", 1);
  const p5 = await pmWith("E", 2);
  const t6 = await ticket("SC-10");
  await charge(t6, "F", 1);
  const p6 = await pmWith("F", 2);
  const t8 = await ticket("SC-11");
  const p8 = await pmWith("H", 2);

  assert.equal(
    await po(NOW),
    [
      intro("Sat Oct 31", "Fri Nov 6", "Fri Nov 6 at 5:30 PM"),
      "Bunn · 7 parts, 19 pieces\n- ZZA1 · Zz Valve A · 4\n- ZZB1 · Zz Valve B · 3\n- ZZC1 · Zz Valve C · 3\n- ZZF1 · Zz Valve F · 3\n- ZZD1 · Zz Valve D · 2\n- ZZG1 · Zz Valve G · 2\n- ZZH1 · Zz Valve H · 2",
      "Everpure · 1 part, 3 pieces\n- WFZZE · Zz Cartridge E · 3",
    ].join("\n\n"),
  );

  // H1: merged, and the doubled line deleted. H2: merged, and the moved line cut to 1.
  await mergeTickets(e1, k1);
  await q.query("delete from ticket_charges where id = $1", [doubled]);
  await mergeTickets(e2, k2);
  await q.query("update ticket_charges set qty = 1 where job_id = $1", [k2]);
  // H3: into an install; its copy on the install's invoice cut to 1, then approved. G: into an install whose invoice
  // isn't approved yet.
  const i3 = await intoInstall(t3, "C", 3);
  await q.query("update invoice_lines set qty = 1 where id = $1", [i3.line]);
  await approve(i3.inv);
  const i7 = await intoInstall(t7, "G", 2);
  // H4: merged; its QuickBooks line stays on it, and counts on the ticket it went into, once with the charge.
  await mergeTickets(e4, k4);
  // H5: billed on its ticket, then cancelled. S: billed on its ticket, its parts not billed there yet. T8: billed on a
  // ticket with none of its part, then its part cut to 1.
  await q.query("update pm_jobs set stacked_job_id = $2 where id = $1", [p5.pm, t5]);
  await q.query("update pm_jobs set status = 'Cancelled' where id = $1", [p5.pm]);
  await q.query("update pm_jobs set stacked_job_id = $2 where id = $1", [p6.pm, t6]);
  await q.query("update pm_jobs set stacked_job_id = $2 where id = $1", [p8.pm, t8]);
  await q.query("update machine_parts set qty = 1 where id = $1", [p8.mp]);

  // Parts → Usage: the QuickBooks line counts once, with the charge, on the ticket it went into.
  const d = await loadPartUses(q, { partIds: [ids.D] });
  assert.deepEqual(d.map((u) => [u.ticketKey, u.pieces]), [[`service:${k4}`, 2]]);
  // The pull reads the same uses as Parts → Usage, with what each was read from.
  const usage = (await loadPartUses(q, {})).map((u) => [u.ticketKey, u.partId, u.pieces, u.usedOn]).sort();
  const ranked = await poUses(q);
  assert.deepEqual(ranked.map((u) => [u.k, u.p, u.q, u.day]).sort(), usage);
  assert.equal(ranked.find((u) => u.k === `service:${t6}`).rank, 1);
  assert.equal(ranked.find((u) => u.k === `service:${t8}`).rank, 2);
  // Waiting: S's two (its ticket's own charge counts alone till they're billed), T8's one (counted already), G's two.
  assert.deepEqual(
    [...(await waitingPieces(q)).entries()].sort(),
    [
      [useKey(`install:${i7.ins}`, ids.G), 2],
      [useKey(`service:${t6}`, ids.F), 2],
      [useKey(`service:${t8}`, ids.H), 1],
    ].sort(),
  );

  assert.equal(
    await po(NEXT_FRIDAY),
    [
      intro("Sat Nov 7", "Fri Nov 13", "Fri Nov 13 at 5:30 PM"),
      // 2 used and 4 reported; 1 and 3; 1 approved and 3; the cancelled PM's 2; the 1 left of T8's PM's 2.
      "Taken off tickets after an earlier report\n- WFZZE · Zz Cartridge E · -2\n- ZZA1 · Zz Valve A · -2\n- ZZB1 · Zz Valve B · -2\n- ZZC1 · Zz Valve C · -2\n- ZZH1 · Zz Valve H · -1",
    ].join("\n\n"),
  );

  // S's parts billed on its ticket, and G's install invoice approved: they show now, and were reported already.
  await charge(t6, "F", 2, `mp:${p6.mp}`);
  await approve(i7.inv);
  assert.deepEqual([...(await waitingPieces(q)).entries()], [[useKey(`service:${t8}`, ids.H), 1]]);
  assert.equal(await po(new Date("2026-11-20T23:30:00Z")), `${intro("Sat Nov 14", "Fri Nov 20", "Fri Nov 20 at 5:30 PM")}\n\nNone used that week.`);
});
