// Install type (10/23): New account or Update, picked on the install's Details tab, saved with the install, logged,
// and printed on the Equipment Request Form. Until one is picked, the form shows what the account's history suggests.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const api = await import("../src/lib/ops/api.ts");
const { installFormFor, accountTypeGuess } = await import("../src/lib/ops/install-form-api.ts");
const { syncInstallUnits } = await import("../src/lib/ops/inspection-api.ts");
const { INSTALL_TYPES, installTypeLabel, installTypeOf } = await import("../src/lib/ops/install-form.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into directory_equipment (name) values ('Bunn ITCB-DV'), ('Bunn G9-2T')");
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin'), ('u-tech', 'melinda', true, false, 'tech')");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}

const install = async (sql, customer, machines = ["Bunn ITCB-DV"]) =>
  (
    await sql.query("insert into installs (customer, equipment, machines) values ($1, $2, $3) returning id", [
      customer,
      machines.join("\n"),
      JSON.stringify(machines.map((m) => ({ equipment: m, serial: "", powerVoltage: "" }))),
    ])
  )[0].id;
const typeOf = async (sql, id) => (await sql.query("select install_type from installs where id = $1", [id]))[0].install_type;
const history = async (sql, id) =>
  (await sql.query("select detail from activity where entity_type = 'install' and entity_id = $1 order by id", [id])).map((r) => r.detail);

test("the two choices, and anything else reads as not picked", () => {
  assert.deepEqual(
    INSTALL_TYPES.map((t) => [t.value, t.label]),
    [
      ["new", "New account"],
      ["update", "Update"],
    ],
  );
  assert.equal(installTypeOf("new"), "new");
  assert.equal(installTypeOf("update"), "update");
  for (const raw of ["", null, undefined, "New", "replace", 1]) assert.equal(installTypeOf(raw), null);
  assert.equal(installTypeLabel("new"), "New account");
  assert.equal(installTypeLabel(null), "");
});

test("the database only takes new, update or nothing", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Alpha");
    assert.equal(await typeOf(sql, id), null);
    await assert.rejects(() => sql.query("update installs set install_type = 'replace' where id = $1", [id]), /installs_install_type_check/);
    await sql.query("update installs set install_type = 'update' where id = $1", [id]);
    assert.equal(await typeOf(sql, id), "update");
  } finally {
    await pg.close();
  }
});

test("the Details save stores the type, logs the change, keeps it when the field is left out, and clears it when blank", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Bravo");
    const saved = await api.updateInstallFor(sql, { id, installType: "new" }, { userId: "u-tech" });
    assert.equal(saved.installType, "new");
    assert.equal(await typeOf(sql, id), "new");
    assert.ok((await history(sql, id)).includes("install type: New account"));

    // Another save from the window that doesn't send the field (a Tech Request Form tick, a WO) leaves it alone.
    await api.updateInstallFor(sql, { id, notes: "Back door" }, { userId: "u-tech" });
    assert.equal(await typeOf(sql, id), "new");

    // The same value again writes no new history line.
    const lines = (await history(sql, id)).length;
    await api.updateInstallFor(sql, { id, installType: "new", notes: "Back door" }, { userId: "u-tech" });
    assert.equal((await history(sql, id)).length, lines);

    await api.updateInstallFor(sql, { id, installType: "update" }, { userId: "u-tech" });
    assert.equal(await typeOf(sql, id), "update");
    assert.ok((await history(sql, id)).includes("install type: Update"));

    // The blank choice ("Not picked") clears it.
    const cleared = await api.updateInstallFor(sql, { id, installType: null }, { userId: "u-tech" });
    assert.equal(cleared.installType, null);
    assert.equal(await typeOf(sql, id), null);
    assert.ok((await history(sql, id)).includes("cleared install type"));
    await api.updateInstallFor(sql, { id, installType: "update" }, { userId: "u-tech" });
    await api.updateInstallFor(sql, { id, installType: "" }, { userId: "u-tech" });
    assert.equal(await typeOf(sql, id), null);
  } finally {
    await pg.close();
  }
});

test("a type that isn't New account or Update is refused before anything is saved", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Charlie");
    await assert.rejects(
      () => api.updateInstallFor(sql, { id, installType: "replace", trfIssued: true, notes: "x" }, { userId: "u-owner" }),
      /Install type is New account or Update\./,
    );
    const row = (await sql.query("select install_type, trf_issued, notes from installs where id = $1", [id]))[0];
    assert.deepEqual(row, { install_type: null, trf_issued: false, notes: null });
  } finally {
    await pg.close();
  }
});

test("the form shows the picked type; until then, what the account's history suggests", async () => {
  const { pg, sql } = await fresh();
  try {
    const first = await install(sql, "Cafe Delta", ["Bunn ITCB-DV", "Bunn G9-2T"]);
    // This visit's own units are on the account, and still don't make it an update.
    await syncInstallUnits(sql, first);
    assert.ok((await sql.query("select count(*)::int as n from account_equipment where customer = 'Cafe Delta'"))[0].n >= 2);
    assert.equal(await accountTypeGuess(sql, first), "new");
    assert.equal((await installFormFor(sql, first)).accountType, "new");

    // Picked: the form follows the pick, whatever the history says.
    await api.updateInstallFor(sql, { id: first, installType: "update" }, { userId: "u-tech" });
    assert.equal((await installFormFor(sql, first)).accountType, "update");
    await api.updateInstallFor(sql, { id: first, installType: null }, { userId: "u-tech" });
    assert.equal((await installFormFor(sql, first)).accountType, "new");

    // Another install for the account (any case) makes the guess an update; a pick of New account still wins.
    const second = await install(sql, "CAFE DELTA");
    assert.equal(await accountTypeGuess(sql, second), "update");
    assert.equal((await installFormFor(sql, second)).accountType, "update");
    await api.updateInstallFor(sql, { id: second, installType: "new" }, { userId: "u-tech" });
    assert.equal((await installFormFor(sql, second)).accountType, "new");

    // Equipment already on the account (not this visit's) makes it an update too.
    const third = await install(sql, "Cafe Echo");
    await sql.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Cafe Echo', 'Bunn G9-2T', 'Bunn G9-2T')");
    assert.equal(await accountTypeGuess(sql, third), "update");
  } finally {
    await pg.close();
  }
});
