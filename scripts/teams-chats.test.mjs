import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { addChat, approveChat, chatCards, loadTeamsChats, removeChat, updateChat } = await import("../src/lib/ops/teams-reports.ts");
const { TEAMS_CHATS } = await import("../src/lib/ops/teams-message.ts");

const pg = new PGlite();
const dir = new URL("../migrations/", import.meta.url);
for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
// The live DB runs each migration once; running 0089 again must change nothing.
await pg.exec(readFileSync(new URL("0089_teams_chats.sql", dir), "utf8"));
const sql = { query: async (text, params) => (await pg.query(text, params)).rows };

await sql.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('admin', 'Chuy', true, true), ('rep', 'Sam', true, false)");

const sean = { name: "Sean's New Accounts", group: "Reps", kind: "group", about: "", feed: "rep", target: "Sean Marshall" };
const drafts = async (chat) => (await sql.query("select count(*)::int as n from teams_drafts where chat = $1", [chat]))[0].n;
const row = async (id) => (await loadTeamsChats(sql)).find((c) => c.id === id);

test("the seed is today's chats, with Corey under Dispatch, and running it twice adds nothing", async () => {
  const chats = await loadTeamsChats(sql);
  assert.equal(chats.length, 18);
  assert.deepEqual(
    chats.map((c) => c.id),
    TEAMS_CHATS.map((c) => c.id),
  );
  assert.deepEqual(chats, TEAMS_CHATS);
  assert.deepEqual(
    chats.find((c) => c.id === "dm-cory"),
    { id: "dm-cory", name: "Corey Russell", group: "Dispatch", kind: "dm", about: "Driver Dispatcher and Vehicle Maintenance", feed: "none", target: null },
  );
});

test("only an admin can add, edit or remove a chat", async () => {
  await assert.rejects(() => addChat(sql, "rep", sean), /^Error: Only an admin can add or remove a Teams chat\.$/);
  await assert.rejects(() => removeChat(sql, "rep", "big-tymers"), /^Error: Only an admin can add or remove a Teams chat\.$/);
  await assert.rejects(() => updateChat(sql, "rep", { ...sean, id: "big-tymers" }), /^Error: Only an admin can edit a Teams chat\.$/);
  await assert.rejects(() => updateChat(sql, "nobody", { ...sean, id: "big-tymers" }), /^Error: Only an admin can edit a Teams chat\.$/);
  assert.deepEqual(await loadTeamsChats(sql), TEAMS_CHATS);
});

test("adding or editing a chat that needs a person or region is refused without one", async () => {
  const saves = [(c) => addChat(sql, "admin", c), (c) => updateChat(sql, "admin", { ...c, id: "rep-amanda" })];
  for (const save of saves) {
    await assert.rejects(() => save({ ...sean, target: "  " }), /^Error: Type the rep's name\.$/);
    await assert.rejects(() => save({ ...sean, feed: "tech", target: "" }), /^Error: Type the tech's name\.$/);
    await assert.rejects(() => save({ ...sean, feed: "region", target: "houston" }), /^Error: Pick DFW, SA\/ATX or Other\.$/);
    await assert.rejects(() => save({ ...sean, feed: "weather" }), /^Error: Pick what the chat shows\.$/);
    await assert.rejects(() => save({ ...sean, kind: "channel" }), /^Error: Pick group chat or DM\.$/);
    await assert.rejects(() => save({ ...sean, name: " " }), /^Error: Give the chat a name\.$/);
    await assert.rejects(() => save({ ...sean, group: "" }), /^Error: Pick a group for the chat\.$/);
  }
  await assert.rejects(() => updateChat(sql, "admin", { ...sean, id: "no-such-chat" }), /^Error: That chat is not on the list\.$/);
  assert.deepEqual(await loadTeamsChats(sql), TEAMS_CHATS);
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

test("a typed group reuses an existing group whatever its capitals", async () => {
  const lower = await addChat(sql, "admin", { ...sean, name: "Lower Reps", group: "  reps " });
  assert.equal((await row(lower.id)).group, "Reps");
  await updateChat(sql, "admin", { ...sean, id: lower.id, name: "Lower Reps", group: "DISPATCH" });
  assert.equal((await row(lower.id)).group, "Dispatch");
  const night = await addChat(sql, "admin", { ...sean, name: "Night Crew", group: "Night Crew" });
  assert.equal((await row(night.id)).group, "Night Crew");
  // The only chat in a group can change that group's capitals.
  await updateChat(sql, "admin", { ...sean, id: night.id, name: "Night Crew", group: "NIGHT CREW" });
  assert.equal((await row(night.id)).group, "NIGHT CREW");
  const groups = new Set((await loadTeamsChats(sql)).map((c) => c.group));
  assert.deepEqual([...groups], ["Service", "Orders", "Reps", "Regions", "Leadership", "Techs", "Dispatch", "NIGHT CREW"]);
  for (const id of [lower.id, night.id]) await removeChat(sql, "admin", id);
});

test("editing a chat keeps its id, its place and its approval history", async () => {
  const before = (await chatCards(sql)).find((c) => c.id === "rep-sean");
  assert.equal(before.feed, "rep");
  assert.equal(before.target, "Sean Marshall");
  await approveChat(sql, "admin", "rep-sean", before.text);
  await approveChat(sql, "admin", "rep-sean", before.text);
  assert.equal(await drafts("rep-sean"), 2);
  const place = (await loadTeamsChats(sql)).findIndex((c) => c.id === "rep-sean");

  const saved = await updateChat(sql, "admin", {
    id: "rep-sean",
    name: "  Sean's   Accounts ",
    group: "Techs",
    kind: "dm",
    about: `  Sean's ${"x".repeat(300)}`,
    feed: "tech",
    target: "Ryan Gloria",
  });
  assert.deepEqual(saved, { id: "rep-sean", name: "Sean's Accounts" });
  const chats = await loadTeamsChats(sql);
  assert.equal(chats.length, TEAMS_CHATS.length + 3);
  assert.equal(chats.findIndex((c) => c.id === "rep-sean"), place);
  const edited = chats.find((c) => c.id === "rep-sean");
  assert.deepEqual({ ...edited, about: edited.about.length }, { id: "rep-sean", name: "Sean's Accounts", group: "Techs", kind: "dm", about: 200, feed: "tech", target: "Ryan Gloria" });
  assert.equal(await drafts("rep-sean"), 2);
  const card = (await chatCards(sql)).find((c) => c.id === "rep-sean");
  assert.equal(card.text, "Your open calls.\n\nCalls\nNone.");
  assert.equal(card.approved, false);

  // Put it back and the earlier approval of that exact text counts again.
  await updateChat(sql, "admin", { id: "rep-sean", ...TEAMS_CHATS.find((c) => c.id === "rep-sean") });
  assert.deepEqual(await row("rep-sean"), TEAMS_CHATS.find((c) => c.id === "rep-sean"));
  assert.equal((await chatCards(sql)).find((c) => c.id === "rep-sean").approved, true);
  assert.equal(await drafts("rep-sean"), 2);

  // Nothing automatic keeps no person or region.
  await updateChat(sql, "admin", { ...sean, id: "seans-new-accounts", feed: "none", target: "Sean Marshall" });
  assert.deepEqual(await row("seans-new-accounts"), { id: "seans-new-accounts", name: "Sean's New Accounts", group: "Reps", kind: "group", about: "", feed: "none", target: null });
});

test("Corey's chat has no automatic note and cannot be approved", async () => {
  await sql.query(
    `insert into installs (customer, equipment, equip_status, install_date, complete, archived) values ('Soon Cafe', 'Bunn ICB-DV', 'Ready', '2026-10-22', false, false)`,
  );
  const earlier = await drafts("dm-cory");
  const card = (await chatCards(sql)).find((c) => c.id === "dm-cory");
  assert.equal(card.feed, "none");
  assert.equal(card.target, null);
  assert.equal(card.text, "");
  assert.equal(card.approved, false);
  assert.equal(card.about, "Driver Dispatcher and Vehicle Maintenance");
  await assert.rejects(() => approveChat(sql, "admin", "dm-cory", ""), /^Error: This chat has no automatic note, so there is nothing to approve\.$/);
  await assert.rejects(() => approveChat(sql, "admin", "dm-cory", "Installs still to deliver."), /^Error: This chat has no automatic note, so there is nothing to approve\.$/);
  await assert.rejects(() => approveChat(sql, "rep", "dm-cory", ""), /^Error: Only an admin can approve a Teams note\.$/);
  assert.equal(await drafts("dm-cory"), earlier);

  const desk = await addChat(sql, "admin", { name: "Front Desk", group: "Dispatch", kind: "dm", about: "Answers the phone.", feed: "none", target: "Sean Marshall" });
  assert.deepEqual(await row(desk.id), { id: "front-desk", name: "Front Desk", group: "Dispatch", kind: "dm", about: "Answers the phone.", feed: "none", target: null });
  assert.equal((await chatCards(sql)).find((c) => c.id === desk.id).text, "");
  await assert.rejects(() => approveChat(sql, "admin", desk.id, ""), /^Error: This chat has no automatic note, so there is nothing to approve\.$/);
  await removeChat(sql, "admin", desk.id);
});

test("the dispatch feed is gone", async () => {
  await assert.rejects(() => addChat(sql, "admin", { ...sean, feed: "dispatch", target: null }), /^Error: Pick what the chat shows\.$/);
  await assert.rejects(() => updateChat(sql, "admin", { ...sean, id: "dm-cory", feed: "dispatch", target: null }), /^Error: Pick what the chat shows\.$/);
  await assert.rejects(() => sql.query("insert into teams_chats (id, name, grp, kind, feed) values ('old', 'Old', 'Dispatch', 'dm', 'dispatch')"), /check constraint/);
  assert.equal((await row("dm-cory")).feed, "none");
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
  await assert.rejects(() => updateChat(sql, "admin", { ...sean, id: "rep-chelsea" }), /^Error: That chat is not on the list\.$/);
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
