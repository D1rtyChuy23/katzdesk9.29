import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TEAMS_CHATS,
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
  orders: [],
  calls: [],
  deliveries: [],
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

test("Corey Russell is the delivery dispatcher, not a tech", () => {
  const corey = teamsChat("dm-cory");
  assert.equal(corey.name, "Corey Russell");
  assert.equal(corey.group, "Dispatch");
  assert.equal(corey.kind, "dm");
  assert.equal(corey.feed, "dispatch");
  assert.equal(corey.about, "Installs still to deliver, by install date.");
  assert.equal(techChatId("Cory Russell"), null);
  assert.equal(techChatId("Corey Russell"), null);
  assert.equal(techChatId("Cory"), null);
  const snap = { ...empty, calls: [call({ tech: "Cory Russell", customer: "Tech Ticket" })] };
  assert.doesNotMatch(draft("dm-cory", snap).text, /Tech Ticket/);
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
    orders: [{ callId: "SC-9", customer: "Blue Door", item: "Everpure", qty: "2", water: true }],
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
  assert.match(po.text, /Water filter · SC-9 · Blue Door · Everpure · qty 2/);
  assert.match(po.text, /NetSuite/);
  assert.match(draft("rep-amanda", snap).text, /Blue Door/);
  assert.doesNotMatch(draft("rep-amanda", snap).text, /Night Owl/);
  assert.match(draft("dfw", snap).text, /Blue Door/);
  assert.match(draft("sa-atx", snap).text, /Night Owl/);
  assert.match(draft("service-monkeys", snap).text, /Houston Cafe/);
  assert.doesNotMatch(draft("service-monkeys", snap).text, /Blue Door/);
  assert.match(draft("dm-ryan", snap).text, /Blue Door/);
  assert.match(draft("dm-cory", snap).text, /None\./);
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

test("the 17 chats that did not change send byte-for-byte the same text as before", () => {
  // Captured from main f3089f5 (hard-coded chats) over one fixed snapshot.
  const before = JSON.parse(readFileSync(new URL("./fixtures/teams-drafts-before.json", import.meta.url), "utf8"));
  const kept = TEAMS_CHATS.filter((c) => c.id !== "dm-cory");
  assert.equal(kept.length, 17);
  assert.deepEqual(kept.map((c) => c.id).sort(), Object.keys(before.drafts).filter((id) => id !== "dm-cory").sort());
  for (const chat of kept) {
    const now = draftTeamsChat(chat, before.snapshot);
    const old = before.drafts[chat.id];
    for (const key of ["name", "group", "kind", "about", "title", "text"]) assert.equal(now[key], old[key], `${chat.id} ${key}`);
  }
});

test("the dispatch note lists installs still to deliver in the order given, clipped like the rest", () => {
  const none = draft("dm-cory", empty);
  assert.equal(none.text, "Installs still to deliver, by install date.\n\nTo deliver\nNone.");
  const deliveries = [
    { date: "2026-10-21", customer: "Blue Door", equipment: "Bunn ICB-DV Twin with a very long name that keeps going", status: "Ready" },
    { date: "2026-10-23", customer: "", equipment: "", status: "Not Ready" },
    ...Array.from({ length: 8 }, (_, i) => ({ date: "", customer: `Late ${i}`, equipment: "Eversys Cameo", status: "Not Ready" })),
  ];
  const text = draft("dm-cory", { ...empty, deliveries }).text;
  const lines = text.split("\n");
  assert.equal(lines[0], "Installs still to deliver, by install date.");
  assert.equal(lines[2], "To deliver");
  assert.equal(lines[3], "- 2026-10-21 · Blue Door · Bunn ICB-DV Twin with a very long name… · Ready");
  assert.equal(lines[4], "- 2026-10-23 · No account · No equipment · Not Ready");
  assert.equal(lines[5], "- No date · Late 0 · Eversys Cameo · Not Ready");
  assert.equal(lines.at(-1), "And 2 more.");
  assert.equal(lines.filter((l) => l.startsWith("- ")).length, 8);
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
  assert.match(custom("region", "other"), /Tulsa/);
  assert.doesNotMatch(custom("region", "other"), /Liz Shop/);
});
