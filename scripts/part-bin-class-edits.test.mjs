// Changing a part's bin location and Class on Parts (Chuy, 10/28): Admin only for now. One part on its row or in its
// window, several picked parts at once (Move Bin, Set Class), the Bin Locations file, and the Parts search finding a
// part by its bin. Sales keeps the MPN, the part name and Hide. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { listPartsFor, movePartBinsFor, setPartBinFor, setPartClassFor, setPartsClassFor } = await import("../src/lib/ops/parts-api.ts");
const { importPartBinsFor } = await import("../src/lib/ops/part-pricing-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'),
       ('u-role', 'ana', true, false, 'admin'),
       ('u-sales', 'sam', true, false, 'sales'),
       ('u-tech', 'melinda', true, false, 'service')`,
  );
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}

/** A part on the Parts list; `bins` is [rack, shelf, bin]. */
async function part(sql, sku, { mpn = null, bins = [null, null, null], cls = "Parts", kind = "part", description = `${sku} part` } = {}) {
  const [rack, shelf, bin] = bins;
  return (
    await sql.query(
      `insert into billing_items (sku, item, description, kind, item_class, mfr_part, bin_rack, bin_shelf, bin_bin)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [sku, `PARTS : ${sku}`, description, kind, cls, mpn, rack, shelf, bin],
    )
  )[0].id;
}

async function stored(sql, id) {
  const r = (await sql.query("select bin_rack, bin_shelf, bin_bin, bin_updated_by, bin_updated_at, item_class from billing_items where id = $1", [id]))[0];
  return { bins: [r.bin_rack, r.bin_shelf, r.bin_bin], by: r.bin_updated_by, at: r.bin_updated_at, cls: r.item_class };
}

const csv = (text) => Buffer.from(text, "utf8").toString("base64");

test("the bin and the Class are Admin only; Sales still edits the MPN and the part name and hides", async () => {
  const { sql } = await fresh();
  const id = await part(sql, "GASKET1", { mpn: "GSK-1", bins: ["A", "3", "12"] });
  const flags = async (userId) => {
    const p = await listPartsFor(sql, {}, userId);
    return { bins: p.canEditBins, cls: p.canEditClass, mpn: p.canEditMpn, hide: p.canHide };
  };
  assert.deepEqual(await flags("u-owner"), { bins: true, cls: true, mpn: true, hide: true });
  assert.deepEqual(await flags("u-role"), { bins: true, cls: true, mpn: true, hide: true }, "the Admin role without the owner flag");
  assert.deepEqual(await flags("u-sales"), { bins: false, cls: false, mpn: true, hide: true });
  assert.deepEqual(await flags("u-tech"), { bins: false, cls: false, mpn: false, hide: false });

  for (const user of ["u-sales", "u-tech"]) {
    await assert.rejects(() => setPartBinFor(sql, { id, rack: "B", shelf: "1", bin: "1" }, user), /^Error: Only an Admin can change a part's bin location\.$/);
    await assert.rejects(() => movePartBinsFor(sql, { ids: [id], rack: "B" }, user), /^Error: Only an Admin can change bin locations\.$/);
    await assert.rejects(() => setPartClassFor(sql, { id, itemClass: "Service" }, user), /^Error: Only an Admin can change a part's class\.$/);
    await assert.rejects(() => setPartsClassFor(sql, { ids: [id], itemClass: "Service" }, user), /^Error: Only an Admin can change a part's class\.$/);
    await assert.rejects(
      () => importPartBinsFor(sql, { filename: "bins.csv", base64: csv("MPN,Rack,Shelf,Bin\r\nGSK-1,C,2,9\r\n"), apply: true }, user),
      /^Error: Only an Admin can change bin locations\.$/,
    );
  }
  assert.deepEqual(await stored(sql, id), { bins: ["A", "3", "12"], by: null, at: null, cls: "Parts" }, "nothing changed");
});

test("one part: Set Bin and Move Bin write all three pieces, a blank box clears one, and who changed it is kept only on a change", async () => {
  const { sql } = await fresh();
  const id = await part(sql, "GASKET1");
  const set = await setPartBinFor(sql, { id, rack: " B ", shelf: "2", bin: "4" }, "u-owner");
  assert.deepEqual([set.binRack, set.binShelf, set.binBin, set.binUpdatedBy], ["B", "2", "4", "chuy"]);
  const first = (await stored(sql, id)).at;
  // Saving the same place again (another Admin): nothing changes, so chuy stays as the last to change it.
  await setPartBinFor(sql, { id, rack: "B", shelf: "2", bin: "4" }, "u-role");
  assert.deepEqual(await stored(sql, id), { bins: ["B", "2", "4"], by: "chuy", at: first, cls: "Parts" });
  const moved = await setPartBinFor(sql, { id, rack: "C", shelf: "", bin: "Overflow" }, "u-role");
  assert.deepEqual([moved.binRack, moved.binShelf, moved.binBin, moved.binUpdatedBy], ["C", null, "Overflow", "ana"]);
  await assert.rejects(() => setPartBinFor(sql, { id, rack: "x".repeat(41), shelf: null, bin: null }, "u-owner"), /Rack can be up to 40 characters/);
  await assert.rejects(() => setPartBinFor(sql, { id: 99999, rack: "A", shelf: null, bin: null }, "u-owner"), /no longer on the list/);
});

test("Move Bin for picked parts: a piece typed goes on every part, a blank keeps each part's own, and parts already there are left alone", async () => {
  const { sql } = await fresh();
  const a12 = await part(sql, "GASKET1", { bins: ["A", "3", "12"] });
  const a7 = await part(sql, "ORING7", { bins: ["A", "3", "7"] });
  const none = await part(sql, "SCREW2");
  const there = await part(sql, "VALVE5", { bins: ["B", "3", "5"] });
  const trip = await part(sql, "TRIP", { kind: "trip" });
  await sql.query("update billing_items set bin_updated_by = 'oliver', bin_updated_at = '2026-10-01' where id = $1", [there]);

  // A Rack alone moves the whole shelf to rack B: each part keeps its shelf and bin. Trip is not a part; 99999 is gone.
  const r = await movePartBinsFor(sql, { ids: [a12, a7, none, there, trip, 99999, a12], rack: " B " }, "u-owner");
  assert.deepEqual(r, { moved: 3, same: 1, missing: 2 });
  assert.deepEqual((await stored(sql, a12)).bins, ["B", "3", "12"]);
  assert.deepEqual((await stored(sql, a7)).bins, ["B", "3", "7"]);
  assert.deepEqual((await stored(sql, none)).bins, ["B", null, null]);
  const kept = await stored(sql, there);
  assert.deepEqual([kept.bins, kept.by], [["B", "3", "5"], "oliver"], "already there: who changed it last stays");
  assert.equal((await stored(sql, a12)).by, "chuy");
  assert.deepEqual((await stored(sql, trip)).bins, [null, null, null]);

  // All three typed: every picked part goes to the same place.
  assert.deepEqual(await movePartBinsFor(sql, { ids: [a12, none], rack: "C", shelf: "1", bin: "4" }, "u-role"), { moved: 2, same: 0, missing: 0 });
  assert.deepEqual([(await stored(sql, a12)).bins, (await stored(sql, none)).bins], [["C", "1", "4"], ["C", "1", "4"]]);

  await assert.rejects(() => movePartBinsFor(sql, { ids: [a12], rack: " ", shelf: null }, "u-owner"), /^Error: Type the Rack, Shelf or Bin these parts move to\.$/);
  await assert.rejects(() => movePartBinsFor(sql, { ids: [a12], bin: "y".repeat(41) }, "u-owner"), /Bin can be up to 40 characters/);
  await assert.rejects(() => movePartBinsFor(sql, { ids: [99998, trip], rack: "D" }, "u-owner"), /^Error: Those parts are no longer on the list\.$/);
});

test("Class: one part or several, only the five classes; the class filter and counts follow", async () => {
  const { sql } = await fresh();
  const one = await part(sql, "FILTER1");
  const two = await part(sql, "FILTER2", { cls: "Service" });
  const three = await part(sql, "FILTER3", { cls: null });
  const set = await setPartClassFor(sql, { id: one, itemClass: "Water Filters" }, "u-owner");
  assert.equal(set.itemClass, "Water Filters");
  await assert.rejects(() => setPartClassFor(sql, { id: one, itemClass: "Catering" }, "u-owner"), /The class must be one of Parts, Water Filters, Service, Equipment, Dispensers\./);
  assert.equal((await setPartClassFor(sql, { id: one, itemClass: " " }, "u-owner")).itemClass, null, "a blank clears it");

  assert.deepEqual(await setPartsClassFor(sql, { ids: [one, two, three, 99999], itemClass: "Service" }, "u-role"), { changed: 2, same: 1, missing: 1 });
  const service = await listPartsFor(sql, { itemClass: "Service" }, "u-owner");
  assert.deepEqual(service.rows.map((r) => r.sku).sort(), ["FILTER1", "FILTER2", "FILTER3"]);
  assert.equal(service.classCounts.Service, 3);
  await assert.rejects(() => setPartsClassFor(sql, { ids: [one], itemClass: "Other" }, "u-owner"), /must be one of/);
});

test("the Parts search finds a part by its bin: A-03-12, A 03 12, A/03/12, Rack A, Shelf 03, Bin 12", async () => {
  const { sql } = await fresh();
  await part(sql, "GASKET1", { bins: ["A", "03", "12"] });
  await part(sql, "ORING7", { bins: ["A", "03", "7"] });
  await part(sql, "SCREW2", { bins: ["B", "1", "12"] });
  await part(sql, "VALVE5");
  const find = async (q) => (await listPartsFor(sql, { q }, "u-tech")).rows.map((r) => r.sku).sort();
  assert.deepEqual(await find("A-03-12"), ["GASKET1"]);
  assert.deepEqual(await find("a 03 12"), ["GASKET1"]);
  assert.deepEqual(await find("A/03/12"), ["GASKET1"]);
  assert.deepEqual(await find("A-03"), ["GASKET1", "ORING7"]);
  assert.deepEqual(await find("Rack A"), ["GASKET1", "ORING7"]);
  assert.deepEqual(await find("shelf 1"), ["SCREW2"]);
  assert.deepEqual(await find("Bin 12"), ["GASKET1", "SCREW2"]);
  assert.deepEqual(await find("VALVE"), ["VALVE5"], "the part number search is unchanged");
  assert.equal((await listPartsFor(sql, { q: "Rack A" }, "u-tech")).total, 2, "the count matches");
});

test("the Bin Locations file: an Admin's preview and Save still work", async () => {
  const { sql } = await fresh();
  const id = await part(sql, "GASKET1", { mpn: "GSK-1", bins: ["A", "3", "12"] });
  const file = { filename: "bins.csv", base64: csv("MPN,Rack,Shelf,Bin\r\nGSK-1,C,2,9\r\n") };
  const preview = await importPartBinsFor(sql, { ...file, apply: false }, "u-role");
  assert.deepEqual([preview.update, preview.applied], [1, false]);
  assert.deepEqual((await stored(sql, id)).bins, ["A", "3", "12"], "the preview writes nothing");
  const saved = await importPartBinsFor(sql, { ...file, apply: true }, "u-owner");
  assert.deepEqual([saved.update, saved.applied], [1, true]);
  assert.deepEqual(await stored(sql, id).then((s) => [s.bins, s.by]), [["C", "2", "9"], "chuy"]);
});
