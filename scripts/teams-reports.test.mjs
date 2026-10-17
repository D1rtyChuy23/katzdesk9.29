import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEAMS_WEBHOOK_ENV,
  adaptiveCardPayload,
  analyticsReport,
  clipLine,
  collapseDuplicateWorkOrders,
  composeReport,
  dispatchReport,
  handoffReport,
  partsReport,
} from "../src/lib/ops/teams-message.ts";
import { deliverTeamsReport, webhookUrl } from "../src/lib/ops/teams-post.ts";

const when = "2026-10-17 8:00 AM CT";

test("lines are one short sentence and extra lines are counted, not pasted", () => {
  const note = composeReport({
    channel: "parts",
    title: "Parts",
    intro: "Waiting.",
    sections: [{ heading: "Bins", lines: Array.from({ length: 9 }, (_, i) => `bin ${i} ${"x".repeat(200)}`), empty: "None." }],
  });
  assert.equal(note.lineCount, 8);
  assert.match(note.text, /And 1 more\./);
  assert.ok(!note.text.includes("|"));
  const shown = note.text.split("\n").find((l) => l.startsWith("- bin 0"));
  assert.ok(shown && shown.length <= 164);
  assert.equal(clipLine("  a   b  "), "a b");
});

test("dispatch names the four exception lists and does not rename anyone", () => {
  const note = dispatchReport(
    {
      blankWo: [{ board: "Service", id: 12, customer: "Blue Door", ref: "SC-1" }],
      duplicateWo: [{ wo: "1182", where: "Service #4 Blue Door, PM #9 Blue Door" }],
      names: [{ katz: "Blue Door Cafe", clean: "Blue Door Café LLC", reason: "spelling" }],
      addresses: [{ name: "Night Owl", address: "1 Main St", pin: "2 Main St" }],
    },
    when,
  );
  assert.equal(note.channel, "dispatch");
  assert.match(note.title, /dispatch · 2026-10-17/);
  assert.match(note.text, /Service #12 · Blue Door · SC-1/);
  assert.match(note.text, /WO 1182 · Service #4/);
  assert.match(note.text, /Blue Door Cafe → Blue Door Café LLC · spelling/);
  assert.match(note.text, /Night Owl · 1 Main St · pin 2 Main St/);
  assert.match(note.text, /locked customer name is not renamed/);
  assert.doesNotMatch(note.text, /\$\d/);
});

test("WO-1182 and 1182 are one duplicate, and a lone work order is not", () => {
  const rows = collapseDuplicateWorkOrders([
    { key: "1182", wo: "WO-1182", where: "Service #2 Blue Door" },
    { key: "1182", wo: "1182", where: "PM #1 Blue Door" },
    { key: "50", wo: "50", where: "Install #3 Coco" },
    { key: "", wo: "", where: "Service #9" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].wo, "WO-1182");
  assert.match(rows[0].where, /Service #2 Blue Door, PM #1 Blue Door/);
});

test("an empty morning list still says none, so the channel knows the check ran", () => {
  const note = dispatchReport({ blankWo: [], duplicateWo: [], names: [], addresses: [] }, when);
  assert.equal(note.text.match(/None\./g)?.length, 4);
});

test("zip-area pins are not repeated as a street", () => {
  const note = dispatchReport(
    {
      blankWo: [],
      duplicateWo: [],
      names: [],
      addresses: [{ name: "Night Owl", address: "", pin: "Houston, TX, 77002 (ZIP area)" }],
    },
    when,
  );
  assert.match(note.text, /Night Owl · No street address/);
  assert.doesNotMatch(note.text, /pin Houston/);
});

test("parts and handoff stay short pings", () => {
  const parts = partsReport(
    {
      missingMpn: [{ callId: "SC-9", customer: "Coco", item: "EVER104120" }],
      excelDates: [{ sku: "EVER104120", piece: "rack", value: "1/2/2007" }],
    },
    when,
  );
  assert.match(parts.text, /SC-9 · Coco · EVER104120/);
  assert.match(parts.text, /EVER104120 · rack 1\/2\/2007/);
  const handoff = handoffReport({ asks: [{ team: "sales", customer: "Coco", body: "Need the manual before Thursday" }] }, when);
  assert.match(handoff.text, /Ask sales · Coco · Need the manual/);
  assert.match(handoff.text, /only the ping/);
});

test("analytics carries counts and leaves cost in KatzDesk", () => {
  const note = analyticsReport(
    {
      scope: "Oct 1, 2026 to Oct 17, 2026 · Installs, Service · All reps · 3 records",
      counts: [{ label: "Service", total: 3, top: "Open 2, Completed 1" }],
    },
    when,
  );
  assert.match(note.text, /Service · 3 · Open 2, Completed 1/);
  assert.match(note.text, /Cost and margin are not in this note/);
  assert.doesNotMatch(note.text, /margin \$|cost \$/i);
});

test("the card is a Teams workflow message and the webhook is https only", () => {
  const note = partsReport({ missingMpn: [], excelDates: [] }, when);
  const card = adaptiveCardPayload(note);
  assert.equal(card.type, "message");
  assert.equal(card.attachments[0]?.contentType, "application/vnd.microsoft.card.adaptive");
  assert.equal(card.attachments[0]?.content.body[0]?.text, note.title);
  const secret = "https://example.webhook.office.com/webhookb2/abc";
  assert.equal(webhookUrl("parts", { [TEAMS_WEBHOOK_ENV.parts]: secret }), secret);
  assert.equal(webhookUrl("parts", { [TEAMS_WEBHOOK_ENV.parts]: "http://example.webhook.office.com/hook" }), null);
  assert.equal(webhookUrl("parts", { [TEAMS_WEBHOOK_ENV.parts]: "https://user:pass@example.webhook.office.com/hook" }), null);
  assert.equal(webhookUrl("parts", {}), null);
  assert.equal(webhookUrl("dispatch", { [TEAMS_WEBHOOK_ENV.parts]: secret }), null);
});

test("a missing or refused webhook never echoes the address", async () => {
  const note = handoffReport({ asks: [] }, when);
  const secret = "https://example.webhook.office.com/webhookb2/secret-token";
  const missing = await deliverTeamsReport(note, {}, async () => ({ status: 200 }));
  assert.equal(missing.posted, false);
  assert.equal(missing.ready, false);
  assert.match(missing.error ?? "", /TEAMS_WEBHOOK_HANDOFF/);
  assert.doesNotMatch(missing.error ?? "", /webhook/);

  let called = "";
  const refused = await deliverTeamsReport(note, { [TEAMS_WEBHOOK_ENV.handoff]: secret }, async (url) => {
    called = url;
    return { status: 400 };
  });
  assert.equal(called, secret);
  assert.equal(refused.posted, false);
  assert.equal(refused.ready, true);
  assert.match(refused.error ?? "", /\(400\)/);
  assert.doesNotMatch(JSON.stringify(refused), /secret-token/);

  const down = await deliverTeamsReport(note, { [TEAMS_WEBHOOK_ENV.handoff]: secret }, async () => {
    throw new Error(`connect ${secret}`);
  });
  assert.equal(down.error, "Handoff could not be reached.");
  assert.doesNotMatch(down.error ?? "", /secret-token/);
});
