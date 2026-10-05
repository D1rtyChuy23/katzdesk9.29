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

import { familyTitle, matchBook, shelfFileName } from "../src/lib/ops/library-file-rules.ts";

test("family names: variants collapse into one family", () => {
  assert.equal(familyTitle("Bunn", "Axiom-DV-3"), "Bunn Axiom");
  assert.equal(familyTitle("Bunn", "Axiom 15-3"), "Bunn Axiom");
  assert.equal(familyTitle("Bunn", "Bunn Axiom"), "Bunn Axiom");
  assert.equal(familyTitle("Fetco", "CBS-1252"), "Fetco CBS-1252");
  assert.equal(familyTitle("Eversys", "Cameo C'2s"), "Eversys Cameo");
  assert.equal(familyTitle("La Marzocco", "Linea PB"), "La Marzocco Linea");
  assert.equal(familyTitle("Bunn", "ITCB-DV"), "Bunn ITCB");
});

const books = [
  { id: 1, title: "Bunn Axiom" },
  { id: 2, title: "Fetco CBS-1252" },
  { id: 3, title: "La Marzocco Linea" },
  { id: 4, title: "Eversys Cameo" },
  { id: 5, title: "Bunn ITCB" },
];

test("Axiom and Bunn Axiom are the same book", () => {
  assert.equal(matchBook("Axiom parts.pdf", books)?.id, 1);
  assert.equal(matchBook("BUNN_AXIOM-DV-3 Service Manual.pdf", books)?.id, 1);
  assert.equal(matchBook("axiom15-3_illustrated_parts.pdf", books)?.id, 1);
});

test("other families match on the model name, however it is punctuated", () => {
  assert.equal(matchBook("CBS1252 manual.pdf", books)?.id, 2);
  assert.equal(matchBook("fetco cbs 1252 exploded.png", books)?.id, 2);
  assert.equal(matchBook("Linea 2 group.pdf", books)?.id, 3);
  assert.equal(matchBook("cameo_manual.docx", books)?.id, 4);
});

test("no match, or a tie, is never guessed", () => {
  assert.equal(matchBook("scan0001.pdf", books), null);
  assert.equal(matchBook("Bunn brewer manual.pdf", books), null, "maker alone is not a family");
  assert.equal(matchBook("linear actuator.pdf", books), null, "linear is not Linea");
  assert.equal(matchBook("Axiom and Cameo.pdf", books), null, "two families of equal weight");
});

test("files are renamed Family - Type, numbered when there is already one", () => {
  assert.equal(shelfFileName("Bunn Axiom", "spec", "x.pdf", []), "Bunn Axiom - Spec Sheet.pdf");
  assert.equal(shelfFileName("Bunn Axiom", "parts", "IPB.PDF", []), "Bunn Axiom - Parts Book.pdf");
  assert.equal(shelfFileName("Bunn Axiom", "manuals", "m.docx", []), "Bunn Axiom - Manual.docx");
  assert.equal(shelfFileName("Bunn Axiom", "manuals", "m.pdf", ["bunn axiom - manual.pdf", "Bunn Axiom - Manual 2.pdf"]), "Bunn Axiom - Manual 3.pdf");
});

test("a numbered file sorts after the first one", () => {
  const names = sortByName([{ name: "Bunn Axiom - Manual 2.pdf" }, { name: "Bunn Axiom - Manual 10.pdf" }, { name: "Bunn Axiom - Manual.pdf" }]).map((f) => f.name);
  assert.deepEqual(names, ["Bunn Axiom - Manual.pdf", "Bunn Axiom - Manual 2.pdf", "Bunn Axiom - Manual 10.pdf"]);
});

import { makerOf, modelLabel, shortDocName } from "../src/lib/ops/library-file-rules.ts";

test("books group under their manufacturer", () => {
  assert.equal(makerOf("Bunn Axiom"), "Bunn");
  assert.equal(makerOf("La Marzocco Linea"), "La Marzocco");
  assert.equal(makerOf("Acme Brewer 9", ["Acme Brewer"]), "Acme Brewer");
  assert.equal(makerOf("Zojirushi X1"), "Zojirushi");
  assert.equal(modelLabel("La Marzocco Linea", "La Marzocco"), "Linea");
  assert.equal(modelLabel("Fetco CBS-1252", "Fetco"), "CBS-1252");
});

test("document names drop the family they already sit under", () => {
  assert.equal(shortDocName("Bunn Axiom - Manual 2.pdf", "Bunn Axiom"), "Manual 2");
  assert.equal(shortDocName("Bunn Axiom - Parts Book.pdf", "Bunn Axiom"), "Parts Book");
  assert.equal(shortDocName("scan0001.pdf", "Bunn Axiom"), "scan0001");
});

import { likelyBooks, variationTitle } from "../src/lib/ops/library-file-rules.ts";

const axioms = [
  { id: 1, title: "Bunn Axiom DV-APS", manufacturer: "Bunn" },
  { id: 2, title: "Bunn Axiom Twin", manufacturer: "Bunn" },
  { id: 3, title: "Bunn Axiom", manufacturer: "Bunn" },
  { id: 4, title: "Fetco CBS-2152 Twin", manufacturer: "Fetco" },
];

test("each variation is its own book title", () => {
  assert.equal(variationTitle("Bunn", "Axiom DV-APS"), "Bunn Axiom DV-APS");
  assert.equal(variationTitle("Bunn", "Bunn Axiom Twin"), "Bunn Axiom Twin");
  assert.equal(variationTitle("La Marzocco", "Linea PB"), "La Marzocco Linea PB");
});

test("a file goes to the variation its name spells out", () => {
  assert.equal(matchBook("Axiom DV-APS parts.pdf", axioms)?.id, 1);
  assert.equal(matchBook("bunn_axiom_dv_aps_manual.pdf", axioms)?.id, 1);
  assert.equal(matchBook("Axiom Twin manual.pdf", axioms)?.id, 2);
});

test("never guesses across variations", () => {
  assert.equal(matchBook("Axiom manual.pdf", axioms), null, "Axiom alone could be any Axiom");
  assert.equal(matchBook("Twin manual.pdf", axioms), null, "a variation word alone is not a model");
  assert.equal(matchBook("DV-APS manual.pdf", axioms), null);
  assert.equal(matchBook("Axiom manual.pdf", [axioms[2]])?.id, 3, "only one Axiom on file: that is the one");
});

test("the picker lists the same model's variations first", () => {
  assert.deepEqual(likelyBooks("Axiom manual.pdf", axioms).map((b) => b.id), [1, 2, 3]);
});

test("a picture and a PDF on the same shelf get different names", () => {
  assert.equal(shelfFileName("Bunn Axiom Twin", "parts", "view.png", ["Bunn Axiom Twin - Parts Book.pdf"]), "Bunn Axiom Twin - Parts Book 2.png");
});

import { manualTypeFromName, sectionForType, MANUAL_TYPES } from "../src/lib/ops/library-file-rules.ts";

test("manual type is read from the file name only when it is obvious", () => {
  assert.equal(manualTypeFromName("Axiom-DV-APS cleaning guide.pdf"), "Cleaning Manual");
  assert.equal(manualTypeFromName("AXIOM_Programming_Manual.pdf"), "Programming Manual");
  assert.equal(manualTypeFromName("Axiom Installation & Operating Guide.pdf"), "Operating / Installation Manual");
  assert.equal(manualTypeFromName("Axiom Operation Manual.pdf"), "Operating / Installation Manual");
  assert.equal(manualTypeFromName("Axiom Owner's Manual.pdf"), "User Manual");
  assert.equal(manualTypeFromName("axiom-user-guide.pdf"), "User Manual");
  assert.equal(manualTypeFromName("Axiom Illustrated Parts Catalog.pdf"), "Parts Diagram");
  assert.equal(manualTypeFromName("Axiom exploded view.pdf"), "Parts Diagram");
});

test("no type, or more than one, means the person picks", () => {
  assert.equal(manualTypeFromName("Axiom manual.pdf"), null);
  assert.equal(manualTypeFromName("41234.0001.pdf"), null);
  assert.equal(manualTypeFromName("Axiom install and cleaning.pdf"), null);
  assert.equal(manualTypeFromName("Axiom DV-APS reprogrammed.pdf"), null);
});

test("a manual is filed as Variation - Type; a parts diagram goes with the parts", () => {
  assert.equal(shelfFileName("Bunn Axiom-DV-APS", "manuals", "x.pdf", [], "Cleaning Manual"), "Bunn Axiom-DV-APS - Cleaning Manual.pdf");
  assert.equal(shelfFileName("Bunn Axiom-DV-APS", "manuals", "x.pdf", ["Bunn Axiom-DV-APS - Cleaning Manual.pdf"], "Cleaning Manual"), "Bunn Axiom-DV-APS - Cleaning Manual 2.pdf");
  assert.equal(shelfFileName("Bunn Axiom", "manuals", "x.pdf", []), "Bunn Axiom - Manual.pdf");
  assert.equal(sectionForType("Parts Diagram"), "parts");
  for (const t of MANUAL_TYPES.filter((x) => x !== "Parts Diagram")) assert.equal(sectionForType(t), "manuals");
});
