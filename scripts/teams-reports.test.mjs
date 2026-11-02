import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TEAMS_CHATS,
  TEAMS_FEEDS,
  clipLine,
  collapseDuplicateWorkOrders,
  draftTeamsChat,
  repChatId,
  serviceRegion,
  teamsChat,
  techChatId,
} from "../src/lib/ops/teams-message.ts";

const draft = (id, snap) => draftTeamsChat(teamsChat(id), snap);

const when = "2026-10-17 8:00 AM CT";

const empty = {
  when,
  attention: [],
  duplicateWo: [],
  calls: [],
  kpiScope: "Oct 1, 2026 to Oct 31, 2026 · 0 records",
  kpi: [],
  finance: null,
};

const call = (extra) => ({
  customer: "Blue Door",
  rep: "",
  tech: "",
  tech2: "",
  region: "other",
  status: "Open",
  when: "2026-10-18",
  issue: "Grinder jammed",
  ref: "SC-1",
  ...extra,
});

test("the chat list is the group chats and DMs, with no team channel", () => {
  const names = TEAMS_CHATS.map((c) => c.name);
  assert.ok(names.includes("Big Tymers, Big Poppin"));
  assert.ok(names.includes("Purchase Order Requests"));
  assert.ok(names.includes("DFW Service Chat"));
  assert.ok(names.includes("SA/ATX"));
  assert.ok(names.includes("Service Monkeys"));
  assert.ok(names.includes("The K Team"));
  assert.equal(names.filter((n) => n.includes("Customers' Request")).length, 6);
  assert.equal(TEAMS_CHATS.filter((c) => c.kind === "dm").map((c) => c.name).join(", "), "Ryan Gloria, Josh, Lance Oden, Oliver Garcia, Charles Foster, Corey Russell");
  assert.equal(TEAMS_CHATS.filter((c) => c.group === "Techs").map((c) => c.name).join(", "), "Ryan Gloria, Josh, Lance Oden, Oliver Garcia, Charles Foster");
  assert.ok(!names.some((n) => n === "Dispatch" || n === "Analytics"));
});

test("Corey Russell dispatches drivers and his chat has no automatic note", () => {
  assert.deepEqual(teamsChat("dm-cory"), {
    id: "dm-cory",
    name: "Corey Russell",
    group: "Dispatch",
    kind: "dm",
    about: "Driver Dispatcher and Vehicle Maintenance",
    feed: "none",
    target: null,
  });
  assert.equal(techChatId("Cory Russell"), null);
  assert.equal(techChatId("Corey Russell"), null);
  assert.equal(techChatId("Cory"), null);
  const snap = {
    ...empty,
    attention: [{ label: "Open past 48 hrs", board: "Service", customer: "Blue Door", tech: "Cory Russell", ref: "SC-9" }],
    po: { from: "2026-10-10", to: "2026-10-16", parts: [{ maker: "Everpure", sku: "WFEV9999", label: "Test Cartridge", pieces: 2 }] },
    calls: [call({ tech: "Cory Russell", customer: "Tech Ticket" })],
  };
  const corey = draft("dm-cory", snap);
  assert.equal(corey.text, "");
  assert.equal(corey.name, "Corey Russell");
  assert.equal(corey.about, "Driver Dispatcher and Vehicle Maintenance");
});

test("cities and ZIPs pick DFW or SA/ATX", () => {
  assert.equal(serviceRegion("123 Main St, Dallas, TX 75201"), "dfw");
  assert.equal(serviceRegion("Fort Worth, TX"), "dfw");
  assert.equal(serviceRegion("100 Congress Ave, Austin, TX 78701"), "sa-atx");
  assert.equal(serviceRegion("San Antonio, TX 78205"), "sa-atx");
  assert.equal(serviceRegion("Somewhere 76102"), "dfw");
  assert.equal(serviceRegion("Houston, TX 77002"), "other");
});

test("rep and tech chats follow the person, including Liz and Josh", () => {
  assert.equal(repChatId("Sean Marshall"), "rep-sean");
  assert.equal(repChatId("Lizbeth Romero"), "rep-liz");
  assert.equal(repChatId("Liz"), "rep-liz");
  assert.equal(repChatId("Chelsea Nguyen"), "rep-chelsea");
  assert.equal(repChatId("Iliana"), "rep-iliana");
  assert.equal(repChatId("Bill McKinley"), null);
  assert.equal(techChatId("Josh"), "dm-josh");
  assert.equal(techChatId("Joshua Harper"), "dm-josh");
  assert.equal(techChatId("Bill McKinley"), null);
});

test("WO-1182 and 1182 are one duplicate", () => {
  const rows = collapseDuplicateWorkOrders([
    { key: "1182", wo: "WO-1182", where: "Service #2 Blue Door" },
    { key: "1182", wo: "1182", where: "PM #1 Blue Door" },
    { key: "50", wo: "50", where: "Install #3 Coco" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].wo, "WO-1182");
});

test("each chat gets only its own lines, and the text is what would be sent", () => {
  const snap = {
    ...empty,
    attention: [{ label: "Open past 48 hrs", board: "Service", customer: "Blue Door", tech: "Ryan Gloria", ref: "SC-9" }],
    po: { from: "2026-10-10", to: "2026-10-16", parts: [{ maker: "Everpure", sku: "WFEV9999", label: "Test Cartridge", pieces: 2 }] },
    calls: [
      call({ rep: "Amanda Logg", region: "dfw", tech: "Ryan Gloria" }),
      call({ customer: "Night Owl", rep: "Sean Marshall", region: "sa-atx", tech: "", ref: "SC-2" }),
      call({ customer: "Houston Cafe", rep: "Shannon Cafourek", region: "other", tech: "", ref: "SC-3" }),
    ],
    kpi: [{ label: "Service", total: 3, top: "Open 3" }],
    finance: { scope: "This month, invoiced part lines.", sell: "$10.00", cost: "$4.00", margin: "$6.00" },
  };
  const big = draft("big-tymers", snap);
  assert.match(big.text, /Open past 48 hrs · Service · Blue Door · Ryan Gloria · SC-9/);
  assert.doesNotMatch(big.text, /Everpure|Amanda/);
  const po = draft("purchase-orders", snap);
  assert.match(po.text, /\nEverpure · 1 part, 2 pieces\n- WFEV9999 · Test Cartridge · 2$/);
  assert.match(po.text, /NetSuite/);
  assert.doesNotMatch(po.text, /Blue Door|Night Owl/);
  assert.match(draft("rep-amanda", snap).text, /Blue Door/);
  assert.doesNotMatch(draft("rep-amanda", snap).text, /Night Owl/);
  assert.match(draft("dfw", snap).text, /Blue Door/);
  assert.match(draft("sa-atx", snap).text, /Night Owl/);
  // The techs are all in Service Monkeys: each one's calls, in every region; then the calls outside DFW and SA/ATX
  // with no tech.
  assert.match(draft("service-monkeys", snap).text, /\n\nRyan Gloria · 1 open call\n- Blue Door · Open · 2026-10-18 · SC-1 · Grinder jammed · DFW\n\nNo tech yet\n- Houston Cafe/);
  assert.doesNotMatch(draft("service-monkeys", snap).text, /Night Owl/);
  assert.match(draft("dfw", snap).text, /Assigned so far \(Ryan Gloria 1\)\n- Ryan Gloria · Blue Door/);
  assert.match(draft("dm-ryan", snap).text, /Blue Door/);
  assert.equal(draft("dm-cory", snap).text, "");
  const k = draft("k-team", snap);
  assert.match(k.text, /Service · 3 · Open 3/);
  assert.match(k.text, /Sell \$10\.00 · cost \$4\.00 · margin \$6\.00/);
  assert.equal(clipLine(`  ${"x".repeat(200)}`).length <= 160, true);
});

test("the clock minute is not part of the approved text", () => {
  const first = draft("big-tymers", empty);
  const later = draft("big-tymers", { ...empty, when: "2026-10-17 8:01 AM CT" });
  assert.equal(later.text, first.text);
  assert.notEqual(later.title, first.title);
  assert.doesNotMatch(first.text, /8:00 AM/);
  const changed = draft("big-tymers", { ...empty, attention: [{ label: "Past due — scheduled", board: "Service", customer: "Coco", tech: "", ref: "SC-4" }] });
  assert.notEqual(changed.text, first.text);
});

test("from the same snapshot, the chats whose notes did not change on 11/2 get byte-for-byte the same text", () => {
  // Captured from main f3089f5 (hard-coded chats) over one fixed snapshot. On 11/2 the Purchase Order, rep and region
  // notes changed on purpose (weekly report by maker; serviced, Pipeline and installs; who has each call and the
  // get-ready list); the drafting of the service tracker, The K Team and the tech DMs did not. (The snapshot itself
  // reads open calls as the Service board does now, in a fixed order, so a live tech DM can still read differently.)
  const before = JSON.parse(readFileSync(new URL("./fixtures/teams-drafts-before.json", import.meta.url), "utf8"));
  const kept = TEAMS_CHATS.filter((c) => ["service", "leadership", "tech"].includes(c.feed));
  assert.deepEqual(kept.map((c) => c.id), ["big-tymers", "k-team", "dm-ryan", "dm-josh", "dm-lance", "dm-oliver", "dm-charles"]);
  for (const chat of kept) {
    const now = draftTeamsChat(chat, before.snapshot);
    const old = before.drafts[chat.id];
    for (const key of ["name", "group", "kind", "about", "title", "text"]) assert.equal(now[key], old[key], `${chat.id} ${key}`);
  }
  const changed = TEAMS_CHATS.filter((c) => ["orders", "rep", "region"].includes(c.feed));
  assert.equal(changed.length, 10);
  for (const chat of changed) {
    const now = draftTeamsChat(chat, before.snapshot);
    const old = before.drafts[chat.id];
    assert.equal(now.name, old.name, chat.id);
    assert.notEqual(now.text, old.text, chat.id);
    // DFW and SA/ATX keep their About; the others say what the note lists now.
    if (chat.id === "dfw" || chat.id === "sa-atx") assert.equal(now.about, old.about, chat.id);
    else assert.notEqual(now.about, old.about, chat.id);
  }
});

test("the dispatch feed is gone, and 'Nothing automatic' gives an empty note", () => {
  assert.deepEqual([...TEAMS_FEEDS], ["service", "orders", "rep", "region", "leadership", "tech", "none"]);
  assert.equal(TEAMS_CHATS.some((c) => c.feed === "dispatch"), false);
  const busy = {
    ...empty,
    attention: [{ label: "Open past 48 hrs", board: "Service", customer: "Blue Door", tech: "", ref: "SC-9" }],
    calls: [call({ rep: "Sean Marshall", tech: "Ryan Gloria", region: "dfw" })],
    kpi: [{ label: "Service", total: 3, top: "Open 3" }],
  };
  const chat = (feed) => ({ id: "x", name: "X", group: "New", kind: "dm", about: "", feed, target: null });
  assert.equal(draftTeamsChat(chat("none"), busy).text, "");
  // A feed name that is not on the list (an old 'dispatch' row) drafts nothing rather than a tech note.
  assert.equal(draftTeamsChat(chat("dispatch"), busy).text, "");
});

test("typing Liz as an added chat's rep matches Lizbeth Romero's calls", () => {
  const snap = {
    ...empty,
    calls: [
      call({ customer: "Short Name", rep: "Liz" }),
      call({ customer: "Full Name", rep: "Lizbeth Romero" }),
      call({ customer: "Not Her", rep: "Lisa Smith" }),
    ],
  };
  for (const target of ["Liz", "liz", "Liz Romero", "Lizbeth", "Lizbeth Romero"]) {
    const chat = { id: "liz-2", name: "Liz 2", group: "Reps", kind: "group", about: "", feed: "rep", target };
    const text = draftTeamsChat(chat, snap).text;
    assert.match(text, /Short Name/, target);
    assert.match(text, /Full Name/, target);
    assert.doesNotMatch(text, /Not Her/, target);
    assert.equal(repChatId("Lizbeth Romero", [chat]), "liz-2", target);
    assert.equal(repChatId("Liz", [chat]), "liz-2", target);
  }
});

test("a chat added for a person or region follows the same rules as the built-in ones", () => {
  const snap = {
    ...empty,
    calls: [
      call({ customer: "Liz Shop", rep: "Liz", tech: "Josh" }),
      call({ customer: "Mike Shop", rep: "Melinda Warden", tech: "Mike Jones", region: "dfw" }),
      call({ customer: "Tulsa", region: "other" }),
    ],
  };
  const custom = (feed, target) => draftTeamsChat({ id: "x", name: "X", group: "New", kind: "dm", about: "", feed, target }, snap).text;
  assert.match(custom("rep", "Lizbeth Romero"), /Liz Shop/);
  assert.match(custom("rep", "Melinda"), /Mike Shop/);
  assert.doesNotMatch(custom("rep", "Melinda"), /Liz Shop/);
  assert.match(custom("tech", "Joshua Harper"), /Liz Shop/);
  assert.match(custom("tech", "Josh"), /Liz Shop/);
  assert.match(custom("tech", "Mike"), /Mike Shop/);
  assert.doesNotMatch(custom("tech", "Mike"), /Liz Shop/);
  assert.match(custom("region", "dfw"), /Mike Shop/);
  assert.doesNotMatch(custom("region", "dfw"), /Liz Shop|Tulsa/);
  // Outside DFW and SA/ATX: who has each call, then the calls with no tech yet.
  // Outside DFW and SA/ATX: each tech's calls in every region, then the calls there with no tech yet.
  assert.match(custom("region", "other"), /\n\nJoshua Harper · 1 open call\n- Liz Shop · Open · 2026-10-18 · SC-1 · Grinder jammed\n\nMike Jones · 1 open call\n- Mike Shop · Open · 2026-10-18 · SC-1 · Grinder jammed · DFW\n\nNo tech yet\n- Tulsa/);
});
