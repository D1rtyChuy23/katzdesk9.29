import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { addChat, approveChat, chatCards, loadTeamsChats, removeChat } = await import("../src/lib/ops/teams-reports.ts");
const { TEAMS_CHATS } = await import("../src/lib/ops/teams-message.ts");

const pg = new PGlite();
const dir = new URL("../migrations/", import.meta.url);
for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
// The live DB runs each migration once; running 0089 again must change nothing.
await pg.exec(readFileSync(new URL("0089_teams_chats.sql", dir), "utf8"));
const sql = { query: async (text, params) => (await pg.query(text, params)).rows };

await sql.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('admin', 'Chuy', true, true), ('rep', 'Sam', true, false)");

const sean = { name: "Sean's New Accounts", group: "Reps", kind: "group", about: "", feed: "rep", target: "Sean Marshall" };

test("the seed is today's chats, with Corey under Dispatch, and running it twice adds nothing", async () => {
  const chats = await loadTeamsChats(sql);
  assert.equal(chats.length, 18);
  assert.deepEqual(
    chats.map((c) => c.id),
    TEAMS_CHATS.map((c) => c.id),
  );
  assert.deepEqual(chats, TEAMS_CHATS);
  const corey = chats.find((c) => c.id === "dm-cory");
  assert.equal(corey.name, "Corey Russell");
  assert.equal(corey.group, "Dispatch");
  assert.equal(corey.feed, "dispatch");
});

test("only an admin can add or remove a chat", async () => {
  await assert.rejects(() => addChat(sql, "rep", sean), /^Error: Only an admin can add or remove a Teams chat\.$/);
  await assert.rejects(() => removeChat(sql, "rep", "big-tymers"), /^Error: Only an admin can add or remove a Teams chat\.$/);
  assert.equal((await loadTeamsChats(sql)).length, 18);
});

test("a chat that needs a person or region is refused without one", async () => {
  await assert.rejects(() => addChat(sql, "admin", { ...sean, target: "  " }), /^Error: Type the rep's name\.$/);
  await assert.rejects(() => addChat(sql, "admin", { ...sean, feed: "tech", target: "" }), /^Error: Type the tech's name\.$/);
  await assert.rejects(() => addChat(sql, "admin", { ...sean, feed: "region", target: "houston" }), /^Error: Pick DFW, SA\/ATX or Other\.$/);
  await assert.rejects(() => addChat(sql, "admin", { ...sean, feed: "weather" }), /^Error: Pick what the chat shows\.$/);
  await assert.rejects(() => addChat(sql, "admin", { ...sean, kind: "channel" }), /^Error: Pick group chat or DM\.$/);
  await assert.rejects(() => addChat(sql, "admin", { ...sean, name: " " }), /^Error: Give the chat a name\.$/);
  await assert.rejects(() => addChat(sql, "admin", { ...sean, group: "" }), /^Error: Pick a group for the chat\.$/);
  assert.equal((await loadTeamsChats(sql)).length, 18);
});

test("an added chat gets its own id, shows on the board, and can be approved", async () => {
  const added = await addChat(sql, "admin", sean);
  assert.equal(added.id, "seans-new-accounts");
  const again = await addChat(sql, "admin", sean);
  assert.equal(again.id, "seans-new-accounts-2");
  const region = await addChat(sql, "admin", { name: "Big Tymers", group: "Service", kind: "group", about: "", feed: "region", target: "sa-atx" });
  assert.equal(region.id, "big-tymers-2");
  const chats = await loadTeamsChats(sql);
  assert.equal(chats.length, 21);
  assert.deepEqual(chats.slice(-3).map((c) => c.id), ["seans-new-accounts", "seans-new-accounts-2", "big-tymers-2"]);
  const row = (await sql.query("select created_by, target, feed from teams_chats where id = $1", [added.id]))[0];
  assert.deepEqual(row, { created_by: "Chuy", target: "Sean Marshall", feed: "rep" });

  const card = (await chatCards(sql)).find((c) => c.id === added.id);
  assert.equal(card.name, "Sean's New Accounts");
  assert.equal(card.group, "Reps");
  assert.equal(card.text, "Open service calls on your accounts.\n\nCalls\nNone.");
  assert.equal(card.approved, false);
  await assert.rejects(() => approveChat(sql, "rep", added.id, card.text), /^Error: Only an admin can approve a Teams note\.$/);
  const ok = await approveChat(sql, "admin", added.id, card.text);
  assert.equal(ok.name, "Sean's New Accounts");
  assert.equal((await chatCards(sql)).find((c) => c.id === added.id).approved, true);
});

test("removing a chat keeps its approved notes, and a new chat never takes over a removed chat's id", async () => {
  const card = (await chatCards(sql)).find((c) => c.id === "rep-chelsea");
  await approveChat(sql, "admin", "rep-chelsea", card.text);
  const gone = await removeChat(sql, "admin", "rep-chelsea");
  assert.equal(gone.name, "Chelsea's Customers' Request");
  assert.equal((await loadTeamsChats(sql)).some((c) => c.id === "rep-chelsea"), false);
  assert.equal((await sql.query("select count(*)::int as n from teams_drafts where chat = 'rep-chelsea'"))[0].n, 1);
  await assert.rejects(() => approveChat(sql, "admin", "rep-chelsea", card.text), /^Error: That chat is not on the list\.$/);
  await assert.rejects(() => removeChat(sql, "admin", "rep-chelsea"), /^Error: That chat is not on the list\.$/);
  const back = await addChat(sql, "admin", { name: "Rep Chelsea", group: "Reps", kind: "group", about: "", feed: "rep", target: "Chelsea" });
  assert.equal(back.id, "rep-chelsea-2");
  assert.equal((await chatCards(sql)).find((c) => c.id === back.id).approved, false);
});

test("the last chat cannot be removed", async () => {
  for (const chat of (await loadTeamsChats(sql)).slice(1)) await removeChat(sql, "admin", chat.id);
  const [last] = await loadTeamsChats(sql);
  await assert.rejects(() => removeChat(sql, "admin", last.id), /^Error: This is the last chat\. Add another before you remove it\.$/);
  assert.equal((await loadTeamsChats(sql)).length, 1);
});

test("Corey's note lists installs still to deliver by install date, with no date last", async () => {
  await addChat(sql, "admin", { name: "Corey Russell", group: "Dispatch", kind: "dm", about: "", feed: "dispatch", target: null });
  await sql.query(
    `insert into installs (customer, equipment, equip_status, install_date, complete, archived) values
       ('Late Cafe', 'Eversys Cameo', 'Not Ready', '2026-11-02', false, false),
       ('Soon Cafe', 'Bunn ICB-DV', 'Ready', '2026-10-22', false, false),
       ('No Date Cafe', null, null, null, false, false),
       ('Done Cafe', 'Bunn TDO5', 'Installed', '2026-10-01', true, false),
       ('Marked Installed', 'Bunn TDO5', 'Installed', '2026-10-02', false, false),
       ('Closed Flag Only', 'Bunn TDO5', 'Ready', '2026-10-03', true, false),
       ('Archived Cafe', 'Bunn TDO5', 'Ready', '2026-10-04', false, true)`,
  );
  const card = (await chatCards(sql)).find((c) => c.name === "Corey Russell");
  assert.equal(
    card.text,
    [
      "Installs still to deliver, by install date.",
      "",
      "To deliver",
      "- 2026-10-22 · Soon Cafe · Bunn ICB-DV · Ready",
      "- 2026-11-02 · Late Cafe · Eversys Cameo · Not Ready",
      "- No date · No Date Cafe · No equipment · Not Ready",
    ].join("\n"),
  );
});
