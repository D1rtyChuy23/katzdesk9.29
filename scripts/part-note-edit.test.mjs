// A part's note, edited in its window on Parts (Grok's request through Chuy, 2026-10-29): Admin only, enforced on the
// server; it writes the note and the part's updated time, nothing else; and a line an import added while the box was
// open is never overwritten (the save is refused). Everyone else reads the note. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { cleanPartNote, PART_NOTE_MAX } = await import("../src/lib/ops/part-notes.ts");
const { listPartsFor, setPartNoteFor } = await import("../src/lib/ops/parts-api.ts");
const { importPartNotesFor } = await import("../src/lib/ops/part-notes-api.ts");

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
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async () => assert.fail("tagged query"), { query });
  return { pg, sql };
}

/** A made-up part with a photo, a bin, a class, an MPN and a description, so a change to any of them shows. */
async function part(pg, sku, note = null) {
  return (
    await pg.query(
      `insert into billing_items (sku, item, description, kind, item_class, mfr_part, note, bin_rack, bin_shelf, bin_bin, image, image_mime, image_updated_at)
       values ($1, $2, $3, 'part', 'Parts', $4, $5, 'A', '03', '12', '\\x89504e47'::bytea, 'image/png', now() - interval '2 days') returning id`,
      [sku, `PARTS : ${sku}`, `${sku} gasket`, `MPN-${sku}`, note],
    )
  ).rows[0].id;
}

const stored = async (pg, id) => (await pg.query("select note, updated_at from billing_items where id = $1", [id])).rows[0];
const rest = async (pg) => (await pg.query("select to_jsonb(b) - 'note' - 'updated_at' as r from billing_items b order by id")).rows.map((x) => x.r);
const csv = (text) => Buffer.from(`\uFEFF${text}`, "utf8").toString("base64");

test("the note as saved: line breaks kept, Windows ones made plain, spaces at line ends and blank lines at the edges dropped", () => {
  assert.equal(cleanPartNote("Merged OLD1\r\nFits Classe 5  \r\n\r\n"), "Merged OLD1\nFits Classe 5");
  assert.equal(cleanPartNote("\n\n  Indented line\n\nAfter a blank line\t\n"), "  Indented line\n\nAfter a blank line");
  assert.equal(cleanPartNote("   \n \r\n"), null);
  assert.equal(cleanPartNote(null), null);
  assert.equal(PART_NOTE_MAX, 10000);
});

test("an Admin saves the note: only the note and the updated time change", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1", "Merged OLD1");
    const b = await part(pg, "RANC2");
    const before = { rest: await rest(pg), a: await stored(pg, a) };
    const row = await setPartNoteFor(sql, { id: a, note: "Merged OLD1\r\nFits Classe 5 S/21, Classe 7 USB/21  \n\n", before: "Merged OLD1" }, "u-owner");
    assert.equal(row.note, "Merged OLD1\nFits Classe 5 S/21, Classe 7 USB/21");
    assert.equal(row.mergeNote, "Merged OLD1\nFits Classe 5 S/21, Classe 7 USB/21");
    const after = await stored(pg, a);
    assert.equal(after.note, "Merged OLD1\nFits Classe 5 S/21, Classe 7 USB/21");
    assert.ok(after.updated_at > before.a.updated_at, "the updated time moves");
    assert.deepEqual(await rest(pg), before.rest, "name, description, SKU, MPN, class, photo, bins and hidden are as they were, on every part");
    assert.equal((await stored(pg, b)).note, null);
    // The Admin role without the owner flag can save too; a note can be added where there was none.
    assert.equal((await setPartNoteFor(sql, { id: b, note: "Fits Classe 9", before: null }, "u-role")).note, "Fits Classe 9");
  } finally {
    await pg.close();
  }
});

test("Admin only: Sales and a tech get read only, and the server refuses their save", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1", "Merged OLD1");
    const flags = async (userId) => (await listPartsFor(sql, {}, userId)).canEditNote;
    assert.deepEqual([await flags("u-owner"), await flags("u-role"), await flags("u-sales"), await flags("u-tech")], [true, true, false, false]);
    for (const userId of ["u-sales", "u-tech", "u-nobody"]) {
      await assert.rejects(() => setPartNoteFor(sql, { id: a, note: "Overwritten", before: "Merged OLD1" }, userId), /^Error: Only an Admin can change a part's note\.$/, userId);
    }
    assert.equal((await stored(pg, a)).note, "Merged OLD1");
    const listed = (await listPartsFor(sql, {}, "u-tech")).rows.find((r) => r.id === a);
    assert.equal(listed.mergeNote, "Merged OLD1", "everyone still reads it");
  } finally {
    await pg.close();
  }
});

test("a blank box clears the note; saving the same text writes nothing", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1", "Kept as is\n");
    const b = await part(pg, "RANC2", "Old line");
    const was = await stored(pg, a);
    // The box starts from the note as shown; sent back unchanged, nothing is written (not even the updated time).
    const same = await setPartNoteFor(sql, { id: a, note: "Kept as is", before: "Kept as is\n" }, "u-owner");
    assert.equal(same.note, "Kept as is\n");
    assert.deepEqual(await stored(pg, a), was);
    const cleared = await setPartNoteFor(sql, { id: b, note: "  \n ", before: "Old line" }, "u-owner");
    assert.deepEqual([cleared.note, cleared.mergeNote, (await stored(pg, b)).note], [null, null, null]);
  } finally {
    await pg.close();
  }
});

test("a line an import added while the box was open is never overwritten: the save is refused, then works from the new note", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1", "Merged OLD1");
    // The Admin opens the box: it starts from "Merged OLD1". Meanwhile Import Part Notes adds a line.
    const opened = "Merged OLD1";
    const file = csv("sku,note\r\nRANC1,\"Fits Rancilio: Classe 5 S/21, Classe 7 USB/21 (source: made-up test, 10/29/26)\"\r\n");
    const preview = await importPartNotesFor(sql, { filename: "notes.csv", base64: file, apply: false }, "u-owner");
    const expect = preview.lines.filter((l) => l.status === "add").map((l) => ({ line: l.line, partId: l.part.id }));
    await importPartNotesFor(sql, { filename: "notes.csv", base64: file, apply: true, expect }, "u-owner");
    const withImport = "Merged OLD1\nFits Rancilio: Classe 5 S/21, Classe 7 USB/21 (source: made-up test, 10/29/26)";
    assert.equal((await stored(pg, a)).note, withImport);

    await assert.rejects(
      () => setPartNoteFor(sql, { id: a, note: "Merged OLD1\nTyped by hand", before: opened }, "u-owner"),
      /^Error: The note changed while you were editing it \(an import may have added a line\), so nothing was saved\./,
    );
    assert.equal((await stored(pg, a)).note, withImport, "the imported line stays");
    // Edited again from the note as it is now: saved.
    const row = await setPartNoteFor(sql, { id: a, note: `${withImport}\nTyped by hand`, before: withImport }, "u-owner");
    assert.equal(row.note, `${withImport}\nTyped by hand`);
  } finally {
    await pg.close();
  }
});

test("a part that's gone, trip and labor, and a note over 10,000 characters are refused", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1");
    const trip = (await pg.query("select id from billing_items where sku = 'TRIPCHARGE'")).rows[0].id;
    await assert.rejects(() => setPartNoteFor(sql, { id: 99999, note: "x", before: null }, "u-owner"), /^Error: That part is no longer on the list\.$/);
    await assert.rejects(() => setPartNoteFor(sql, { id: trip, note: "x", before: null }, "u-owner"), /^Error: That part is no longer on the list\.$/);
    await assert.rejects(() => setPartNoteFor(sql, { id: a, note: "y".repeat(10001), before: null }, "u-owner"), /^Error: A note can be up to 10,000 characters\.$/);
    assert.equal((await setPartNoteFor(sql, { id: a, note: "y".repeat(10000), before: null }, "u-owner")).note.length, 10000);
    assert.equal((await stored(pg, trip)).note, null);
  } finally {
    await pg.close();
  }
});

test("the part window offers Edit Note to an Admin only, and the save sends the note the box opened with", () => {
  const page = readFileSync(new URL("../src/routes/_app/parts.tsx", import.meta.url), "utf8");
  assert.match(page, /canEditNote=\{!!page\.data\?\.canEditNote\}/);
  const win = readFileSync(new URL("../src/components/desk/part-window.tsx", import.meta.url), "utf8");
  assert.match(win, /\{canEditNote \? \(\s*<div className="-my-1 -ml-3">\s*<PartNoteEditButton row=\{row\} edit=\{note\} tid=\{T\} \/>/);
  assert.match(win, /\{canEditNote \? <PartNoteForm row=\{row\} edit=\{note\} tid=\{T\} className="mt-3" \/> : null\}/);
  assert.match(win, /canEditNote = false,/, "read only unless the page says the person is an Admin");
  const edits = readFileSync(new URL("../src/components/desk/part-edits.ts", import.meta.url), "utf8");
  assert.match(edits, /setPartNote\(\{ data: \{ id: row\.id, note: value, before: start \} \}\)/);
  assert.match(edits, /setStart\(row\.note\);/, "the note exactly as stored when the box opened");
  const api = readFileSync(new URL("../src/lib/ops/parts-api.ts", import.meta.url), "utf8");
  const body = api.slice(api.indexOf("export async function setPartNoteFor"));
  assert.ok(body.indexOf("canEditNote") < body.indexOf("update billing_items"), "the Admin is checked before the write");
  assert.match(body, /update billing_items set note = \$2, updated_at = now\(\)\s+where id = \$1 and kind not in \('trip', 'labor'\) and note is not distinct from \$3/);
  assert.match(api, /export const setPartNote = createServerFn\(\{ method: "POST" \}\)\s+\.middleware\(\[deskMiddleware\]\)/);
});
