import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// api.ts imports folders (runbooks/) and JSON: the fuller hook resolves those.
await register("./node-resolve-hook.mjs", import.meta.url);

// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { readInspection, removeInspectionUnit, removeInstallRow, syncInstallUnits } = await import("../src/lib/ops/inspection-api.ts");
const { mergeEquipmentUnits, removeEquipmentUnit } = await import("../src/lib/ops/account-equip-import.ts");
const { matchExistingUnit } = await import("../src/lib/ops/account-equip.ts");
const { canLockEquipment, setLock } = await import("../src/lib/ops/equipment-lock.ts");
const { lockedMessage } = await import("../src/lib/ops/equipment-lock-rules.ts");
const { placeMove } = await import("../src/lib/ops/unit-place-rules.ts");
const api = await import("../src/lib/ops/api.ts");
const { keepTies, lockConfirmed } = await import("../src/lib/ops/deal-board.ts");
const machines = await import("../src/lib/ops/machines.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh({ upTo } = {}) {
  const pg = new PGlite();
  for (const name of files) {
    if (upTo && name >= upTo) break;
    await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  }
  if (!upTo) await pg.query("insert into directory_equipment (name) values ('Bunn TB3'), ('Fetco 52H')");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  // api.ts writes tagged templates; the rest of the app calls sql.query.
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}

/** Chuy (the owner, an approved admin) and a teammate. */
async function people(pg) {
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin) values ('u-owner', 'chuy', true, true), ('u-tech', 'melinda', true, false)`,
  );
}

const install = async (pg, customer, equipment) =>
  (await pg.query("insert into installs (customer, equipment) values ($1, $2) returning id", [customer, equipment])).rows[0].id;
const unitsOf = async (pg, customer) =>
  (await pg.query("select id, equipment_name, serial, locked_at, locked_by from account_equipment where lower(customer) = lower($1) order by id", [customer])).rows;
const lockUnit = (pg, id, by = "chuy") => pg.query("update account_equipment set locked_at = now(), locked_by = $2 where id = $1", [id, by]);

test("the migration carries today's lock over: assigned and sold assets are stamped, ready ones are not", async () => {
  const { pg } = await fresh({ upTo: "0091" });
  try {
    for (const status of ["assigned", "sold", "ready"]) {
      await pg.query("insert into assets (kind, model, qty, site, status) values ('equip', $1, 1, 'field', $2)", [`M-${status}`, status]);
    }
    await pg.exec(readFileSync(new URL("0091_equipment_lock.sql", MIGRATIONS), "utf8"));
    const rows = (await pg.query("select status, locked_at is not null as locked, locked_by from assets order by id")).rows;
    assert.deepEqual(rows, [
      { status: "assigned", locked: true, locked_by: "System (assigned or sold)" },
      { status: "sold", locked: true, locked_by: "System (assigned or sold)" },
      { status: "ready", locked: false, locked_by: null },
    ]);
    const cols = (await pg.query("select column_name from information_schema.columns where table_name = 'account_equipment' and column_name like 'locked_%' order by 1")).rows;
    assert.deepEqual(cols.map((c) => c.column_name), ["locked_at", "locked_by"]);
  } finally {
    await pg.close();
  }
});

test("only the owner can lock or unlock; the change is stamped and logged", async () => {
  const { pg, sql } = await fresh();
  try {
    await people(pg);
    const id = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Cafe', 'Bunn TB3', 'Bunn TB3', 'TB-1', 'tb-1') returning id")).rows[0].id;
    assert.equal(await canLockEquipment(sql, "u-tech"), false);
    assert.equal(await canLockEquipment(sql, "u-owner"), true);
    await assert.rejects(() => setLock(sql, "u-tech", { kind: "unit", id, locked: true }), /Only the owner/);
    assert.equal((await unitsOf(pg, "Cafe"))[0].locked_at, null);
    const on = await setLock(sql, "u-owner", { kind: "unit", id, locked: true });
    assert.equal(on.lockedBy, "chuy");
    assert.ok(on.lockedAt);
    const off = await setLock(sql, "u-owner", { kind: "unit", id, locked: false });
    assert.deepEqual(off, { lockedAt: null, lockedBy: null });
    const log = (await pg.query("select action, actor_name from activity order by id")).rows;
    assert.deepEqual(log.map((l) => l.action), ["locked", "unlocked"]);
    assert.equal(log[0].actor_name, "chuy");
  } finally {
    await pg.close();
  }
});

test("a locked unit survives Remove, Merge, the prune and an import", async () => {
  const { pg, sql } = await fresh();
  try {
    await people(pg);
    const id = await install(pg, "Lock Cafe", "Bunn TB3\nFetco 52H");
    const view = await readInspection(sql, id);
    const tb3 = view.machines.find((m) => m.name === "Bunn TB3").equipmentId;
    const fetco = view.machines.find((m) => m.name === "Fetco 52H").equipmentId;
    await lockUnit(pg, tb3);
    const message = lockedMessage("chuy", "chuy");
    assert.equal(message, "Locked by chuy. Only chuy can unlock it.");
    await assert.rejects(() => removeEquipmentUnit(sql, tb3), { message });
    await assert.rejects(() => mergeEquipmentUnits(sql, fetco, tb3), { message });
    await assert.rejects(() => mergeEquipmentUnits(sql, tb3, fetco), { message });
    await assert.rejects(() => removeInspectionUnit(sql, { installId: id, equipmentId: tb3 }, "Test"), { message });
    await assert.rejects(() => removeInstallRow(sql, { installId: id, index: 0, equipment: "Bunn TB3", serial: "" }, "Test"), { message });
    // The Equipment tab saves a list without it: the prune leaves it on the visit and the account.
    await pg.query("update installs set equipment = 'Fetco 52H', machines = $2 where id = $1", [id, JSON.stringify([{ equipment: "Fetco 52H", serial: "", powerVoltage: "" }])]);
    await syncInstallUnits(sql, id, { prune: true });
    assert.ok((await readInspection(sql, id)).machines.some((m) => m.equipmentId === tb3));
    assert.ok((await unitsOf(pg, "Lock Cafe")).some((u) => u.id === tb3));
    // A load never rewrites it: a serial typed on its row is not written to the locked unit.
    await pg.query("update installs set equipment = 'Bunn TB3', machines = $2 where id = $1", [id, JSON.stringify([{ equipment: "Bunn TB3", serial: "TB-NEW", powerVoltage: "" }])]);
    await syncInstallUnits(sql, id, { prune: true });
    assert.equal((await unitsOf(pg, "Lock Cafe")).find((u) => u.id === tb3).serial, null);
    // An import never fills a locked blank unit, and the importer skips a locked match.
    const existing = [{ id: tb3, customer: "Lock Cafe", catalogModel: "Bunn TB3", equipmentName: "Bunn TB3", serial: null, serialKey: null, lockedBy: "chuy" }];
    assert.equal(matchExistingUnit({ customer: "Lock Cafe", catalogModel: "Bunn TB3", equipmentName: "TB3", serial: "TB-9", existing }).action, "add");
    const importer = readFileSync(new URL("../src/lib/ops/account-equip-import.ts", import.meta.url), "utf8");
    assert.match(importer, /if \(unit\.foreignAccount \|\| existing\.find\(\(e\) => e\.id === unit\.existingId\)\?\.lockedBy\) \{\s*skipped \+= 1;/);
    assert.match(importer, /lockedBy: r\.locked_at \? r\.locked_by \|\| "the owner" : null/);
  } finally {
    await pg.close();
  }
});

test("an unlocked unit can be removed again once the owner unlocks it", async () => {
  const { pg, sql } = await fresh();
  try {
    await people(pg);
    const id = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Free Cafe', 'Bunn TB3', 'Bunn TB3') returning id")).rows[0].id;
    await setLock(sql, "u-owner", { kind: "unit", id, locked: true });
    await assert.rejects(() => removeEquipmentUnit(sql, id), /Locked by chuy/);
    await setLock(sql, "u-owner", { kind: "unit", id, locked: false });
    await removeEquipmentUnit(sql, id);
    assert.equal((await unitsOf(pg, "Free Cafe")).length, 0);
  } finally {
    await pg.close();
  }
});

test("assigning an asset stamps the lock, returning it to the barn clears it, and a locked asset can't move", async () => {
  const { pg, sql } = await fresh();
  try {
    await people(pg);
    const asset = (await pg.query("insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status) values ('equip', 'Bunn TB3', 'TB-77', 1, 'barn-back', 'A', 1, 1, 'ready') returning id")).rows[0].id;
    const id = await install(pg, "Pull Cafe", "Bunn TB3");
    const ctx = { userId: "u-tech" };
    const assigned = await api.assignAssetToInstallFor(sql, { assetId: asset, installId: id }, ctx);
    assert.equal(assigned.status, "assigned");
    assert.equal(assigned.lockedBy, "System (assigned)");
    assert.ok(assigned.lockedAt);
    assert.equal(placeMove({ status: "assigned", locked_at: assigned.lockedAt }), "blocked");
    // An assignment's own lock comes off with the return.
    const back = await api.returnAssetToWarehouseFor(sql, { id: asset, site: "barn-back", pallet: "B", level: 1 }, ctx);
    assert.equal(back.status, "ready");
    assert.equal(back.lockedAt, null);
    assert.equal(back.lockedBy, null);
    assert.equal(placeMove({ status: "ready", locked_at: null }), "move");
    // A lock the owner put on keeps it on the rack: no assign, no sale.
    await setLock(sql, "u-owner", { kind: "asset", id: asset, locked: true });
    await assert.rejects(() => api.assignAssetToInstallFor(sql, { assetId: asset, installId: id }, ctx), /Locked by chuy/);
    await assert.rejects(() => api.markAssetSoldFor(sql, { id: asset, soldTo: "Pull Cafe" }, ctx), /Locked by chuy/);
  } finally {
    await pg.close();
  }
});

test("a sold asset stays put until the owner unlocks it; then Return works", async () => {
  const { pg, sql } = await fresh();
  try {
    await people(pg);
    const asset = (await pg.query("insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status) values ('equip', 'Fetco 52H', 'F-5', 1, 'barn-back', 'C', 1, 1, 'ready') returning id")).rows[0].id;
    const ctx = { userId: "u-tech" };
    const sold = await api.markAssetSoldFor(sql, { id: asset, soldTo: "Sold Cafe" }, ctx);
    assert.equal(sold.status, "sold");
    assert.equal(sold.lockedBy, "System (sold)");
    await assert.rejects(() => api.returnAssetToWarehouseFor(sql, { id: asset, site: "barn-back", pallet: "D", level: 1 }, ctx), /Locked by System \(sold\)\. Only chuy can unlock it\./);
    await assert.rejects(() => setLock(sql, "u-tech", { kind: "asset", id: asset, locked: false }), /Only the owner/);
    await setLock(sql, "u-owner", { kind: "asset", id: asset, locked: false });
    const back = await api.returnAssetToWarehouseFor(sql, { id: asset, site: "barn-back", pallet: "D", level: 1 }, ctx);
    assert.equal(back.status, "ready");
    assert.equal(back.soldTo, null);
  } finally {
    await pg.close();
  }
});

test("a confirmed deal machine the owner removes is not put back by the server", () => {
  const stored = [
    { equipment: "Bunn TB3", serial: "", powerVoltage: "", uid: "u1", confirmedAt: "2026-10-01" },
    { equipment: "Fetco 52H", serial: "", powerVoltage: "", uid: "u2", confirmedAt: "2026-10-01" },
  ];
  const onBoard = new Set(["u1", "u2"]);
  const incoming = [stored[1]];
  // Without a release the stored row comes back (anyone's window that leaves it out).
  assert.deepEqual(lockConfirmed(keepTies(incoming, stored), stored, onBoard).map((m) => m.uid), ["u2", "u1"]);
  // updateDeal with releaseUids (owner only): the tie is dropped before lockConfirmed runs.
  const release = new Set(["u1"]);
  const kept = stored.filter((m) => !m.uid || !release.has(m.uid));
  const held = new Set([...onBoard].filter((u) => !release.has(u)));
  assert.deepEqual(lockConfirmed(keepTies(incoming, kept), kept, held).map((m) => m.uid), ["u2"]);
  const src = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  assert.match(src, /if \(release\.size\) \{\s*const \{ canLockEquipment \} = await import\("\.\/equipment-lock"\);\s*if \(!\(await canLockEquipment\(sql, context\.userId\)\)\) throw/);
  assert.match(src, /lockConfirmed\(keepTies\(Array\.isArray\(data\.machines\) \? data\.machines : \[\], kept\), kept, onBoard\)/);
  assert.equal(machines.serializeMachines(kept).equipment, "Fetco 52H");
});

test("the lock shows on every equipment list, and only the owner sees Lock / Unlock or Remove on a confirmed deal row", () => {
  const read = (f) => readFileSync(new URL(`../src/components/desk/${f}`, import.meta.url), "utf8");
  const badge = read("lock-badge.tsx");
  // The button reads canLockEquipment from getMyAccess and renders nothing for anyone else.
  assert.match(read("use-can-lock.ts"), /return !!me\.data\?\.canLockEquipment;/);
  assert.match(badge, /if \(!canLock\) return null;/);
  assert.match(badge, /title=\{`Locked by \$\{lockedBy\}`\}/);
  const history = read("account-history.tsx");
  assert.match(history, /disabled=\{merge\.isPending \|\| !!row\.lockedBy \|\| !!twin\.lockedBy\}/);
  assert.match(history, /disabled=\{remove\.isPending \|\| !!row\.lockedBy\}/);
  assert.match(history, /<LockToggle kind="unit" id=\{row\.id\} locked=\{!!row\.lockedBy\} onDone=\{refresh\} \/>/);
  const pre = read("pre-inspection-panel.tsx");
  assert.match(pre, /disabled=\{m\.locked\}/);
  assert.match(pre, /<LockBadge lockedBy=\{m\.lockedBy\} \/>/);
  const place = read("unit-place-field.tsx");
  assert.match(place, /const by = lockedBy !== undefined \? lockedBy : lookup\.data\?\.found \? lookup\.data\.lockedBy : null;\s*if \(by\) \{/);
  const sheet = read("asset-sheet.tsx");
  assert.match(sheet, /<LockToggle kind="asset" id=\{asset\.id\} locked=\{!!asset\.lockedAt\}/);
  assert.match(sheet, /\) : asset\.status !== "sold" \|\| !asset\.lockedAt \? \(/);
  assert.match(sheet, /disabled=\{ret\.isPending \|\| held\}/);
  const deals = read("entity-sheets.tsx");
  assert.match(deals, /onRemoveLocked=\{\s*canLock\s*\?/);
  assert.match(deals, /save\.mutate\(\{ id: deal\.id, machines: next, \.\.\.\(release\?\.length \? \{ releaseUids: release \} : \{\}\) \}\)/);
  const rows = read("machine-fields.tsx");
  assert.match(rows, /\{onRemoveLocked \? \(\s*<button[\s\S]*?onClick=\{\(\) => onRemoveLocked\(index\)\}/);
});
