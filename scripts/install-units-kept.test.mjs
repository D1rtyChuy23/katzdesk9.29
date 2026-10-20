import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

register(new URL("./ts-alias-hook.mjs", import.meta.url));

// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { addMachineOntoInstall, readInspection, syncInstallUnits } = await import("../src/lib/ops/inspection-api.ts");
const { mergeEquipmentUnits, removeEquipmentUnit } = await import("../src/lib/ops/account-equip-import.ts");
const { formMachines } = await import("../src/lib/ops/install-form-api.ts");
const installForm = await import("../src/lib/ops/install-form.ts");
const { groupFormRows } = installForm;
const machines = await import("../src/lib/ops/machines.ts");
const { parseMachinesJson } = machines;
const { catalogModels } = await import("../src/lib/ops/equipment.ts");
const { appendServerMachines } = await import("../src/lib/ops/warehouse-serial.ts");

const ITCB_CATALOG = 'Bunn ITCB-DV, 29" w/Flip Tray';
const CAMEO_CATALOG = "Eversys Cameo c'2s - 2 Step Classic";

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_equipment (name) values ($1), ('Bunn G9-2T'), ('Bunn TB3')", [ITCB_CATALOG]);
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}

async function install(pg, customer, equipment) {
  return (await pg.query("insert into installs (customer, equipment) values ($1, $2) returning id", [customer, equipment])).rows[0].id;
}

/** The body of one component function in a .tsx file, from its signature to the next top-level function. */
function componentSource(file, name) {
  const src = readFileSync(new URL(file, import.meta.url), "utf8");
  const start = src.indexOf(`export function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const end = src.indexOf("\nexport function ", start + 1);
  return src.slice(start, end < 0 ? undefined : end);
}

/** Each useEffect(...) call in the source, parentheses balanced. */
function effects(src) {
  const out = [];
  for (let at = src.indexOf("useEffect("); at >= 0; at = src.indexOf("useEffect(", at + 1)) {
    let depth = 0;
    let i = at + "useEffect".length;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) break;
    }
    out.push(src.slice(at, i + 1));
  }
  return out;
}

/**
 * The install window's machine list, step for step with InstallSheet: it opens on the board's row, its effect brings the list
 * up to date when the board refetches, an Equipment-tab save sends listForSave, and closing sends the list only if it changed.
 * Saves go through updateInstall's machine part: the columns, then syncInstallUnits with prune.
 */
async function openWindow(pg, sql, id) {
  const boardRow = async () => {
    const r = (await pg.query("select * from installs where id = $1", [id])).rows[0];
    const dir = (await pg.query("select name from directory_equipment where archived = false")).rows.map((d) => d.name);
    return { ...r, powerVoltage: r.power_voltage, machines: machines.specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines, catalogModels(dir)) };
  };
  const send = async (packed) => {
    await pg.query("update installs set equipment = $2, serial = $3, power_voltage = $4, machines = $5 where id = $1", [
      id,
      packed.equipment,
      packed.serial,
      packed.powerVoltage,
      packed.machines,
    ]);
    await syncInstallUnits(sql, id, { prune: true });
  };
  let row = await boardRow();
  const w = { specs: machines.machinesOnOpen(row), loaded: machines.machinesOnOpen(row), seen: row.machines };
  w.refetch = async (next) => {
    row = next ?? (await boardRow());
    w.loaded = installForm.machinesBeforeSave(w.loaded, w.seen, row.machines);
    w.specs = installForm.machinesBeforeSave(w.specs, w.seen, row.machines);
    w.seen = row.machines;
  };
  w.save = async (next) => {
    w.specs = w.loaded = installForm.machinesBeforeSave(next, w.seen, row.machines);
    await send(machines.serializeMachines(w.specs));
    await w.refetch();
  };
  w.close = async () => {
    const changed = machines.changedMachineFields(w.specs, w.loaded);
    if (changed.machines !== undefined) await send(changed);
  };
  /** Pre-inspection Add: rememberAddedMachine puts the visit's machines on the cached row, then refresh() refetches. */
  w.preAdd = async (model) => {
    const view = await addMachineOntoInstall(sql, { installId: id, model, serial: null, electrical: null }, "Test");
    const shown = view.machines.map((m) => ({ equipment: m.name || m.model, serial: m.serial ?? "", powerVoltage: m.electrical ?? "" }));
    await w.refetch({ ...row, machines: appendServerMachines(row.machines, shown) });
    await w.refetch();
    return view;
  };
  return w;
}

async function checkAndPhoto(pg, id, equipmentId) {
  await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, 'water', 'Fail')", [id, equipmentId]);
  await pg.query("insert into install_inspection_photos (install_id, equipment_id, category, data_url) values ($1, $2, 'water', 'data:image/jpeg;base64,AA')", [
    id,
    equipmentId,
  ]);
}

async function kept(pg, sql, id, equipmentId) {
  const view = await readInspection(sql, id);
  const n = async (table) => (await pg.query(`select count(*)::int as n from ${table} where install_id = $1 and equipment_id = $2`, [id, equipmentId])).rows[0].n;
  return { onVisit: view.machines.some((m) => m.equipmentId === equipmentId), checks: await n("install_inspection_items"), photos: await n("install_inspection_photos") };
}

const storedList = async (pg, id) => parseMachinesJson((await pg.query("select machines from installs where id = $1", [id])).rows[0].machines).map((m) => m.equipment);
const storedSerials = async (pg, id) =>
  parseMachinesJson((await pg.query("select machines from installs where id = $1", [id])).rows[0].machines).map((m) => [m.equipment, m.serial]);

/** The Serial box's lookup on one row (writeInstallSerial): the serial goes on that row unless another row of the install has it. */
async function lookupSerial(pg, id, index, serial) {
  const list = parseMachinesJson((await pg.query("select machines from installs where id = $1", [id])).rows[0].machines);
  const placed = installForm.applySerialInPlace(list, index, serial);
  if (placed.status === "updated") await pg.query("update installs set machines = $2 where id = $1", [id, JSON.stringify(placed.rows)]);
  return placed.status;
}

/**
 * removeInspectionEquipment with keepList: the unit's checks, photos and link go, and the account row when nothing else
 * uses it. It answers with readInspection, which syncs the units against the list that still has the row.
 */
async function dropUnit(pg, sql, id, equipmentId) {
  for (const table of ["install_inspection_photos", "install_inspection_items", "install_inspection_units"]) {
    await pg.query(`delete from ${table} where install_id = $1 and equipment_id = $2`, [id, equipmentId]);
  }
  await pg.query(
    `delete from account_equipment a where a.id = $1 and a.install_date is null and coalesce(a.serial_key, '') = ''
        and not exists (select 1 from install_inspection_units u where u.equipment_id = a.id)`,
    [equipmentId],
  );
  await readInspection(sql, id);
}

/** The Equipment tab's Remove: the unit visitUnitForRow picks goes first, then the list is saved (the save's prune runs last). */
async function removeRow(sql, pg, id, w, index) {
  const unit = installForm.visitUnitForRow(w.specs, index, (await readInspection(sql, id)).machines);
  if (unit) await dropUnit(pg, sql, id, unit.equipmentId);
  await w.save(w.specs.filter((_, i) => i !== index));
  return unit;
}

test("a second machine of a model already on the install, added on the Pre-inspection tab, keeps its check and photo through a save and the close", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Brews & Books", "Bunn TB3");
    await readInspection(sql, id);
    const w = await openWindow(pg, sql, id);
    const view = await addMachineOntoInstall(sql, { installId: id, model: "Bunn TB3", serial: null, electrical: null }, "Test");
    const added = view.machines.at(-1).equipmentId;
    await checkAndPhoto(pg, id, added);
    await w.refetch();
    assert.equal(w.specs.length, 2);
    await w.save(w.specs.map((s, i) => (i === 0 ? { ...s, powerVoltage: "120V" } : s)));
    await w.close();
    assert.deepEqual(await kept(pg, sql, id, added), { onVisit: true, checks: 1, photos: 1 });
    assert.equal((await readInspection(sql, id)).machines.length, 2);
  } finally {
    await pg.close();
  }
});

test("removing one of two identical no-serial rows keeps the other unit's check and photo", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Twin Cafe", "Bunn G9-2T\nBunn TB3\nBunn TB3");
    const first = (await readInspection(sql, id)).machines.filter((m) => m.model === "Bunn TB3")[0].equipmentId;
    await checkAndPhoto(pg, id, first);
    const w = await openWindow(pg, sql, id);
    // Two units could be the row, so none is taken off first: the save's prune keeps the one with the check.
    assert.equal(await removeRow(sql, pg, id, w, 2), null);
    assert.deepEqual(await kept(pg, sql, id, first), { onVisit: true, checks: 1, photos: 1 });
    assert.deepEqual(await storedList(pg, id), ["Bunn G9-2T", "Bunn TB3"]);
  } finally {
    await pg.close();
  }
});

test("removing either of two identical no-serial rows keeps the check and photo on the unit added second", async () => {
  for (const index of [0, 1]) {
    const { pg, sql } = await fresh();
    try {
      const id = await install(pg, "Mirror Cafe", "Bunn TB3");
      await readInspection(sql, id);
      const w = await openWindow(pg, sql, id);
      const view = await addMachineOntoInstall(sql, { installId: id, model: "Bunn TB3", serial: null, electrical: null }, "Test");
      const added = view.machines.at(-1).equipmentId;
      await checkAndPhoto(pg, id, added);
      await w.refetch();
      assert.equal(await removeRow(sql, pg, id, w, index), null);
      assert.deepEqual(await kept(pg, sql, id, added), { onVisit: true, checks: 1, photos: 1 }, `row ${index}`);
      await w.close();
      assert.deepEqual(await kept(pg, sql, id, added), { onVisit: true, checks: 1, photos: 1 }, `row ${index}`);
      assert.deepEqual(await storedList(pg, id), ["Bunn TB3"]);
      assert.equal((await readInspection(sql, id)).machines.length, 1);
    } finally {
      await pg.close();
    }
  }
});

test("removing either row of a machine added again under its catalog name keeps the added unit's check and photo", async () => {
  // The install row says "Eversys Cameo c'2s"; Pre-inspection Add uses the catalog name. The same for Bunn ITCB / ITCB-DV.
  for (const [short, long] of [
    ["Eversys Cameo c'2s", CAMEO_CATALOG],
    ["Bunn ITCB", ITCB_CATALOG],
  ]) {
    for (const index of [0, 1]) {
      const { pg, sql } = await fresh();
      try {
        await pg.query("insert into directory_equipment (name) values ($1)", [CAMEO_CATALOG]);
        const id = (
          await pg.query("insert into installs (customer, equipment, machines) values ('Real Cafe', $1, $2) returning id", [
            short,
            JSON.stringify([{ equipment: short, serial: "", powerVoltage: "" }]),
          ])
        ).rows[0].id;
        await readInspection(sql, id);
        const w = await openWindow(pg, sql, id);
        const added = (await w.preAdd(long)).machines.at(-1).equipmentId;
        await checkAndPhoto(pg, id, added);
        assert.equal(w.specs.length, 2);
        await removeRow(sql, pg, id, w, index);
        await w.close();
        assert.deepEqual(await kept(pg, sql, id, added), { onVisit: true, checks: 1, photos: 1 }, `${short} row ${index}`);
        assert.equal((await readInspection(sql, id)).machines.length, 1, `${short} row ${index}`);
      } finally {
        await pg.close();
      }
    }
  }
});

test("an item note with no status, or a core-hole answer, stays when either of two identical rows is removed", async () => {
  for (const mark of ["note", "core"]) {
    for (const index of [0, 1]) {
      const { pg, sql } = await fresh();
      try {
        const id = await install(pg, "Note Cafe", "Bunn TB3");
        await readInspection(sql, id);
        const w = await openWindow(pg, sql, id);
        // The first unit (the lower id) holds the answer; the one added second is empty.
        const first = (await w.preAdd("Bunn TB3")).machines[0].equipmentId;
        if (mark === "note") {
          await pg.query(
            "insert into install_inspection_items (install_id, equipment_id, category, status, notes) values ($1, $2, 'water', 'Not inspected', 'Ask the manager')",
            [id, first],
          );
        } else {
          await pg.query("update install_inspection_units set core_needed = 'no' where install_id = $1 and equipment_id = $2", [id, first]);
        }
        await removeRow(sql, pg, id, w, index);
        await w.close();
        const units = (await pg.query("select equipment_id, core_needed from install_inspection_units where install_id = $1", [id])).rows;
        const notes = (await pg.query("select notes from install_inspection_items where install_id = $1 and equipment_id = $2 and notes is not null", [id, first])).rows;
        const label = `${mark} row ${index}`;
        assert.deepEqual(units.map((u) => u.equipment_id), [first], label);
        if (mark === "note") assert.deepEqual(notes, [{ notes: "Ask the manager" }], label);
        else assert.equal(units[0].core_needed, "no", label);
      } finally {
        await pg.close();
      }
    }
  }
});

test("an Equipment-tab Remove takes its pre-inspection unit off before the list is saved, in the save's own queue", () => {
  const src = componentSource("../src/components/desk/entity-sheets.tsx", "InstallSheet");
  // Both mutations share one scope, so the save (and its prune) waits for the remove, and the remove's unit check cannot fail.
  assert.match(src, /const save = useMutation\(\{\s*scope: queue,\s*mutationFn: \(d[^)]*\) => updateInstall\(/);
  assert.match(src, /const dropUnit = useMutation\(\{\s*scope: queue,\s*mutationFn: [^\n]*removeInspectionEquipment\(\{ data: \{ \.\.\.v, keepList: true \} \}\)/);
  const remove = src.slice(src.indexOf("onRemove={(index) => {"));
  const drop = remove.indexOf("dropUnit.mutate(");
  assert.ok(drop >= 0 && drop < remove.indexOf("persistMachines(next)"));
});

test("a serial moved from one row to another is kept: the clear saves at once, so the other row's lookup takes it", async () => {
  const field = componentSource("../src/components/desk/serial-notice.tsx", "SerialPullField");
  const commit = field.slice(field.indexOf("function commit("), field.indexOf("const key = next"));
  assert.match(commit, /const had = saved\.current\.trim\(\);[\s\S]*if \(had\) onCleared\?\.\(\);/);
  const rows = componentSource("../src/components/desk/machine-fields.tsx", "MachineFields");
  assert.match(rows, /onCleared=\{installId \? \(\) => onCommit\?\.\(patch\(index, \{ serial: "" \}\)\) : undefined\}/);
  const { pg, sql } = await fresh();
  try {
    const TB3 = { equipment: "Bunn TB3", serial: "", powerVoltage: "" };
    const id = (
      await pg.query("insert into installs (customer, equipment, machines) values ('Move Cafe', $1, $2) returning id", ["Bunn TB3\nBunn TB3", JSON.stringify([TB3, TB3])])
    ).rows[0].id;
    await readInspection(sql, id);
    const w = await openWindow(pg, sql, id);
    // Typed on the wrong row: the lookup writes it there and the row saves.
    assert.equal(await lookupSerial(pg, id, 0, "TB9"), "updated");
    await w.save(w.specs.map((s, i) => (i === 0 ? { ...s, serial: "TB9" } : s)));
    // Cleared there: onCleared saves the row at once.
    await w.save(w.specs.map((s, i) => (i === 0 ? { ...s, serial: "" } : s)));
    // Typed on the right row: the server no longer has it on the first row.
    assert.equal(await lookupSerial(pg, id, 1, "TB9"), "updated");
    await w.save(w.specs.map((s, i) => (i === 1 ? { ...s, serial: "TB9" } : s)));
    await w.close();
    assert.deepEqual(await storedSerials(pg, id), [
      ["Bunn TB3", ""],
      ["Bunn TB3", "TB9"],
    ]);
  } finally {
    await pg.close();
  }
});

test("the Serial box's lookup waits in the install window's save queue, so a serial cleared on one row is saved before another row looks it up", () => {
  const field = componentSource("../src/components/desk/serial-notice.tsx", "SerialPullField");
  assert.match(field, /const pull = useMutation\(\{\s*scope: installId \? \{ id: `install-sheet-\$\{installId\}` \} : undefined,/);
  // The same queue as the sheet's save and dropUnit.
  const sheet = componentSource("../src/components/desk/entity-sheets.tsx", "InstallSheet");
  assert.match(sheet, /const queue = \{ id: `install-sheet-\$\{row\?\.id\}` \};/);
  assert.match(sheet, /installId=\{row\.id\}/);
});

test("a serial typed over one saved on another row, then Escape, is not saved on the second row", async () => {
  // The close sends changedMachineFields(specs, loadedSpecs.current) (install-close-serials checks that line).
  const T = (serial) => ({ equipment: "Bunn TB3", serial, powerVoltage: "" });
  const G = (serial) => ({ equipment: "Bunn G9-2T", serial, powerVoltage: "" });
  const F = { equipment: "Fetco CBS-51H", serial: "", powerVoltage: "120V" };
  assert.deepEqual(machines.changedMachineFields([T("X1"), G("X1")], [T("X1"), G("")]), {});
  // A typed copy on an earlier row is the one cleared too.
  assert.deepEqual(installForm.clearTypedDuplicates([G("X1"), T("X1")], [G(""), T("X1")]), [G(""), T("X1")]);
  // Not a duplicate: a row kept here but dropped from the baseline only shifts the rows, and nothing is cleared.
  assert.deepEqual(installForm.clearTypedDuplicates([T(""), F, G("X")], [T(""), G("X")]), [T(""), F, G("X")]);
  const { pg, sql } = await fresh();
  try {
    const id = (
      await pg.query("insert into installs (customer, equipment, machines) values ('Esc Cafe', $1, $2) returning id", [
        "Bunn TB3\nBunn G9-2T",
        JSON.stringify([T("X1"), G("")]),
      ])
    ).rows[0].id;
    await readInspection(sql, id);
    const w = await openWindow(pg, sql, id);
    w.specs = w.specs.map((s, i) => (i === 1 ? { ...s, serial: "X1" } : s));
    await w.close();
    assert.deepEqual(await storedSerials(pg, id), [
      ["Bunn TB3", "X1"],
      ["Bunn G9-2T", ""],
    ]);
  } finally {
    await pg.close();
  }
});

test("a machine removed on the Pre-inspection tab stays off the list after an Equipment save and the close", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "S4 Cafe", "Bunn TB3\nBunn G9-2T");
    await readInspection(sql, id);
    const w = await openWindow(pg, sql, id);
    // removeInspectionEquipment takes the machine off installs.machines, then refresh() refetches the board.
    await pg.query("update installs set equipment = 'Bunn TB3', machines = $2 where id = $1", [id, JSON.stringify([{ equipment: "Bunn TB3", serial: "", powerVoltage: "" }])]);
    await w.refetch();
    assert.deepEqual(w.specs.map((s) => s.equipment), ["Bunn TB3"]);
    await w.save(w.specs.map((s) => ({ ...s, powerVoltage: "120V" })));
    await w.close();
    assert.deepEqual(await storedList(pg, id), ["Bunn TB3"]);
  } finally {
    await pg.close();
  }
});

test("a serial already on another row of the install changes nothing on any serial pull path", () => {
  const src = readFileSync(new URL("../src/lib/ops/serial-pull.ts", import.meta.url), "utf8");
  const handler = src.slice(src.indexOf("export const applySerialPull"));
  const writes = handler.match(/await writeInstallSerial\(/g).length;
  const checked = handler.match(/const wrote = await writeInstallSerial\([^;]*;\s*if \(wrote === "duplicate"\) return alreadyOnInstall\(/g) ?? [];
  assert.equal(checked.length, writes);
  // Nothing comes out of the warehouse before the install row takes the serial.
  assert.ok(handler.indexOf("await attachAsset(") > handler.lastIndexOf("await writeInstallSerial("));
});

test("a serial typed in the Serial box reaches the row at once, and a cleared one is committed on blur", () => {
  const src = componentSource("../src/components/desk/serial-notice.tsx", "SerialPullField");
  const input = src.slice(src.indexOf("<Input"), src.indexOf("/>", src.indexOf("<Input")));
  assert.match(input, /onChange=\{\(e\) => \{[^}]*onValue\(e\.target\.value\);/);
  assert.match(input, /onBlur=\{\(\) => \{[^}]*if \(text\.trim\(\) \|\| saved\.current\.trim\(\)\) commit\(text\);/);
});

test("opening an install sheet saves nothing: no effect in InstallSheet writes the machine list", () => {
  const found = effects(componentSource("../src/components/desk/entity-sheets.tsx", "InstallSheet"));
  assert.ok(found.length > 0);
  for (const body of found) {
    assert.doesNotMatch(body, /persistMachines\(|save\.mutate\(|updateInstall\(/, body.slice(0, 200));
  }
});

test("pre-inspection Add equipment keeps the serials typed on the install's lines, and adds the machine once", async () => {
  const { pg, sql } = await fresh();
  try {
    const typed = "Bunn ITCB 120v SN:ITCB064919\nBunn G9-2T SN:G900073972";
    const id = await install(pg, "Tepatitlan Mexican Grill", typed);
    const view = await addMachineOntoInstall(sql, { installId: id, model: "Bunn TB3", serial: null, electrical: null }, "Test");
    assert.equal(view.machineCount, 3);
    const row = (await pg.query("select equipment, machines, serial from installs where id = $1", [id])).rows[0];
    const machines = parseMachinesJson(row.machines);
    assert.deepEqual(
      machines.map((m) => [m.equipment, m.serial]),
      [
        ["Bunn ITCB", "ITCB064919"],
        ["Bunn G9-2T", "G900073972"],
        ["Bunn TB3", ""],
      ],
    );
    assert.equal(row.equipment, `${typed}\nBunn TB3`);
    // The serials reach pre-inspection, and the next load adds nothing.
    const again = await readInspection(sql, id);
    assert.deepEqual(again.machines.map((m) => m.serial ?? "").sort(), ["", "G900073972", "ITCB064919"]);
    const units = (await pg.query("select count(*)::int as n from account_equipment")).rows[0].n;
    assert.equal(units, 3);
  } finally {
    await pg.close();
  }
});

test("Merge into the serial row keeps the pre-inspection result and does not add the unit back", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Cheeks Coffee", "Bunn ITCB");
    const imported = (
      await pg.query(
        "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Cheeks Coffee', $1, 'Bunn ITCB-DV', 'ITCB075996', 'itcb075996') returning id",
        [ITCB_CATALOG],
      )
    ).rows[0].id;
    let view = await readInspection(sql, id);
    const unit = view.machines.find((m) => !m.serial);
    for (const item of [...unit.items, unit.core]) {
      await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, $3, 'Pass')", [
        id,
        unit.equipmentId,
        item.category,
      ]);
    }
    await pg.query("update install_inspection_units set core_needed = 'no', note = 'Left of the sink' where install_id = $1", [id]);
    view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => m.overall), ["Passed"]);

    await mergeEquipmentUnits(sql, imported, unit.equipmentId);
    view = await readInspection(sql, id);
    assert.deepEqual(
      view.machines.map((m) => [m.equipmentId, m.serial, m.overall, m.note]),
      [[imported, "ITCB075996", "Passed", "Left of the sink"]],
    );
    assert.equal(view.overall, "Passed");
    const units = (await pg.query("select id from account_equipment where customer = 'Cheeks Coffee'")).rows;
    assert.deepEqual(units.map((u) => u.id), [imported]);
  } finally {
    await pg.close();
  }
});

test("Merge gives a kept check that was never answered the dropped unit's answer", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Cheeks Coffee", "Bunn ITCB");
    const imported = (
      await pg.query(
        "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Cheeks Coffee', $1, 'Bunn ITCB-DV', 'ITCB075996', 'itcb075996') returning id",
        [ITCB_CATALOG],
      )
    ).rows[0].id;
    const view = await readInspection(sql, id);
    const unit = view.machines.find((m) => !m.serial);
    const category = unit.items[0].category;
    await pg.query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2) on conflict do nothing", [id, imported]);
    await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status, notes) values ($1, $2, $3, 'Not inspected', 'Ask the manager')", [
      id,
      imported,
      category,
    ]);
    await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status, notes) values ($1, $2, $3, 'Pass', '20A outlet')", [
      id,
      unit.equipmentId,
      category,
    ]);

    await mergeEquipmentUnits(sql, imported, unit.equipmentId);
    const rows = (await pg.query("select equipment_id, status, notes from install_inspection_items where install_id = $1 and category = $2", [id, category])).rows;
    assert.deepEqual(rows, [{ equipment_id: imported, status: "Pass", notes: "Ask the manager / 20A outlet" }]);
  } finally {
    await pg.close();
  }
});

test("Merge puts the kept serial on the install in place of the dropped one", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = (
      await pg.query("insert into installs (customer, equipment, machines) values ('Cheeks Coffee', 'Bunn ITCB', $1) returning id", [
        JSON.stringify([{ equipment: "Bunn ITCB", serial: "L", powerVoltage: "" }]),
      ])
    ).rows[0].id;
    const imported = (
      await pg.query(
        "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Cheeks Coffee', $1, 'Bunn ITCB-DV', 'ITCB075996', 'itcb075996') returning id",
        [ITCB_CATALOG],
      )
    ).rows[0].id;
    const [short] = (await readInspection(sql, id)).machines;
    assert.equal(short.serial, "L");
    await mergeEquipmentUnits(sql, imported, short.equipmentId);
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => [m.equipmentId, m.serial]), [[imported, "ITCB075996"]]);
    const machines = parseMachinesJson((await pg.query("select machines from installs where id = $1", [id])).rows[0].machines);
    assert.deepEqual(machines.map((m) => m.serial), ["ITCB075996"]);
  } finally {
    await pg.close();
  }
});

test("Merge keeps the dropped unit's note on a visit both units are on", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Two Bunn Cafe", "Bunn ITCB\nBunn ITCB");
    const view = await readInspection(sql, id);
    const [keep, drop] = view.machines.map((m) => m.equipmentId);
    await pg.query("update install_inspection_units set note = 'Back counter', visit_kind = 'existing' where install_id = $1 and equipment_id = $2", [
      id,
      drop,
    ]);
    await mergeEquipmentUnits(sql, keep, drop);
    const link = (await pg.query("select note, visit_kind from install_inspection_units where install_id = $1 and equipment_id = $2", [id, keep])).rows;
    assert.deepEqual(link, [{ note: "Back counter", visit_kind: "existing" }]);
  } finally {
    await pg.close();
  }
});

async function eversys(pg, serial, moduleId) {
  const id = (
    await pg.query(
      "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Bean Bar', 'Eversys e''4s', 'Eversys e''4s', $1, lower($1)) returning id",
      [serial],
    )
  ).rows[0].id;
  if (moduleId) {
    await pg.query(
      "insert into modules (module_id, status, assigned_customer, assigned_unit_id) values ($1, 'Installed at Account', 'Bean Bar', $2)",
      [moduleId, id],
    );
  }
  return id;
}

test("Merge moves an Eversys module onto the kept unit", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await eversys(pg, "0110710025266E0006");
    const drop = await eversys(pg, "L", "M-1");
    await mergeEquipmentUnits(sql, keep, drop);
    assert.equal((await pg.query("select assigned_unit_id from modules where module_id = 'M-1'")).rows[0].assigned_unit_id, keep);
  } finally {
    await pg.close();
  }
});

test("Remove refuses a unit that still has an Eversys module on it", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await eversys(pg, "0110710025266E0006", "M-1");
    await assert.rejects(() => removeEquipmentUnit(sql, id), /Eversys module M-1 is still on this unit/);
    assert.equal((await pg.query("select count(*)::int as n from account_equipment where id = $1", [id])).rows[0].n, 1);
  } finally {
    await pg.close();
  }
});

test("the printed request form lists a one-ITCB install once", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "La Michoacana #52", "Bunn ITCB 220V");
    const view = await readInspection(sql, id);
    assert.equal(view.machines.length, 1);
    const row = (await pg.query("select id, equipment, serial, power_voltage, machines from installs where id = $1", [id])).rows[0];
    const folded = await formMachines(sql, row, view);
    const rows = groupFormRows(folded.rows.map((r) => ({ model: r.equipment, serial: r.serial, notes: "", voltage: r.powerVoltage, plug: r.plug ?? "" })));
    assert.deepEqual(
      rows.map((r) => [r.qty, r.equipment, r.outlet]),
      [[1, "BUNN ITCB", "220V"]],
    );
  } finally {
    await pg.close();
  }
});

test("two machines of one model told apart by voltage keep their own voltage when one gets a check", async () => {
  for (const [first, added] of [["Bunn TB3", "Bunn TB3"], ["Eversys Cameo c'2s", "Eversys Cameo c'2s - 2 Step Classic"]]) {
    const { pg, sql } = await fresh();
    try {
      await pg.query("insert into directory_equipment (name) values ('Eversys Cameo c''2s - 2 Step Classic')");
      const id = (
        await pg.query("insert into installs (customer, equipment, machines) values ('Volt Cafe', $1, $2) returning id", [
          first,
          JSON.stringify([{ equipment: first, serial: "", powerVoltage: "220V" }]),
        ])
      ).rows[0].id;
      await readInspection(sql, id);
      const view = await addMachineOntoInstall(sql, { installId: id, model: added, serial: null, electrical: "120V" }, "t");
      const second = view.machines.at(-1).equipmentId;
      await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, 'water', 'Fail')", [id, second]);
      const after = await readInspection(sql, id);
      const volts = Object.fromEntries(after.machines.map((m) => [m.equipmentId, m.electrical]));
      assert.equal(volts[second], "120V", first);
      assert.equal(after.machines.find((m) => m.equipmentId === second)?.overall, "Failed", first);
    } finally {
      await pg.close();
    }
  }
});
