import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEAMS_CHATS,
  clipLine,
  collapseDuplicateWorkOrders,
  draftTeamsChat,
  repChatId,
  serviceRegion,
  techChatId,
} from "../src/lib/ops/teams-message.ts";

const when = "2026-10-17 8:00 AM CT";

const empty = {
  when,
  attention: [],
  duplicateWo: [],
  orders: [],
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
  assert.equal(TEAMS_CHATS.filter((c) => c.kind === "dm").map((c) => c.name).join(", "), "Ryan Gloria, Josh, Lance Oden, Oliver Garcia, Charles Foster, Cory Russell");
  assert.ok(!names.some((n) => n === "Dispatch" || n === "Analytics"));
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
  assert.equal(techChatId("Cory Russell"), "dm-cory");
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
  const big = draftTeamsChat("big-tymers", snap);
  assert.match(big.text, /Open past 48 hrs · Service · Blue Door · Ryan Gloria · SC-9/);
  assert.doesNotMatch(big.text, /Everpure|Amanda/);
  const po = draftTeamsChat("purchase-orders", snap);
  assert.match(po.text, /Water filter · SC-9 · Blue Door · Everpure · qty 2/);
  assert.match(po.text, /NetSuite/);
  assert.match(draftTeamsChat("rep-amanda", snap).text, /Blue Door/);
  assert.doesNotMatch(draftTeamsChat("rep-amanda", snap).text, /Night Owl/);
  assert.match(draftTeamsChat("dfw", snap).text, /Blue Door/);
  assert.match(draftTeamsChat("sa-atx", snap).text, /Night Owl/);
  assert.match(draftTeamsChat("service-monkeys", snap).text, /Houston Cafe/);
  assert.doesNotMatch(draftTeamsChat("service-monkeys", snap).text, /Blue Door/);
  assert.match(draftTeamsChat("dm-ryan", snap).text, /Blue Door/);
  assert.match(draftTeamsChat("dm-cory", snap).text, /None\./);
  const k = draftTeamsChat("k-team", snap);
  assert.match(k.text, /Service · 3 · Open 3/);
  assert.match(k.text, /Sell \$10\.00 · cost \$4\.00 · margin \$6\.00/);
  assert.equal(clipLine(`  ${"x".repeat(200)}`).length <= 160, true);
});

test("the clock minute is not part of the approved text", () => {
  const draft = draftTeamsChat("big-tymers", empty);
  const later = draftTeamsChat("big-tymers", { ...empty, when: "2026-10-17 8:01 AM CT" });
  assert.equal(later.text, draft.text);
  assert.notEqual(later.title, draft.title);
  assert.doesNotMatch(draft.text, /8:00 AM/);
  const changed = draftTeamsChat("big-tymers", { ...empty, attention: [{ label: "Past due — scheduled", board: "Service", customer: "Coco", tech: "", ref: "SC-4" }] });
  assert.notEqual(changed.text, draft.text);
});
