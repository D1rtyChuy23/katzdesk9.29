import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

register(new URL("./ts-alias-hook.mjs", import.meta.url));

// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { addMachineOntoInstall } = await import("../src/lib/ops/inspection-api.ts");
const { parseMachinesJson } = await import("../src/lib/ops/machines.ts");

async function applyMigrations(pg) {
  const dir = new URL("../migrations/", import.meta.url);
  const names = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  for (const name of names) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
}

function asSql(pg) {
  return {
    async query(text, params) {
      const res = await pg.query(text, params);
      return res.rows;
    },
  };
}

test("pre-inspection Add equipment saves the machine on the install, including a second unit with no serial", async () => {
  const pg = new PGlite();
  try {
    await applyMigrations(pg);
    const sql = asSql(pg);
    const installId = (
      await pg.query(
        `insert into installs (customer, equipment, equip_status, machines)
         values ($1, $2, 'Not Ready', $3) returning id`,
        ["Doug's Diner", "Bunn TB3", JSON.stringify([{ equipment: "Bunn TB3", serial: "", powerVoltage: "120v" }])],
      )
    ).rows[0].id;

    const added = await addMachineOntoInstall(
      sql,
      { installId, model: "Fetco MBS-1251 Combo Brewer Dual Voltage", serial: null, electrical: null },
      "Grokatron",
    );
    assert.equal(added.machineCount, 2);
    assert.equal(added.machines.some((m) => /fetco mbs-1251/i.test(m.name)), true);

    const stored = parseMachinesJson(
      (await pg.query("select machines from installs where id = $1", [installId])).rows[0].machines,
    );
    assert.equal(stored.length, 2);
    assert.equal(stored.some((m) => /fetco mbs-1251/i.test(m.equipment)), true);
    assert.equal(stored.some((m) => m.equipment === "Bunn TB3"), true);

    const rows = await pg.query(
      "select equipment_name from account_equipment where lower(customer) = lower($1) order by id",
      ["Doug's Diner"],
    );
    assert.equal(rows.rows.length, 2);

    const again = await addMachineOntoInstall(
      sql,
      { installId, model: "Bunn TB3", serial: "", electrical: "120v" },
      "Grokatron",
    );
    assert.equal(again.machineCount, 3);
    const after = parseMachinesJson(
      (await pg.query("select machines from installs where id = $1", [installId])).rows[0].machines,
    );
    assert.equal(after.filter((m) => m.equipment === "Bunn TB3").length, 2);
  } finally {
    await pg.close();
  }
});
