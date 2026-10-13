import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIRM_LEGACY,
  cleanLegacyNote,
  cleanUnofficial,
  legacyMoveError,
  legacyState,
  linkHost,
  splitLegacy,
  unofficialUrlError,
} from "../src/lib/ops/legacy-rules.ts";

test("a model is not moved to Legacy without a manufacturer source", () => {
  assert.match(legacyMoveError({ sourceUrl: "" }), /without a source/);
  assert.match(legacyMoveError({ sourceUrl: "   " }), /without a source/);
  assert.match(legacyMoveError({ sourceUrl: "the rep told me" }), /web address/);
  assert.match(legacyMoveError({ sourceUrl: "http://example.com/discontinued" }), /https/);
  assert.equal(legacyMoveError({ sourceUrl: "https://manuals.bunn.com/" }), null);
});

test("legacy state: legacy wins, confirm is a flag on a current model", () => {
  assert.equal(legacyState({ legacy: false, confirmLegacy: false }), "current");
  assert.equal(legacyState({ legacy: false, confirmLegacy: true }), "confirm");
  assert.equal(legacyState({ legacy: true, confirmLegacy: false }), "legacy");
  assert.equal(legacyState({ legacy: true, confirmLegacy: true }), "legacy");
  assert.equal(CONFIRM_LEGACY, "Confirm Legacy");
});

test("current models stay in the main row; a flagged model is still current", () => {
  const books = [
    { id: 1, title: "Bunn ITB Dual Dilution", legacy: false, confirmLegacy: false },
    { id: 2, title: "Bunn ITB DDIL Old Style", legacy: true, confirmLegacy: false },
    { id: 3, title: "Bunn G9-2T HD", legacy: false, confirmLegacy: true },
  ];
  const { current, legacy } = splitLegacy(books);
  assert.deepEqual(current.map((b) => b.id), [1, 3]);
  assert.deepEqual(legacy.map((b) => b.id), [2]);
  // Nothing is dropped: every model is in exactly one row.
  assert.equal(current.length + legacy.length, books.length);
});

test("notes are trimmed and capped; blank is null", () => {
  assert.equal(cleanLegacyNote("  Listed under   Discontinued Models Only  "), "Listed under Discontinued Models Only");
  assert.equal(cleanLegacyNote("   "), null);
  assert.equal(cleanLegacyNote("x".repeat(900)).length, 600);
});

test("unofficial source: a link, a note, or both; never an unsafe link", () => {
  assert.deepEqual(cleanUnofficial({ url: "https://forum.example.com/t/123", note: " Reseat the probe. " }), {
    url: "https://forum.example.com/t/123",
    note: "Reseat the probe.",
  });
  assert.deepEqual(cleanUnofficial({ note: "Tap the valve; it sticks when cold." }), { url: null, note: "Tap the valve; it sticks when cold." });
  assert.deepEqual(cleanUnofficial({ url: "http://old-forum.example.org/post" }), { url: "http://old-forum.example.org/post", note: null });
  assert.match(cleanUnofficial({}).error, /link, a note, or both/);
  assert.match(cleanUnofficial({ url: "javascript:alert(1)", note: "x" }).error, /web link/);
  assert.match(cleanUnofficial({ url: "data:text/html,<b>x</b>" }).error, /web link/);
  assert.match(cleanUnofficial({ url: "not a link", note: "x" }).error, /web address/);
  assert.match(cleanUnofficial({ note: "y".repeat(1501) }).error, /1,500/);
  assert.equal(unofficialUrlError(""), null);
});

test("link host is shown, not the whole address", () => {
  assert.equal(linkHost("https://www.home-barista.com/espresso-machines/x-t123.html"), "www.home-barista.com");
  assert.equal(linkHost("nope"), "");
  assert.equal(linkHost(null), "");
});
