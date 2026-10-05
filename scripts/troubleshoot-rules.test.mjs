import test from "node:test";
import assert from "node:assert/strict";
import { dropWetSteps, groundedIn, issueTerms, pageScore, partNumberOnPage, partSearchUrl, pickPages, similarIssue } from "../src/lib/ops/troubleshoot-rules.ts";

const pages = [
  { fileId: 1, page: 1, text: "Axiom service manual. Table of contents. Warranty. Safety notices." },
  { fileId: 1, page: 14, text: "Troubleshooting. Problem: water is not hot. Probable cause: limit thermostat open. Remedy: reset the limit thermostat. Probable cause: tank heater failed. Test the tank heater for continuity." },
  { fileId: 1, page: 15, text: "Troubleshooting. Problem: brew cycle will not start. Probable cause: start switch." },
  { fileId: 1, page: 30, text: "Programming the brew volume. Press and hold the digital key." },
];

test("the issue is reduced to the words that matter", () => {
  assert.deepEqual(issueTerms("no heat, water stays cold"), ["heat", "water", "cold"]);
  assert.deepEqual(issueTerms("The grinder is not dosing"), ["dos"]);
  assert.ok(issueTerms("error code E-12 on display").includes("e-12"));
});

test("pages are picked by the issue's words; pages that hold none are never sent", () => {
  const picked = pickPages(pages, "water not hot, no heat", 50_000);
  assert.deepEqual(picked.map((p) => p.page), [14]);
  assert.equal(pickPages(pages, "steam wand hissing", 50_000).length, 0);
  assert.ok(pageScore(pages[1].text, ["heat", "water"]) > pageScore(pages[3].text, ["heat", "water"]));
});

test("the size budget is respected, best page first, book order out", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ fileId: 1, page: i + 1, text: `heater ${"x ".repeat(400)}` }));
  const picked = pickPages(many, "heater", 2000);
  assert.ok(picked.length >= 1 && picked.length < 10);
  assert.deepEqual(picked.map((p) => p.page), [...picked.map((p) => p.page)].sort((a, b) => a - b));
});

test("a statement must be on the page it cites", () => {
  assert.equal(groundedIn("Limit thermostat open", pages[1].text), true);
  assert.equal(groundedIn("Test the tank heater for continuity", pages[1].text), true);
  assert.equal(groundedIn("Replace the control board and reflash firmware", pages[1].text), false);
  assert.equal(groundedIn("", pages[1].text), false);
});

test("a part number is shown only when it is printed on the page", () => {
  const book = "Item 12  29329.1000  Thermostat, limit   Item 13  04227.0000 Tank heater 1800W";
  assert.equal(partNumberOnPage("29329.1000", book), true);
  assert.equal(partNumberOnPage("29329 1000", book), true);
  assert.equal(partNumberOnPage("29329.1001", book), false);
  assert.equal(partNumberOnPage("heater", book), false);
});

test("past fixes match a similar issue", () => {
  assert.equal(similarIssue("no heat, water stays cold", "No heat"), true);
  assert.equal(similarIssue("water not heating", "no heat"), true);
  assert.equal(similarIssue("leaking from the funnel", "no heat"), false);
  assert.equal(similarIssue("", "no heat"), false);
});

test("grinders get no water or drain steps; the search link names the model", () => {
  const steps = [{ text: "Check the water inlet valve" }, { text: "Check the burr motor capacitor" }, { text: "Clear the drain line" }];
  assert.deepEqual(dropWetSteps(steps, true).map((s) => s.text), ["Check the burr motor capacitor"]);
  assert.equal(dropWetSteps(steps, false).length, 3);
  const url = partSearchUrl("BUNN", "Axiom-DV-APS", "Control board");
  assert.match(url, /^https:\/\/www\.google\.com\/search\?q=BUNN%20Axiom-DV-APS%20Control%20board%20part%20number$/);
});
