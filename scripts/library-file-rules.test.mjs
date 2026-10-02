import assert from "node:assert/strict";
import { test } from "node:test";
import { emailHref, fileError, fileUrl, MAX_FILE_BYTES, mimeFor, opensInline, sortByName, textHref } from "../src/lib/ops/library-file-rules.ts";

test("PDF, images and Word are accepted; anything else gets a clear message", () => {
  for (const n of ["a.pdf", "A.PDF", "b.png", "c.jpg", "d.jpeg", "e.webp", "f.gif", "g.doc", "h.docx"]) assert.equal(fileError(n, 1000), null, n);
  assert.match(fileError("virus.exe", 1000), /can't be added/);
  assert.match(fileError("sheet.xlsx", 1000), /only PDF/);
  assert.match(fileError("noext", 1000), /can't be added/);
});

test("too big and empty files are refused", () => {
  assert.match(fileError("big.pdf", MAX_FILE_BYTES + 1), /too big.*limit is 20 MB/);
  assert.equal(fileError("ok.pdf", MAX_FILE_BYTES), null);
  assert.match(fileError("zero.pdf", 0), /empty/);
});

test("type comes from the file name; only PDFs and pictures open in the tab", () => {
  assert.equal(mimeFor("Manual.PDF"), "application/pdf");
  assert.equal(opensInline(mimeFor("x.pdf")), true);
  assert.equal(opensInline(mimeFor("x.jpg")), true);
  assert.equal(opensInline(mimeFor("x.docx")), false);
});

test("files sort A–Z by name, ignoring case, numbers in order", () => {
  const names = sortByName([{ name: "zebra.pdf" }, { name: "Manual 10.pdf" }, { name: "apple.pdf" }, { name: "manual 2.pdf" }, { name: "Bunn.pdf" }]).map((f) => f.name);
  assert.deepEqual(names, ["apple.pdf", "Bunn.pdf", "manual 2.pdf", "Manual 10.pdf", "zebra.pdf"]);
});

test("links are full URLs; Email and Text carry the link, not the file", () => {
  const url = fileUrl("https://desk.example.com/", "abc123");
  assert.equal(url, "https://desk.example.com/api/library-file/abc123");
  const mail = emailHref("Bunn Axiom Manual.pdf", url);
  assert.ok(mail.startsWith("mailto:?subject=Bunn%20Axiom%20Manual.pdf&body="));
  assert.ok(decodeURIComponent(mail).includes(url));
  const sms = textHref("Bunn Axiom Manual.pdf", url);
  assert.ok(sms.startsWith("sms:?&body="));
  assert.ok(decodeURIComponent(sms).includes(url));
});
