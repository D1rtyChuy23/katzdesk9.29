// Teams notes, 11/2 (Chuy), read from a real database: the weekly Purchase Order report, the reps' serviced /
// Pipeline / installs sections, each region's assignments and the Service Monkeys get-ready list. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { approveChat, chatCards } = await import("../src/lib/ops/teams-reports.ts");

const pg = new PGlite();
const dir = new URL("../migrations/", import.meta.url);
for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
const one = async (text, params) => (await sql.query(text, params))[0];

// Friday Nov 6, 2026, 5:30 PM in Chicago (CST): the report for Sat Oct 31 – Fri Nov 6 has been pulled.
const NOW = new Date("2026-11-06T23:30:00Z");
// The same Friday at 4:30 PM: still the week before.
const BEFORE_FIVE = new Date("2026-11-06T22:30:00Z");
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
await item("ZZTAMP", "PARTS", "Zz Tamper");

const job = async (call, customer, extra = {}) =>
  (
    await one(
      `insert into service_jobs (kind, call_id, customer, status, done, completed_at, scheduled, technician, technician2, wo, issue, work_done, duplicate_of)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
      [
        extra.kind ?? "service",
        call,
        customer,
        extra.status ?? "Completed",
        extra.done ?? true,
        extra.completed ?? null,
        extra.scheduled ?? null,
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

// The week's tickets.
const j1 = await job("SC-901", "Zz Blue Door", { completed: "2026-11-02", tech: "Ryan Gloria", wo: "WO-901", work: "Replaced the gasket" });
await charge(j1, "PARTS : ZZEV1", 2);
await charge(j1, "WATER FILTERS : WFZZ1", 1);
await charge(j1, "Service : TRIPCHARGE", 1, "trip");
const j2 = await job("SC-902", "Zz Katy Cafe", { completed: "2026-11-06", tech: "Josh", wo: "WO-902", issue: "Leak" });
await charge(j2, "PARTS : ZZEV1", 1);
await charge(j2, "ZZBUNN1", 3);
await charge(j2, "EQUIPMENT : ZZEQUIP1", 1);
// An old number merged into ZZEV1 counts as ZZEV1.
await charge(j2, "PARTS : ZZOLD1", 1);
const tlc = await job("TL-1", "Zz Blue Door", { kind: "tlc", completed: "2026-11-03" });
await charge(tlc, "ZZTAMP", 1);
// Not this week, or not counted.
const before = await job("SC-903", "Zz Katy Cafe", { completed: "2026-10-30", tech: "Josh", wo: "WO-903" });
await charge(before, "ZZTAMP", 5);
const after = await job("SC-904", "Zz Katy Cafe", { completed: "2026-11-07" });
await charge(after, "ZZTAMP", 6);
const cancelled = await job("SC-905", "Zz Blue Door", { status: "Cancelled", completed: "2026-11-03" });
await charge(cancelled, "ZZTAMP", 7);
// Serviced, by phone, on Liz's account.
await job("SC-911", "Zz Dallas Deli", { status: "Phone Resolved", completed: "2026-11-01", work: "Reset the brewer" });
// A ticket merged into another one is that ticket's.
await job("SC-912", "Zz Dallas Deli", { completed: "2026-11-05", dup: j1 });

// Open calls.
await job("SC-907", "Zz Blue Door", { status: "Scheduled", done: false, scheduled: "2026-11-09", tech: "Ryan Gloria", issue: "Grinder jam" });
await job("SC-908", "Zz Dallas Deli", { status: "Open", done: false });
// Completed on the board but not marked done: not an open call.
await job("SC-909", "Zz Katy Cafe", { status: "Completed", done: false });
await job("SC-910", "Zz Austin Brew", { status: "Open", done: false, tech: "Lance Oden", tech2: "Josh" });

// PMs.
await sql.query(
  `insert into pm_jobs (customer, status, done, completed_at, technician, wo, work_done, stacked_job_id) values
     ('Zz Blue Door', 'Completed', true, '2026-11-05', 'Josh', 'WO-950', 'PM done', null),
     ('Zz Blue Door', 'Completed', true, '2026-11-05', 'Josh', 'WO-951', 'Billed on the ticket', $1),
     ('Zz Katy Cafe', 'Cancelled', true, '2026-11-05', 'Josh', 'WO-952', null, null)`,
  [j1],
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
const i1 = await install("Zz Blue Door", {
  rep: "Sean Marshall",
  date: "2026-11-09",
  time: "09:30",
  machines: machines([{ equipment: "La Marzocco Linea PB" }, { equipment: "Mazzer Super Jolly", powerVoltage: "120V", plug: "5-15P" }]),
});
await install("Zz Katy Cafe", { date: "2026-11-20", machines: machines([{ equipment: "Bunn Axiom DV", powerVoltage: "120V", plug: "5-15P" }]) });
await install("Zz Katy Cafe", { rep: "Sean Marshall", date: "2026-11-10", machines: machines([{ equipment: "Bunn Axiom DV" }]), complete: true });
await install("Zz Katy Cafe", { rep: "Sean Marshall", date: "2026-11-10", machines: machines([{ equipment: "Bunn Axiom DV" }]), archived: true });
await install("Zz Blue Door", { rep: "Sean Marshall", date: "2026-11-10", machines: machines([{ equipment: "Bunn Axiom DV" }]), dup: i1 });
await install("Zz Katy Cafe", { rep: "Sean Marshall", date: "2026-11-10", machines: machines([{ equipment: "Bunn Axiom DV" }]), status: "Installed" });
const i6 = await install("Zz Dallas Deli", {
  rep: "Lizbeth Romero",
  date: "2026-11-12",
  machines: machines([{ equipment: "Bunn ITCB-DV", serial: "IT-77", powerVoltage: "120V", plug: "5-20P", water: "1/4 line" }]),
});
const i7 = await install("Zz Austin Brew", { date: "2026-11-06", machines: machines([{ equipment: "Mazzer Super Jolly", powerVoltage: "120V", plug: "5-15P" }]) });

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
// Amanda's install: the Super Jolly is already on the account, so it is pre-inspected.
await unit(i7, "Zz Austin Brew", "Mazzer Super Jolly", { serial: "SJ-OLD", installed: "2025-01-10" });

// The warehouse.
await sql.query(
  `insert into assets (kind, model, serial, site, pallet, level, status, install_id, sold_to, origin_site, origin_pallet, origin_level, shop_test, stock_hold, customer_owned) values
     ('equip', 'La Marzocco Linea PB', 'LP-500', 'field', null, null, 'assigned', $1, 'Zz Blue Door', 'barn-back', 'A', 2, 'needs-test', null, null),
     ('equip', 'Mazzer Super Jolly', 'SJ-1', 'barn-front', 'C', 1, 'ready', null, null, null, null, null, 'tested', null, null),
     ('equip', 'Mazzer Super Jolly', 'SJ-2', 'barn-back', 'B', 3, 'ready', null, null, null, null, null, null, null, null),
     ('equip', 'Bunn ITCB-DV', 'IT-77', 'barn-back', 'D', 1, 'ready', null, null, null, null, null, null, null, null),
     ('equip', 'Mazzer Super Jolly', 'SJ-3', 'barn-back', 'B', 1, 'ready', null, null, null, null, null, 'tested', null, 'Zz Someone'),
     ('equip', 'Mazzer Super Jolly', 'SJ-4', 'barn-back', 'B', 2, 'ready', null, null, null, null, null, 'tested', 'assign', null),
     ('equip', 'Mazzer Super Jolly', 'SJ-5', 'barn-back', 'B', 4, 'sold', null, 'Zz Other', null, null, null, 'tested', null, null),
     ('module', 'Mazzer Super Jolly', 'SJ-6', 'barn-back', 'B', 5, 'ready', null, null, null, null, null, 'tested', null, null)`,
  [i1],
);

// Sean's chat was last sent Wednesday morning, and again today: today's doesn't move where Serviced starts.
await sql.query(
  `insert into teams_drafts (chat, body, approved_by, approved_at) values
     ('rep-sean', 'old', 'Chuy', '2026-11-04T15:00:00Z'),
     ('rep-sean', 'older', 'Chuy', '2026-10-28T15:00:00Z'),
     ('rep-sean', 'today', 'Chuy', '2026-11-06T15:00:00Z')`,
);

const text = async (id, now = NOW) => (await chatCards(sql, now)).find((c) => c.id === id).text;

test("Purchase Order Requests: the week Friday 5 PM pulled, by manufacturer, parts and water filters only", async () => {
  assert.equal(
    await text("purchase-orders"),
    [
      "Parts and water filters used Sat Oct 31 to Fri Nov 6, by manufacturer, to know what to reorder. Pulled Friday at 5 PM for Monday morning. Place the orders in NetSuite.",
      // 2 on SC-901, and 1 + 1 (the merged old number) on SC-902.
      "Eversys · 1 part, 4 pieces\n- ZZEV1 · Zz Gasket · 4",
      // No description: Bunn from its NetSuite group.
      "Bunn · 1 part, 3 pieces\n- ZZBUNN1 · 3",
      "Everpure · 1 part, 1 piece\n- WFZZ1 · Zz Cartridge · 1",
      // The TLC visit's tamper. Not the equipment, the cancelled ticket, last week's or next week's.
      "Other · 1 part, 1 piece\n- ZZTAMP · Zz Tamper · 1",
    ].join("\n\n"),
  );
  // Before 5 PM on Friday it is still the week before.
  assert.equal(
    await text("purchase-orders", BEFORE_FIVE),
    "Parts and water filters used Sat Oct 24 to Fri Oct 30, by manufacturer, to know what to reorder. Pulled Friday at 5 PM for Monday morning. Place the orders in NetSuite.\n\nOther · 1 part, 5 pieces\n- ZZTAMP · Zz Tamper · 5",
  );
});

test("an approved Purchase Order note stays approved all week, until the next Friday's", async () => {
  const card = (await chatCards(sql, NOW)).find((c) => c.id === "purchase-orders");
  await approveChat(sql, "admin", "purchase-orders", card.text, NOW);
  assert.equal((await chatCards(sql, NOW)).find((c) => c.id === "purchase-orders").approved, true);
  assert.equal((await chatCards(sql, new Date("2026-11-09T15:00:00Z"))).find((c) => c.id === "purchase-orders").approved, true);
  assert.equal((await chatCards(sql, new Date("2026-11-13T23:30:00Z"))).find((c) => c.id === "purchase-orders").approved, false);
});

test("Sean's note: serviced since his last note, open calls, the Pipeline and installs", async () => {
  assert.equal(
    await text("rep-sean"),
    [
      "Your accounts: the service we did, open calls, the Pipeline and installs.",
      // From Wednesday's note on. The PM billed on SC-901, the cancelled PM and the merged ticket are not visits of their own.
      "Serviced since Wed Nov 4\n- Zz Katy Cafe · 2026-11-06 · Service call · WO-902 · Josh · Leak\n- Zz Blue Door · 2026-11-05 · PM · WO-950 · Josh · PM done",
      "Open service calls\n- Zz Blue Door · Scheduled · 2026-11-09 · SC-907 · Grinder jam",
      // Newest deal first; the one with no rep of its own is the account's rep.
      "Pipeline\n- Zz Katy Cafe · Bunn Axiom, Mazzer Mini · Good to order\n- Zz Blue Door · La Marzocco Linea PB · Ordered · ETA Nov 20",
      [
        "Installs",
        "- Zz Blue Door · 2026-11-09 · Missing power notes (La Marzocco Linea PB) · Missing water notes (La Marzocco Linea PB) · Needs pre-inspection pictures (Mazzer Super Jolly)",
        "- Zz Katy Cafe · 2026-11-20 · Missing water notes (Bunn Axiom DV) · Needs pre-inspection pictures",
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
  assert.equal((await chatCards(sql, NOW)).find((c) => c.id === "rep-amanda").approved, true);
  const saturday = (await chatCards(sql, SATURDAY)).find((c) => c.id === "rep-amanda");
  assert.equal(saturday.approved, false);
  assert.match(saturday.text, /\n\nServiced since Fri Nov 6\nNone\.\n\n/);
});

test("regions: who has each call so far, then the calls with no tech; Service Monkeys adds the get-ready list", async () => {
  assert.equal(await text("dfw"), "Open service calls in this region, and who has them.\n\nAssigned so far\nNone.\n\nNo tech yet\n- Zz Dallas Deli · Open · SC-908");
  assert.equal(
    await text("sa-atx"),
    "Open service calls in this region, and who has them.\n\nAssigned so far (Josh 1, Lance Oden 1)\n- Lance Oden & Josh · Zz Austin Brew · Open · SC-910\n\nNo tech yet\nNone.",
  );
  assert.equal(
    await text("service-monkeys"),
    [
      "Open calls outside Dallas–Fort Worth and San Antonio–Austin, and who has them. Then the equipment to get ready for installs this week and next.",
      "Assigned so far (Ryan Gloria 1)\n- Ryan Gloria · Zz Blue Door · Scheduled · 2026-11-09 · SC-907 · Grinder jam",
      "No tech yet\nNone.",
      [
        "Get ready: installs this week and next",
        // Today's install takes the shop-tested Super Jolly; Monday's gets the other one. Not the customer's own unit,
        // the one held for approval, the sold one or a module.
        "- 2026-11-06 · Zz Austin Brew · Mazzer Super Jolly · to pull from Front · C-L1 (SN SJ-1) · 1 more in stock",
        "- 2026-11-09 9:30a · Zz Blue Door · La Marzocco Linea PB · SN LP-500 · pulled from Back · A-L2 · needs shop test",
        "- 2026-11-09 9:30a · Zz Blue Door · Mazzer Super Jolly · to pull from Back · B-L3 (SN SJ-2)",
        // The ITCB with its own serial in stock. The install on the 20th is after next week.
        "- 2026-11-12 · Zz Dallas Deli · Bunn ITCB-DV · SN IT-77 · to pull from Back · D-L1",
      ].join("\n"),
    ].join("\n\n"),
  );
});

test("nothing here writes: drafting the notes leaves every table as it was", async () => {
  const counts = async () =>
    (
      await sql.query(
        `select (select count(*)::int from install_inspection_units) as units, (select count(*)::int from install_inspections) as heads,
                (select count(*)::int from assets) as assets, (select count(*)::int from teams_drafts) as drafts,
                (select max(updated_at)::text from installs) as installs, (select max(updated_at)::text from assets) as assets_at`,
      )
    )[0];
  // An install with machines but no pre-inspection units yet is not given any by the notes.
  await install("Zz Katy Cafe", { rep: "Sean Marshall", date: "2026-11-11", machines: machines([{ equipment: "Bunn Axiom DV", powerVoltage: "120V", plug: "5-15P", water: "1/4" }]) });
  const before = await counts();
  await chatCards(sql, NOW);
  assert.deepEqual(await counts(), before);
  assert.match(await text("rep-sean"), /- Zz Katy Cafe · 2026-11-11 · Needs pre-inspection pictures\n/);
});
