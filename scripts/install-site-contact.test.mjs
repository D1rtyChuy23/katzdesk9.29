// Site contact and contact phone (10/23): typed on the install's Details tab, saved with the install, logged, printed
// on the Equipment Request Form, and kept when two installs are merged. Until a site contact is typed, the form shows
// the pre-inspection's, as before. Made-up names and numbers only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const api = await import("../src/lib/ops/api.ts");
const { installFormFor } = await import("../src/lib/ops/install-form-api.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
const { CONTACT_PHONE_MAX, SITE_CONTACT_MAX, contactText } = await import("../src/lib/ops/install-form.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into directory_equipment (name) values ('Bunn ITCB-DV'), ('Bunn G9-2T')");
  await pg.query(
    "insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin'), ('u-tech', 'melinda', true, false, 'tech')",
  );
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
const contactOf = async (sql, id) =>
  (await sql.query("select site_contact, contact_phone, install_type from installs where id = $1", [id]))[0];
const history = async (sql, id) =>
  (await sql.query("select detail from activity where entity_type = 'install' and entity_id = $1 order by id", [id])).map((r) => r.detail);
const as = { userId: "u-tech" };

test("typed text is tidied, and blank is nothing", () => {
  assert.equal(contactText("  Maria   Lopez \n"), "Maria Lopez");
  assert.equal(contactText(" (555) 010-0199 x 12 "), "(555) 010-0199 x 12");
  for (const raw of ["", "   ", null, undefined]) assert.equal(contactText(raw), null);
  assert.equal(SITE_CONTACT_MAX, 120);
  assert.equal(CONTACT_PHONE_MAX, 40);
});

test("a new install has neither until someone types them", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Alpha");
    assert.deepEqual(await contactOf(sql, id), { site_contact: null, contact_phone: null, install_type: null });
    const listed = (await api.updateInstallFor(sql, { id, notes: "Side door" }, as));
    assert.equal(listed.siteContact, null);
    assert.equal(listed.contactPhone, null);
  } finally {
    await pg.close();
  }
});

test("the Details save stores both, logs them, keeps them when left out, and clears them when blank", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Bravo");
    const saved = await api.updateInstallFor(sql, { id, siteContact: "  Maria   Lopez ", contactPhone: " (555) 010-0199 " }, as);
    assert.equal(saved.siteContact, "Maria Lopez");
    assert.equal(saved.contactPhone, "(555) 010-0199");
    assert.deepEqual(await contactOf(sql, id), { site_contact: "Maria Lopez", contact_phone: "(555) 010-0199", install_type: null });
    const lines = await history(sql, id);
    assert.ok(lines.some((l) => l.includes("site contact: Maria Lopez")), lines.join(" | "));
    assert.ok(lines.some((l) => l.includes("contact phone: (555) 010-0199")), lines.join(" | "));

    // A save that doesn't send them (a Tech Request Form tick, a WO, a machine field) leaves them alone.
    await api.updateInstallFor(sql, { id, notes: "Back door" }, as);
    assert.deepEqual(await contactOf(sql, id), { site_contact: "Maria Lopez", contact_phone: "(555) 010-0199", install_type: null });

    // The same values again write no new history line.
    const before = (await history(sql, id)).length;
    await api.updateInstallFor(sql, { id, siteContact: "Maria Lopez", contactPhone: "(555) 010-0199", notes: "Back door" }, as);
    assert.equal((await history(sql, id)).length, before);

    // Changing one changes only that one.
    await api.updateInstallFor(sql, { id, siteContact: "Joe Park", contactPhone: "(555) 010-0199" }, as);
    assert.deepEqual(await contactOf(sql, id), { site_contact: "Joe Park", contact_phone: "(555) 010-0199", install_type: null });

    // Blank clears them, and the history says so.
    const cleared = await api.updateInstallFor(sql, { id, siteContact: null, contactPhone: "  " }, as);
    assert.equal(cleared.siteContact, null);
    assert.equal(cleared.contactPhone, null);
    const after = (await history(sql, id)).join(" | ");
    assert.match(after, /cleared site contact/);
    assert.match(after, /cleared contact phone/);
  } finally {
    await pg.close();
  }
});

test("too long is refused before anything is saved; the longest allowed saves", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Charlie");
    await assert.rejects(
      () => api.updateInstallFor(sql, { id, siteContact: "x".repeat(SITE_CONTACT_MAX + 1), trfIssued: true, notes: "x" }, { userId: "u-owner" }),
      /The site contact is too long: 120 characters at most\./,
    );
    await assert.rejects(
      () => api.updateInstallFor(sql, { id, contactPhone: "5".repeat(CONTACT_PHONE_MAX + 1), notes: "x" }, as),
      /The contact phone is too long: 40 characters at most\./,
    );
    const row = (await sql.query("select site_contact, contact_phone, trf_issued, notes from installs where id = $1", [id]))[0];
    assert.deepEqual(row, { site_contact: null, contact_phone: null, trf_issued: false, notes: null });

    await api.updateInstallFor(sql, { id, siteContact: "y".repeat(SITE_CONTACT_MAX), contactPhone: "5".repeat(CONTACT_PHONE_MAX) }, as);
    const ok = await contactOf(sql, id);
    assert.equal(ok.site_contact.length, SITE_CONTACT_MAX);
    assert.equal(ok.contact_phone.length, CONTACT_PHONE_MAX);
  } finally {
    await pg.close();
  }
});

test("the form prints the install's contact and phone; until a contact is typed, the pre-inspection's", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Delta");
    let form = await installFormFor(sql, id);
    assert.deepEqual([form.siteContact, form.contactPhone], ["", ""]);

    // The inspector's site contact, as before this change.
    await sql.query("insert into install_inspections (install_id, inspector, site_contact) values ($1, 'Amanda', 'Braden')", [id]);
    form = await installFormFor(sql, id);
    assert.deepEqual([form.siteContact, form.contactPhone], ["Braden", ""]);

    // Typed on Details: the form follows it. The Pre-Inspection tab keeps its own.
    await api.updateInstallFor(sql, { id, siteContact: "Maria Lopez", contactPhone: "(555) 010-0199" }, as);
    form = await installFormFor(sql, id);
    assert.deepEqual([form.siteContact, form.contactPhone], ["Maria Lopez", "(555) 010-0199"]);
    assert.equal((await sql.query("select site_contact from install_inspections where install_id = $1", [id]))[0].site_contact, "Braden");

    // A phone with no contact typed: the pre-inspection's name, with the typed phone.
    await api.updateInstallFor(sql, { id, siteContact: "" }, as);
    form = await installFormFor(sql, id);
    assert.deepEqual([form.siteContact, form.contactPhone], ["Braden", "(555) 010-0199"]);

    await api.updateInstallFor(sql, { id, contactPhone: null }, as);
    form = await installFormFor(sql, id);
    assert.deepEqual([form.siteContact, form.contactPhone], ["Braden", ""]);
  } finally {
    await pg.close();
  }
});

test("merging two installs: the keeper keeps its own contact, phone and type; the drop fills the blanks", async () => {
  const { pg, sql } = await fresh();
  try {
    // The keeper has none: it takes all three from the drop.
    const keep = await install(sql, "Cafe Echo");
    const drop = await install(sql, "Cafe Echo", ["Bunn G9-2T"]);
    await api.updateInstallFor(sql, { id: drop, siteContact: "Maria Lopez", contactPhone: "(555) 010-0199", installType: "update" }, as);
    await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    assert.deepEqual(await contactOf(sql, keep), { site_contact: "Maria Lopez", contact_phone: "(555) 010-0199", install_type: "update" });

    // The keeper has a contact and a type: it keeps them, and takes only the phone it lacks.
    const keep2 = await install(sql, "Cafe Foxtrot");
    const drop2 = await install(sql, "Cafe Foxtrot", ["Bunn G9-2T"]);
    await api.updateInstallFor(sql, { id: keep2, siteContact: "Joe Park", installType: "new" }, as);
    await api.updateInstallFor(sql, { id: drop2, siteContact: "Maria Lopez", contactPhone: "(555) 010-0142", installType: "update" }, as);
    await mergeInstallsFor(sql, "u-owner", { keepId: keep2, dropId: drop2 });
    assert.deepEqual(await contactOf(sql, keep2), { site_contact: "Joe Park", contact_phone: "(555) 010-0142", install_type: "new" });
  } finally {
    await pg.close();
  }
});
