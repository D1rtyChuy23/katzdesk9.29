import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Add equipment and Part # on an account's Equipment tab (Chuy, 11/9). Made-up accounts and machines only.

await register("./node-resolve-hook.mjs", import.meta.url);
// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const E = await import("../src/lib/ops/account-equip.ts");
const A = await import("../src/lib/ops/account-equip-edit.ts");
const IMP = await import("../src/lib/ops/account-equip-import.ts");
const { lockedMessage } = await import("../src/lib/ops/equipment-lock-rules.ts");
const { readInspection, removeInspectionUnit } = await import("../src/lib/ops/inspection-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const HOUSE = "Test Steakhouse - Rosemont";
const CAFE = "Test Bean Cafe";
const GRINDER = "Bunn FPG-2 DBC French Press Grinder";
const BREWER = 'Bunn ITCB-DV, 29" w/Flip Tray';

/** The app's own parsers: dates come back as 'YYYY-MM-DD', counts as numbers (src/lib/db.ts). */
async function fresh({ upTo } = {}) {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  for (const name of files) {
    if (upTo && name >= upTo) break;
    await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  }
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  if (!upTo) {
    await query("insert into directory_customers (name) values ($1), ($2)", [HOUSE, CAFE]);
    await query("insert into directory_equipment (name) values ($1), ($2)", [GRINDER, BREWER]);
  }
  return { pg, sql, query };
}

const models = async (query) => (await query("select name from directory_equipment order by id")).map((r) => r.name);
const unitCount = async (query) => (await query("select count(*)::int as n from account_equipment"))[0].n;

test("migration 0124 only adds a blank part_number to each account unit", async () => {
  const { pg, query } = await fresh({ upTo: "0124" });
  try {
    await query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, $2, 'LPG0080607', 'lpg0080607')", [HOUSE, GRINDER]);
    const before = (await query("select * from account_equipment"))[0];
    await pg.exec(readFileSync(new URL("0124_account_unit_part_number.sql", MIGRATIONS), "utf8"));
    const after = (await query("select * from account_equipment"))[0];
    assert.equal(after.part_number, null);
    const { part_number, ...rest } = after;
    assert.deepEqual(rest, before, "nothing else on the unit changes");
    const col = (await query("select data_type, is_nullable from information_schema.columns where table_name = 'account_equipment' and column_name = 'part_number'"))[0];
    assert.deepEqual(col, { data_type: "text", is_nullable: "YES" });
  } finally {
    await pg.close();
  }
});

test("a Part # is kept as typed, with spaces tidied; blank is none; past 60 characters it's refused", () => {
  assert.equal(E.cleanPartNumber("  33200.0000 "), "33200.0000");
  assert.equal(E.cleanPartNumber("52100.0101   (flip  tray)"), "52100.0101 (flip tray)");
  // A Part # pasted from NetSuite or a PDF can carry no-break and thin spaces.
  assert.equal(E.cleanPartNumber("\u00a0PN\u00a0123\u202f-\u2007A\u2009 "), "PN 123 - A");
  assert.equal(E.cleanPartNumber("   "), null);
  assert.equal(E.cleanPartNumber(null), null);
  assert.equal(E.PART_NUMBER_MAX, 60);
  assert.deepEqual(E.checkUnitFields({ partNumber: "x".repeat(60), ownership: "", installDate: "" }), {
    fields: { partNumber: "x".repeat(60), ownership: null, installDate: null },
  });
  assert.deepEqual(E.checkUnitFields({ partNumber: "x".repeat(61) }), { error: "The part number is too long (60 characters at most)." });
  // Ownership is one of the list's; the install date a real date.
  assert.deepEqual(E.checkUnitFields({ ownership: "Lease", installDate: "2025-11-14" }), { fields: { partNumber: null, ownership: "Lease", installDate: "2025-11-14" } });
  assert.deepEqual(E.checkUnitFields({ ownership: "Borrowed" }), { error: "Pick the ownership from the list." });
  assert.deepEqual(E.checkUnitFields({ installDate: "soon" }), { error: "Pick a real install date." });
  assert.deepEqual(E.checkUnitFields({ installDate: "11/14/2025" }).fields.installDate, "2025-11-14");
});

test("Add equipment puts a machine on the account with its serial, Part #, ownership and install date", async () => {
  const { pg, sql, query } = await fresh();
  try {
    // The model as typed matches the equipment list's name, whatever its case.
    const row = await A.addEquipmentUnit(sql, HOUSE.toLowerCase(), {
      model: " bunn fpg-2 dbc french press grinder ",
      serial: " LPG0080607 ",
      partNumber: " 33200.0000 ",
      ownership: "Loaned",
      installDate: "2025-11-14",
    });
    assert.equal(row.customer, HOUSE, "the account's own name");
    assert.equal(row.catalogModel, GRINDER);
    assert.equal(row.equipmentName, GRINDER);
    assert.equal(row.serial, "LPG0080607");
    assert.equal(row.serialKey, "lpg0080607");
    assert.equal(row.partNumber, "33200.0000");
    assert.equal(row.ownership, "Loaned");
    assert.equal(row.installDate, "2025-11-14");
    assert.equal(row.lockedBy, null);
    // The account's list has it, Part # and all.
    const listed = await IMP.readAccountUnits(sql, HOUSE);
    assert.deepEqual(listed.map((u) => [u.catalogModel, u.serial, u.partNumber]), [[GRINDER, "LPG0080607", "33200.0000"]]);
    assert.equal(listed[0].seen, row.seen);
    assert.deepEqual(await models(query), [GRINDER, BREWER], "no model added");

    // No serial is fine, and so is a second machine of the same model with none.
    const a = await A.addEquipmentUnit(sql, HOUSE, { model: BREWER });
    const b = await A.addEquipmentUnit(sql, HOUSE, { model: BREWER, partNumber: "52100.0101" });
    assert.deepEqual([a.serial, a.serialKey, a.partNumber, a.ownership, a.installDate], [null, null, null, null, null]);
    assert.equal(b.partNumber, "52100.0101");
    assert.equal(await unitCount(query), 3);
  } finally {
    await pg.close();
  }
});

test("a model that isn't on the equipment list is added to it, as the Equipment import does", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const row = await A.addEquipmentUnit(sql, CAFE, { model: "  Fetco  CBS-2152XTS ", serial: "FX-1" });
    assert.equal(row.catalogModel, "Fetco CBS-2152XTS");
    assert.deepEqual(await models(query), [GRINDER, BREWER, "Fetco CBS-2152XTS"]);
    // An archived model comes back rather than a second one being made.
    await query("update directory_equipment set archived = true where name = $1", [BREWER]);
    await A.addEquipmentUnit(sql, CAFE, { model: BREWER.toUpperCase() });
    assert.deepEqual(await query("select name, archived from directory_equipment where lower(name) = lower($1)", [BREWER]), [{ name: BREWER, archived: false }]);
    await assert.rejects(() => A.addEquipmentUnit(sql, CAFE, { model: "   " }), { message: "Pick or type the model." });
  } finally {
    await pg.close();
  }
});

test("a serial already on this account, on another account, or in Katz stock is refused, and adds nothing", async () => {
  const { pg, sql, query } = await fresh();
  try {
    await A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, serial: "LPG0080607" });
    await A.addEquipmentUnit(sql, CAFE, { model: BREWER, serial: "ITCB181626" });
    // The HQ barn's racks, and a Katz site off the racks.
    await query("insert into assets (kind, model, serial, qty, site, status) values ('equip', $1, 'ITCB-777', 1, 'barn-back', 'ready')", [BREWER]);
    await query("insert into assets (kind, model, serial, qty, site, status) values ('equip', $1, 'LPG-555', 1, 'staging', 'deployed')", [GRINDER]);
    // Gone from Katz: the account's unit is the record of it.
    await query("insert into assets (kind, model, serial, qty, site, status) values ('equip', $1, 'LPG-444', 1, 'sold', 'sold')", [GRINDER]);
    const units = await unitCount(query);
    const list = await models(query);

    // Case, spaces and # don't make it a different serial.
    await assert.rejects(() => A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, serial: "lpg 0080607" }), { message: "SN lpg 0080607 is already on this account." });
    await assert.rejects(() => A.addEquipmentUnit(sql, HOUSE, { model: BREWER, serial: "#ITCB181626" }), {
      message: `SN #ITCB181626 is on ${CAFE}. A machine moves only when it comes back to the HQ barn.`,
    });
    await assert.rejects(() => A.addEquipmentUnit(sql, HOUSE, { model: BREWER, serial: "itcb-777" }), {
      message: "SN itcb-777 is in the HQ barn. Send it out with Warehouse → Assign.",
    });
    await assert.rejects(() => A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, serial: "LPG-555" }), {
      message: "SN LPG-555 is at Katz (Staging area). Send it out with Warehouse → Assign.",
    });
    // A refused machine with a new model doesn't add the model either.
    await assert.rejects(() => A.addEquipmentUnit(sql, HOUSE, { model: "Made-up Model 9", serial: "LPG0080607" }), /already on this account/);
    assert.equal(await unitCount(query), units);
    assert.deepEqual(await models(query), list);

    // Sold from Katz, it can go on an account.
    const sold = await A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, serial: "LPG-444" });
    assert.equal(sold.serial, "LPG-444");
    // Assigned to this account and waiting at a Katz site, it isn't Katz stock: it can go back on the account it's for.
    await query("insert into assets (kind, model, serial, qty, site, status, sold_to) values ('equip', $1, 'LPG-333', 1, 'staging', 'deployed', $2)", [GRINDER, HOUSE]);
    const waiting = await A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, serial: "LPG-333" });
    assert.equal(waiting.serial, "LPG-333");
  } finally {
    await pg.close();
  }
});

test("Add equipment needs an account in the directory, and checks what's typed before anything is written", async () => {
  const { pg, sql, query } = await fresh();
  try {
    await assert.rejects(() => A.addEquipmentUnit(sql, "Nobody's Diner", { model: GRINDER }), { message: "Nobody's Diner isn't an account in the directory." });
    await assert.rejects(() => A.addEquipmentUnit(sql, "Walk-in", { model: GRINDER }), { message: "A walk-in has no account to add equipment to." });
    await query("update directory_customers set archived = true where name = $1", [CAFE]);
    await assert.rejects(() => A.addEquipmentUnit(sql, CAFE, { model: GRINDER }), { message: `${CAFE} isn't an account in the directory.` });
    await assert.rejects(() => A.addEquipmentUnit(sql, HOUSE, { model: "New Model X", partNumber: "x".repeat(61) }), /too long/);
    await assert.rejects(() => A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, ownership: "Borrowed" }), { message: "Pick the ownership from the list." });
    await assert.rejects(() => A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, installDate: "2025-02-31" }), { message: "Pick a real install date." });
    assert.equal(await unitCount(query), 0);
    assert.deepEqual(await models(query), [GRINDER, BREWER]);
  } finally {
    await pg.close();
  }
});

test("Edit changes a unit's Part #, ownership and install date; a locked or changed unit is refused", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const row = await A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, serial: "LPG0080607", ownership: "Loaned" });
    const done = await A.editEquipmentUnit(sql, row.id, { seen: row.seen, partNumber: " 33200.0000 ", ownership: "Owned - Purchased from Katz", installDate: "11/14/2025" });
    assert.deepEqual([done.partNumber, done.ownership, done.installDate], ["33200.0000", "Owned - Purchased from Katz", "2025-11-14"]);
    // The model and serial stay as they were.
    assert.deepEqual([done.catalogModel, done.serial, done.serialKey], [GRINDER, "LPG0080607", "lpg0080607"]);
    assert.notEqual(done.seen, row.seen);

    // A window opened before that save can't save over it.
    await assert.rejects(() => A.editEquipmentUnit(sql, row.id, { seen: row.seen, partNumber: "OLD" }), { message: "This unit changed since you opened it. Open Edit again." });
    // Blank clears.
    const cleared = await A.editEquipmentUnit(sql, row.id, { seen: done.seen, partNumber: "", ownership: "", installDate: "" });
    assert.deepEqual([cleared.partNumber, cleared.ownership, cleared.installDate], [null, null, null]);

    // Locked by the owner: nothing changes until it's unlocked.
    await query("update account_equipment set locked_at = now(), locked_by = 'chuy' where id = $1", [row.id]);
    const locked = (await IMP.readAccountUnits(sql, HOUSE))[0];
    await assert.rejects(() => A.editEquipmentUnit(sql, row.id, { seen: locked.seen, partNumber: "33200.0000" }), { message: lockedMessage("chuy", null) });
    assert.equal((await IMP.readAccountUnits(sql, HOUSE))[0].partNumber, null);

    // An ownership saved before today's list keeps saving as it is; it can't be changed to another that isn't on the list.
    const old = await A.addEquipmentUnit(sql, CAFE, { model: BREWER });
    await query("update account_equipment set ownership = 'Customer owned (old import)' where id = $1", [old.id]);
    const before = (await IMP.readAccountUnits(sql, CAFE))[0];
    const kept = await A.editEquipmentUnit(sql, old.id, { seen: before.seen, partNumber: "52100.0101", ownership: "Customer owned (old import)" });
    assert.deepEqual([kept.partNumber, kept.ownership], ["52100.0101", "Customer owned (old import)"]);
    await assert.rejects(() => A.editEquipmentUnit(sql, old.id, { seen: kept.seen, ownership: "Borrowed" }), { message: "Pick the ownership from the list." });

    await assert.rejects(() => A.editEquipmentUnit(sql, 999, { seen: "x", partNumber: "1" }), { message: "That unit is not on the account." });
    await assert.rejects(() => A.editEquipmentUnit(sql, cleared.id, { seen: cleared.seen, partNumber: "x".repeat(61) }), /too long/);
  } finally {
    await pg.close();
  }
});

test("the add and edit statements check the serial and the lock again as they write, with the checks in front skipped", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const row = await A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, serial: "LPG0080607" });
    await query("insert into assets (kind, model, serial, qty, site, status) values ('equip', $1, 'ITCB 777', 1, 'barn-front', 'ready')", [BREWER]);
    const add = (serial, key) => sql.query(A.addUnitSql(), [CAFE, BREWER, serial, key, null, null, null]);
    // What two people adding the same machine at once would write second: nothing.
    assert.deepEqual(await add("LPG0080607", "lpg0080607"), []);
    assert.deepEqual(await add("#ITCB777", "itcb777"), []);
    // A serial nobody has, and no serial at all, are written.
    assert.equal((await add("ITCB181626", "itcb181626")).length, 1);
    assert.equal((await add(null, null)).length, 1);
    assert.equal(await unitCount(query), 3);

    // Locked, or changed since it was read: the edit writes nothing.
    const edit = (seen) => sql.query(A.editUnitSql(), [row.id, "33200.0000", null, null, seen]);
    await query("update account_equipment set locked_at = now(), locked_by = 'chuy' where id = $1", [row.id]);
    const locked = (await IMP.readAccountUnits(sql, HOUSE))[0];
    assert.deepEqual(await edit(locked.seen), []);
    // Unlocked, the same edit writes: the lock was all that stopped it.
    await query("update account_equipment set locked_at = null, locked_by = null where id = $1", [row.id]);
    assert.equal((await edit(locked.seen)).length, 1);
    assert.equal((await IMP.readAccountUnits(sql, HOUSE))[0].partNumber, "33200.0000");
    // Once written, the read before it is out of date.
    assert.deepEqual(await edit(locked.seen), []);
  } finally {
    await pg.close();
  }
});

test("Merge keeps the kept unit's Part #, or takes the other's when it has none", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, serial: "LPG0080607" });
    const drop = await A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, partNumber: "33200.0000" });
    await IMP.mergeEquipmentUnits(sql, keep.id, drop.id);
    assert.deepEqual((await IMP.readAccountUnits(sql, HOUSE)).map((u) => [u.id, u.serial, u.partNumber]), [[keep.id, "LPG0080607", "33200.0000"]]);

    const other = await A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, partNumber: "33200.0099" });
    await IMP.mergeEquipmentUnits(sql, keep.id, other.id);
    assert.deepEqual((await IMP.readAccountUnits(sql, HOUSE)).map((u) => [u.id, u.partNumber]), [[keep.id, "33200.0000"]]);
  } finally {
    await pg.close();
  }
});

test("a serial-less unit with a Part # stays on the account when it's taken off a pre-inspection", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const typed = await A.addEquipmentUnit(sql, HOUSE, { model: GRINDER, partNumber: "33200.0000" });
    const bare = await A.addEquipmentUnit(sql, HOUSE, { model: BREWER });
    const id = (await query("insert into installs (customer, equipment) values ($1, $2) returning id", [HOUSE, `${GRINDER}\n${BREWER}`]))[0].id;
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => m.equipmentId).sort(), [typed.id, bare.id].sort(), "the visit takes both units");
    await removeInspectionUnit(sql, { installId: id, equipmentId: typed.id }, "Test");
    await removeInspectionUnit(sql, { installId: id, equipmentId: bare.id }, "Test");
    // The one with nothing typed on it goes, as before; the one with a Part # stays, Part # and all.
    assert.deepEqual((await IMP.readAccountUnits(sql, HOUSE)).map((u) => [u.id, u.partNumber]), [[typed.id, "33200.0000"]]);
  } finally {
    await pg.close();
  }
});

test("the Equipment tab offers Add equipment and Edit, and each row shows its Part #", () => {
  const list = src("src/components/desk/account-history.tsx");
  const form = src("src/components/desk/account-unit-form.tsx");
  // The list takes the account's name; the button shows only with one.
  assert.match(list, /customer\?: string \| null;/);
  assert.match(list, /\{canAddEquipmentTo\(customer\) \? \(\n\s+<Button[^>]*data-testid="account-equipment-add"/);
  assert.match(list, />\s*Add equipment\s*</);
  // Each row: Part # after the model, then the serial.
  assert.match(list, /row\.partNumber \? `Part # \$\{row\.partNumber\}` : null,\n\s+row\.serial \? `SN \$\{row\.serial\}` : "No serial",/);
  // Each row is keyed by its unit, so removing a row above an open Edit doesn't rebuild the form and drop what's typed.
  assert.ok(list.includes('<li key={row.id ? `unit-${row.id}` : `${row.catalogModel}-${row.serial ?? "none"}-${i}`} className="px-3 py-2.5">'));
  // Edit sits with Remove, off while the unit is locked.
  assert.match(list, /disabled=\{!!row\.lockedBy\}[^>]*data-testid="edit-account-unit"/);
  // The form: model, serial, Part #, ownership, install date; Edit shows the model and serial without changing them.
  for (const id of ["account-unit-model", "account-unit-serial", "account-unit-part", "account-unit-ownership", "account-unit-install-date", "account-unit-save", "account-unit-cancel", "account-unit-error"]) {
    assert.match(form, new RegExp(`data-testid="${id}"`), id);
  }
  assert.match(form, /maxLength=\{PART_NUMBER_MAX\}/);
  assert.match(form, /OWNERSHIP_VALUES\.map\(/);
  assert.match(form, /type="date"/);
  assert.match(form, /\{unit \? \(\n\s+<p[^>]*data-testid="account-unit-fixed"/);
  assert.ok(form.includes("addAccountEquipment({ data: { customer, model, serial, partNumber, ownership, installDate } })"));
  // Edit sends the version it opened with, so a list refresh while it's open can't let it save over a newer save.
  assert.ok(form.includes('const [seen] = useState(unit?.seen ?? "");'));
  assert.ok(form.includes("editAccountEquipment({ data: { id: unit.id, seen, partNumber, ownership, installDate } })"));
  // Both windows pass the account's name.
  assert.match(src("src/components/desk/customer-sheet.tsx"), /<AccountEquipmentList customer=\{history\.data\?\.name \?\? null\} /);
  assert.match(src("src/components/desk/job-sheet.tsx"), /<AccountEquipmentList customer=\{customer \|\| null\} /);
});
