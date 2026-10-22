import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

register(new URL("./ts-alias-hook.mjs", import.meta.url));

// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { installFormFor } = await import("../src/lib/ops/install-form-api.ts");
const { readInspection } = await import("../src/lib/ops/inspection-api.ts");

const MAZZER = "Mazzer Super Jolly V Up Electronic";
const G9 = "Bunn G9-2T";
const ITCB = "Bunn ITCB-DV";

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_equipment (name) values ($1), ($2), ($3)", [MAZZER, G9, ITCB]);
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}

/** Install #135 as Chuy described it: three machines, a site contact, two work orders, recipes on two units. */
async function barByTheWayside(pg, sql) {
  const customer = "Bar By The Wayside";
  await pg.query("insert into directory_customers (name, address) values ($1, '5644 Navigation Blvd, Houston, TX 77011')", [customer]);
  const espresso = (
    await pg.query(
      "insert into recipes (equipment_model, customer, name, notes) values ($1, $2, 'Espresso', 'Grind setting: 18 grams') returning id",
      [MAZZER, customer],
    )
  ).rows[0].id;
  // A house recipe with no name: the G9's equipment row shows it as Standard.
  await pg.query("insert into recipes (equipment_model, customer, coffee_1, is_template) values ($1, null, 'Half pound batches', true)", [G9]);
  const machines = [
    { equipment: MAZZER, serial: "2626066", powerVoltage: "120V", plug: "5-15P", ownership: "Sold", recipeId: espresso },
    { equipment: G9, serial: "G900046833", powerVoltage: "120V", plug: "NEMA 5-15P", ownership: "Loaned" },
    { equipment: ITCB, serial: "ITCB138003", powerVoltage: "220V" },
  ];
  const id = (
    await pg.query(
      `insert into installs (customer, equipment, machines, install_date, wo, technician, account_rep)
       values ($1, $2, $3, '2026-10-20', 'WO-0859', 'Oliver Garcia', 'Amanda Logg') returning id`,
      [customer, machines.map((m) => m.equipment).join(", "), JSON.stringify(machines)],
    )
  ).rows[0].id;
  await pg.query("insert into install_work_orders (install_id, wo, match_key, source) values ($1, 'WO-0860', '860', 'desk')", [id]);
  const view = await readInspection(sql, id);
  const itcb = view.machines.find((m) => m.serial === "ITCB138003");
  assert.ok(itcb, "the ITCB is a pre-inspection unit");
  await pg.query("update install_inspection_units set note = 'Flip tray up for the pitcher' where install_id = $1 and equipment_id = $2", [id, itcb.equipmentId]);
  await pg.query(
    `insert into install_inspections (install_id, inspector, inspected_on, site_contact) values ($1, 'Amanda Logg', '2026-10-07', 'Braden')
     on conflict (install_id) do update set inspector = excluded.inspector, inspected_on = excluded.inspected_on, site_contact = excluded.site_contact`,
    [id],
  );
  return id;
}

test("the request form prints the site contact as a name, the dates as written, every WO, and each machine's terms, plug and recipe", async () => {
  const before = process.env.TZ;
  process.env.TZ = "America/Chicago";
  const { pg, sql } = await fresh();
  try {
    const id = await barByTheWayside(pg, sql);
    const form = await installFormFor(sql, id);
    assert.equal(form.customer, "Bar By The Wayside");
    assert.equal(form.address, "5644 Navigation Blvd, Houston, TX 77011");
    // The site contact used to print in the phone box.
    assert.equal(form.siteContact, "Braden");
    assert.equal(form.contactPhone, "");
    assert.equal(form.installDate, "Tue, Oct 20, 2026");
    assert.equal(form.inspectedOn, "Oct 7, 2026");
    assert.equal(form.completedOn, "");
    assert.equal(form.accountRep, "Amanda Logg");
    assert.equal(form.technician, "Oliver Garcia");
    assert.deepEqual(form.workOrders, ["WO-0859", "WO-0860"]);
    assert.deepEqual(
      form.rows.map((r) => ({ equipment: r.equipment, serials: r.serials, qty: r.qty, terms: r.terms, plugs: r.plugs, notes: r.notes })),
      [
        {
          equipment: MAZZER.toUpperCase(),
          serials: ["2626066"],
          qty: 1,
          terms: "Sold",
          plugs: ["5-15"],
          notes: [{ title: "Espresso", text: "Grind setting: 18 grams" }],
        },
        {
          equipment: G9.toUpperCase(),
          serials: ["G900046833"],
          qty: 1,
          terms: "Loan",
          plugs: ["5-15"],
          notes: [{ title: "Standard", text: "Coffee 1: Half pound batches" }],
        },
        {
          equipment: ITCB.toUpperCase(),
          serials: ["ITCB138003"],
          qty: 1,
          terms: "",
          plugs: [],
          notes: [{ title: "", text: "Flip tray up for the pitcher" }],
        },
      ],
    );
    const pre = Object.fromEntries(form.pre.map((p) => [p.label, p.notes]));
    assert.equal(pre["Account inspected by"], "Amanda Logg");
    // Two of the three machines are marked Sold or Loan.
    assert.equal(pre["Equipment sale/loan docs signed"], "PENDING");
    assert.equal(pre["Cleaning/Care sheets & recipe cards ready"], "YES");
    const corrigo = Object.fromEntries(form.corrigo.map((p) => [p.label, p.notes]));
    assert.equal(corrigo["Serial numbers logged"], "YES");
    assert.equal(corrigo["Install date added"], "YES");

    await pg.query("update installs set complete = true, completed_at = '2026-10-22' where id = $1", [id]);
    assert.equal((await installFormFor(sql, id)).completedOn, "Oct 22, 2026");
  } finally {
    await pg.close();
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test("an install with no work order, contact or date prints blanks, never Not set", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = (await pg.query("insert into installs (customer, equipment) values ('Quiet Cafe', $1) returning id", [ITCB])).rows[0].id;
    const form = await installFormFor(sql, id);
    assert.deepEqual(form.workOrders, []);
    assert.equal(form.siteContact, "");
    assert.equal(form.installDate, "");
    assert.equal(form.inspectedOn, "");
    assert.equal(form.rows.length, 1);
    assert.equal(form.rows[0].terms, "");
    assert.equal(form.rows[0].serials.length, 0);
    await assert.rejects(() => installFormFor(sql, id + 1000), /Install not found/);
  } finally {
    await pg.close();
  }
});
