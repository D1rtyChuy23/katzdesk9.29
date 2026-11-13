// Assets → Analytics (Chuy, 11/13): fleet counts, service load, ownership, and machines not serviced after a year.
// Made-up accounts, machines and tickets only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const E = await import("../src/lib/ops/equipment-analytics.ts");
const { readEquipmentAnalytics } = await import("../src/lib/ops/equipment-analytics-api.ts");
const { brandOf } = await import("../src/lib/ops/field-assets.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const TODAY = "2026-11-13";
const m = (id, customer, catalogModel, extra = {}) => ({
  id,
  customer,
  customerId: id,
  accountRemoved: false,
  address: null,
  catalogModel,
  equipmentName: catalogModel,
  brand: brandOf(catalogModel),
  serial: null,
  partNumber: null,
  ownership: null,
  installDate: null,
  condition: null,
  ...extra,
});
const v = (kind, id, customer, date, equipment = "", serialText = equipment) => ({ kind, id, customer, date, equipment, serialText });

test("days between two days; the flag: serviced this year, overdue, never, new, unknown", () => {
  assert.equal(E.daysBetween("2025-11-13", TODAY), 365);
  assert.ok(Number.isNaN(E.daysBetween("", TODAY)));
  assert.equal(E.serviceFlag({ last: "2025-11-13" }, null, TODAY), "ok", "exactly a year is not over a year");
  assert.equal(E.serviceFlag({ last: "2025-11-12" }, null, TODAY), "overdue");
  assert.equal(E.serviceFlag({ last: null }, "2024-01-01", TODAY), "never");
  assert.equal(E.serviceFlag({ last: null }, "2026-06-01", TODAY), "new");
  assert.equal(E.serviceFlag({ last: null }, null, TODAY), "unknown");
});

test("a visit dates a machine by a PM logged on it, its serial, or a model only one machine at the account has", () => {
  const machines = [
    m(1, "Test Diner", "Bunn TB3", { serial: "TB3-55821" }),
    m(2, "Test Diner", "Bunn TB3", { serial: "TB3-55822" }),
    m(3, "Test Diner", "Fetco CBS-62H"),
    m(4, "Test Cafe", "Bunn ITCB-DV"),
    m(5, "Test Cafe", "La Marzocco Linea Mini"),
  ];
  const visits = [
    v("service", 10, "test diner ", "2026-03-01", "Brewer", "Brewer leaking. Serial TB3 55821 replaced valve"),
    v("service", 11, "Test Diner", "2026-04-01", "Bunn TB3"), // two TB3s: can't say which
    v("tlc", 12, "Test Diner", "2026-05-01", "CBS-62H"), // the model without its brand
    v("pm", 13, "Test Cafe", "2026-02-01", "Bunn ITCB-DV, Linea Mini"),
    v("pm", 14, "Test Cafe", "2024-01-01", "Linea Mini"),
    v("service", 15, "Test Cafe", "2027-01-01", "Bunn ITCB-DV"), // dated after today
  ];
  const ties = [{ pmId: 13, unitId: 5 }];
  const s = E.serviceByMachine(machines, visits, ties, TODAY);
  assert.deepEqual([s.get(1).last, s.get(1).how, s.get(1).lastId], ["2026-03-01", "serial", 10]);
  assert.equal(s.get(2).last, null, "the model ticket names two machines, so it dates neither");
  assert.deepEqual([s.get(3).last, s.get(3).how, s.get(3).lastKind], ["2026-05-01", "model", "tlc"]);
  assert.deepEqual([s.get(5).last, s.get(5).how], ["2026-02-01", "pm unit"]);
  assert.deepEqual([s.get(4).last, s.get(4).how], ["2026-02-01", "model"], "a PM that logged one unit still dates the others it names; a visit after today doesn't");
  assert.equal(s.get(5).lastYear, 1, "a PM logged on the unit and naming its model counts once");
  assert.equal(E.namesModel("TB3 brewer", "Bunn TB3"), true);
  assert.equal(E.namesModel("TB30 brewer", "Bunn TB3"), false, "whole words only");
  assert.equal(E.namesModel("Mini grinder", "La Marzocco Mini"), false, "one word left needs a number");
  assert.equal(E.namesModel("ITCB-DV", "Bunn ITCB-DV"), true, "two words left, no number");
  assert.equal(E.namesModel("Linea PB leaking", "La Marzocco Linea PB"), true);
});

test("a ticket for all the equipment dates every machine at its account", () => {
  const s = E.serviceByMachine(
    [m(1, "Test Diner", "Bunn TB3"), m(2, "Test Diner", "Bunn TB3"), m(3, "Test Cafe", "Bunn TB3")],
    [v("tlc", 1, "Test Diner", "2026-06-01", "All"), v("service", 2, "Test Cafe", "2026-06-01", "All the brewers")],
    [],
    TODAY,
  );
  assert.deepEqual([s.get(1).how, s.get(2).how, s.get(3).last], ["all", "all", null], "only the whole word list counts");
});

test("a short serial is not searched for, so it can't match a phone number or a part number", () => {
  const s = E.serviceByMachine([m(1, "Test Diner", "Test Brewer", { serial: "1234" })], [v("service", 1, "Test Diner", "2026-01-01", "", "Call 555-1234")], [], TODAY);
  assert.equal(s.get(1).last, null);
});

test("ownership groups, by account; the service load by account and by model; the flagged list, longest first", () => {
  assert.deepEqual(
    ["Loaned", "loaner", "Lease", "Leased equipment", "Owned - Purchased from Katz", "Customer owned", "Rental", "", null].map(E.ownershipGroup),
    ["Loaned", "Loaned", "Leased", "Leased", "Owned", "Owned", "Other", "Not set", "Not set"],
  );
  const machines = [
    m(1, "Test Diner", "Bunn TB3", { serial: "TB3-55821", ownership: "Loaned", installDate: "2020-01-01" }),
    m(2, "Test Diner", "Fetco CBS-62H", { ownership: "Lease", installDate: "2020-01-01" }),
    m(3, "Test Cafe", "Bunn TB3", { serial: "TB3-77777", installDate: "2026-09-01" }),
    m(4, "Test Cafe", "Test Grinder"),
  ];
  assert.deepEqual(
    E.ownershipByAccount(machines).map((a) => [a.customer, a.total, a.Loaned, a.Leased, a["Not set"]]),
    [["Test Cafe", 2, 0, 0, 2], ["Test Diner", 2, 1, 1, 0]],
  );
  const visits = [
    v("service", 1, "Test Diner", "2026-10-01", "", "SN TB3-55821"),
    v("pm", 2, "Test Diner", "2026-06-01", "Bunn TB3"),
    v("service", 3, "Test Diner", "2024-06-01", "Fetco CBS-62H"),
    v("service", 4, "Nobody Here", "2026-06-01", "Bunn TB3"),
  ];
  const a = E.buildEquipmentAnalytics(machines, visits, [], TODAY);
  assert.deepEqual(a.accountLoad.map((x) => [x.customer, x.service, x.pm, x.total, x.machines]), [["Test Diner", 1, 1, 2, 2]]);
  assert.deepEqual(a.modelLoad, [{ model: "Bunn TB3", machines: 2, visits: 2, perMachine: 1 }]);
  assert.deepEqual(a.visitsLastYear, { pm: 1, service: 1, tlc: 0 });
  assert.deepEqual(a.flags, { ok: 1, overdue: 1, never: 0, new: 1, unknown: 1 });
  assert.deepEqual(
    a.flagged.map((x) => [x.id, x.flag, x.last, x.daysSince]),
    [[4, "unknown", null, null], [2, "overdue", "2024-06-01", E.daysBetween("2024-06-01", TODAY)]],
  );
  assert.deepEqual(a.byOwnership, [["Loaned", 1], ["Leased", 1], ["Not set", 2]]);
  assert.deepEqual(a.byBrand, [["Bunn", 2], ["Fetco", 1], ["Test", 1]]);
  assert.equal(a.accounts, 2);
  const csv = E.flaggedCsv(a.flagged).split("\r\n");
  assert.equal(csv[0], "Account,Brand,Catalog Model,Serial,Ownership,Install Date,Last Service,Last Visit,Matched By,Days Since,Flag");
  assert.match(csv[2], /^Test Diner,Fetco,Fetco CBS-62H,,Lease,2020-01-01,2024-06-01,Service #3,Model on the ticket,\d+,Not serviced in over a year$/);
});

test("the database read: completed visits only, and PMs tied by serial, account unit, link and logged part", async () => {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  try {
    for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    const query = async (text, params) => (await pg.query(text, params)).rows;
    const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
    const unit = async (model, serial) =>
      Number((await query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, install_date) values ('Test Diner', $1, $1, $2, $3, '2020-01-01') returning id", [model, serial, serial ? serial.toLowerCase() : null]))[0].id);
    const bySerial = await unit("Test Brewer A", "SER-AAAAA");
    const byAcct = await unit("Test Brewer B", null);
    const byLink = await unit("Test Brewer C", null);
    const byPart = await unit("Test Brewer D", null);
    const never = await unit("Test Brewer E", null);
    const pm = async (status, completed) => Number((await query("insert into pm_jobs (customer, status, completed_at) values ('Test Diner', $1, $2) returning id", [status, completed]))[0].id);
    const p1 = await pm("Completed", "2026-10-01");
    const p2 = await pm("Completed", "2026-09-01");
    const p3 = await pm("Completed", "2026-08-01");
    const p4 = await pm("Completed", "2026-07-01");
    await pm("Cancelled", "2026-10-02");
    await query("insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, serial_key) values ($1, 'ser-aaaaa', 'test', 'ser-aaaaa'), ($2, $3, 'test', null)", [p1, p2, `acct:${byAcct}`]);
    await query("insert into pm_runbook_unit_links (pm_job_id, piece_key, account_equipment_id) values ($1, 'piece:1', $2)", [p3, byLink]);
    await query("insert into machine_parts (pm_job_id, piece_key, account_equipment_id, machine_label, item) values ($1, 'piece:2', $2, 'Test Brewer D', 'Test part')", [p4, byPart]);
    await query(
      `insert into service_jobs (kind, call_id, customer, equipment, status, completed_at) values
        ('service', 'T-1', 'Test Diner', 'Test Brewer E', 'Cancelled', '2026-10-01'),
        ('service', 'T-2', 'Test Diner', 'Test Brewer E', 'Phone Resolved', '2026-10-01'),
        ('service', 'T-3', 'Test Diner', 'Test Brewer E', 'Open', null)`,
    );
    const a = await readEquipmentAnalytics(sql, TODAY);
    assert.equal(a.machines, 5);
    assert.deepEqual(a.flagged.map((x) => x.id), [never], "only the machine no completed visit ties to");
    assert.deepEqual(a.flags, { ok: 4, overdue: 0, never: 1, new: 0, unknown: 0 });
    assert.deepEqual(a.visitsLastYear, { pm: 4, service: 0, tlc: 0 });
    assert.ok([bySerial, byAcct, byLink, byPart].every((id) => !a.flagged.some((x) => x.id === id)));
  } finally {
    await pg.close();
  }
});

test("the page: an Analytics section the Warehouse role doesn't get, with the flagged list and its export", () => {
  const page = src("src/routes/_app/assets.tsx");
  assert.ok(page.includes('section === "analytics" ? <AnalyticsSection />'));
  assert.ok(page.includes("getEquipmentAnalytics()"));
  assert.ok(page.includes("flaggedCsv(flagged)"));
  assert.ok(src("src/lib/ops/equipment-analytics-api.ts").includes("if (await isWarehouseOnly(sql, context.userId)) throw new Error("));
});

// Fable review of this PR (11/13).
test("a serial is matched only as its own word or neighbouring words, never inside a date, phone or another serial", () => {
  assert.equal(E.writesSerial("returned 10/12/2025 no fault", "12202"), false);
  assert.equal(E.writesSerial("call mgr 312-555-1234", "55512"), false);
  assert.equal(E.writesSerial("Grinder serviced", "ERVIC"), false, "a serial needs a digit");
  assert.equal(E.writesSerial("SN A12345", "A1234"), false);
  assert.equal(E.writesSerial("SN A12345", "A12345"), true);
  assert.equal(E.writesSerial("Serial TB3 55821, valve", "TB3-55821"), true);
  assert.equal(E.writesSerial("sn#tb3-55821", "TB3 55821"), true);
});

test("the longer model is read first; a serial doesn't stop the models; equipment names count; pairs need two mentions", () => {
  const machines = [
    m(1, "Test Diner", "Bunn TB3"),
    m(2, "Test Diner", "Bunn TB3 DV"),
    m(3, "Test Cafe", "Bunn TB3", { serial: "TB3-55821" }),
    m(4, "Test Cafe", "Fetco CBS-62H"),
    m(5, "Test Bar", "Bunn 34800.0001", { equipmentName: "Bunn ITCB-DV Twin" }),
    m(6, "Test Deli", "Bunn TB3"),
    m(7, "Test Deli", "Bunn TB3"),
  ];
  const visits = [
    v("service", 1, "Test Diner", "2026-06-01", "Bunn TB3-DV"),
    v("service", 2, "Test Cafe", "2026-06-01", "Bunn TB3 SN TB3-55821\nFetco CBS-62H"),
    v("service", 3, "Test Bar", "2026-06-01", "Bunn ITCB-DV Twin"),
    v("pm", 4, "Test Deli", "2026-06-01", "Bunn TB3\nBunn TB3"),
  ];
  const s = E.serviceByMachine(machines, visits, [], TODAY);
  assert.deepEqual([s.get(1).last, s.get(2).how], [null, "model"], "TB3 DV, not the TB3 beside it");
  assert.deepEqual([s.get(3).how, s.get(4).how], ["serial", "model"]);
  assert.equal(s.get(5).how, "model");
  assert.deepEqual([s.get(6).how, s.get(7).how], ["model", "model"], "named twice for two machines");
});

test("bad days, blank accounts, punctuation in names, and a ticket from before the machine was installed", () => {
  const machines = [
    m(1, "Joe's Diner", "Bunn TB3", { installDate: "2020-01-01" }),
    m(2, "  ", "Bunn TB3"),
    m(3, "Test Cafe", "Bunn TB3", { installDate: "2026-09-01" }),
    m(4, "Test Cafe", "Fetco CBS-62H", { serial: "FET-90001", installDate: "2026-09-01" }),
  ];
  const visits = [
    v("service", 1, "Joes Diner", "20205-01-0", "TB3"),
    v("service", 2, "JOES DINER", "2026-02-01", "TB3"),
    v("tlc", 3, "", "2026-02-01", "All"),
    v("service", 4, "Test Cafe", "2024-06-01", "Bunn TB3", "Bunn TB3 FET-90001"),
  ];
  const s = E.serviceByMachine(machines, visits, [], TODAY);
  assert.deepEqual([s.get(1).last, s.get(1).lastId], ["2026-02-01", 2], "the bad day is skipped; Joes Diner is Joe's Diner");
  assert.equal(s.get(2).last, null, "a ticket with no account dates nothing");
  assert.equal(s.get(3).last, null, "a model ticket from before the install isn't this machine");
  assert.equal(s.get(4).last, "2024-06-01", "its serial is this machine's own history");
  assert.equal(E.serviceFlag(s.get(3), "2026-09-01", TODAY), "new");
});

test("a PM stacked on a ticket is one trip in the load, but still dates the machine", () => {
  const machines = [m(1, "Test Diner", "Bunn TB3")];
  const visits = [v("service", 1, "Test Diner", "2026-06-01", "Bunn TB3"), { ...v("pm", 2, "Test Diner", "2026-07-01", "Bunn TB3"), stacked: true }];
  const a = E.buildEquipmentAnalytics(machines, visits, [], TODAY);
  assert.deepEqual(a.visitsLastYear, { pm: 0, service: 1, tlc: 0 });
  assert.equal(a.flagged.length, 0);
  assert.ok(src("src/lib/ops/equipment-analytics-api.ts").includes("least(coalesce(p.projected, p.received), p.updated_at::date)"), "a PM closed early isn't dated in the future");
  assert.ok(src("src/routes/_app/assets.tsx").includes('"No flagged machine matches the search or flag."'));
});
