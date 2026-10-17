import assert from "node:assert/strict";
import { test } from "node:test";
import { canEditFromRole, emailHref, fileError, fileUrl, MAX_FILE_BYTES, mimeFor, opensInline, sortByName, textHref } from "../src/lib/ops/library-file-rules.ts";

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
  // A parts file keeps the name it was dropped with.
  assert.equal(shelfFileName("Bunn Axiom", "parts", "IPB.PDF", []), "IPB.PDF");
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

test("a parts file keeps its original name, whatever else is on the shelf", () => {
  assert.equal(shelfFileName("Bunn Axiom Twin", "parts", "view.png", ["Bunn Axiom Twin - Parts Book.pdf"]), "view.png");
  assert.equal(shelfFileName("Bunn Axiom", "parts", "  Axiom  IPB 55012.pdf ", ["Axiom IPB 55012.pdf"]), "Axiom IPB 55012.pdf");
  // A picture and a PDF manual on the same shelf still get different generated names.
  assert.equal(shelfFileName("Bunn Axiom Twin", "manuals", "view.png", ["Bunn Axiom Twin - Manual.pdf"]), "Bunn Axiom Twin - Manual 2.png");
});

import { manualTypeFromName, MANUAL_TYPES } from "../src/lib/ops/library-file-rules.ts";

test("manual type is read from the file name only when it is obvious", () => {
  assert.equal(manualTypeFromName("Axiom-DV-APS cleaning guide.pdf"), "Cleaning Manual");
  assert.equal(manualTypeFromName("AXIOM_Programming_Manual.pdf"), "Programming Manual");
  assert.equal(manualTypeFromName("Axiom Installation & Operating Guide.pdf"), "Operating / Installation Manual");
  assert.equal(manualTypeFromName("Axiom Operation Manual.pdf"), "Operating / Installation Manual");
  assert.equal(manualTypeFromName("Axiom Owner's Manual.pdf"), "User Manual");
  assert.equal(manualTypeFromName("axiom-user-guide.pdf"), "User Manual");
  assert.equal(manualTypeFromName("Axiom Service Manual.pdf"), "Service And Repair Manual");
  assert.equal(manualTypeFromName("Axiom-DV-APS repair & troubleshooting.pdf"), "Service And Repair Manual");
});

test("no type, or more than one, means the person picks", () => {
  assert.equal(manualTypeFromName("Axiom manual.pdf"), null);
  assert.equal(manualTypeFromName("41234.0001.pdf"), null);
  assert.equal(manualTypeFromName("Axiom install and cleaning.pdf"), null);
  assert.equal(manualTypeFromName("Axiom DV-APS reprogrammed.pdf"), null);
});

test("a manual is filed as Variation - Type and never as a parts book", () => {
  assert.equal(shelfFileName("Bunn Axiom-DV-APS", "manuals", "x.pdf", [], "Cleaning Manual"), "Bunn Axiom-DV-APS - Cleaning Manual.pdf");
  assert.equal(shelfFileName("Bunn Axiom-DV-APS", "manuals", "x.pdf", ["Bunn Axiom-DV-APS - Cleaning Manual.pdf"], "Cleaning Manual"), "Bunn Axiom-DV-APS - Cleaning Manual 2.pdf");
  assert.equal(shelfFileName("Bunn Axiom", "manuals", "x.pdf", []), "Bunn Axiom - Manual.pdf");
  assert.equal(shelfFileName("Bunn Axiom-DV-APS", "manuals", "x.pdf", [], "Service And Repair Manual"), "Bunn Axiom-DV-APS - Service And Repair Manual.pdf");
  // Parts files are not a manual type, and a parts-sounding name on Manuals asks instead of guessing.
  assert.equal(MANUAL_TYPES.includes("Parts Diagram"), false);
  assert.equal(MANUAL_TYPES.includes("Service And Repair Manual"), true);
  assert.equal(manualTypeFromName("Axiom Illustrated Parts Catalog.pdf"), null);
  assert.equal(shelfFileName("Bunn Axiom", "manuals", "x.pdf", [], "Parts Diagram"), "Bunn Axiom - Manual.pdf");
});

import { chipForDoc, docVariation, familyOf, nameKey } from "../src/lib/ops/library-file-rules.ts";

const bunn = [
  { id: 1, title: "BUNN Axiom", manufacturer: "BUNN" },
  { id: 2, title: "BUNN Axiom-15-3", manufacturer: "BUNN" },
  { id: 3, title: "BUNN Axiom-DV-APS", manufacturer: "BUNN" },
  { id: 4, title: "BUNN Axiom-Twin-APS", manufacturer: "BUNN" },
  { id: 5, title: "BUNN G9-2T HD Stainless", manufacturer: "BUNN" },
  { id: 6, title: "BUNN ITCB", manufacturer: "BUNN" },
  { id: 7, title: "BUNN Nitron", manufacturer: "BUNN" },
];

test("the family is the model's first word, up to the first dash or space", () => {
  assert.equal(familyOf("BUNN Axiom-DV-APS", "BUNN"), "Axiom");
  assert.equal(familyOf("BUNN Axiom", "BUNN"), "Axiom");
  assert.equal(familyOf("BUNN G9-2T HD Stainless", "BUNN"), "G9");
  assert.equal(familyOf("BUNN Nitron", "BUNN"), "Nitron");
  assert.equal(familyOf("Bunn Axiom 15-3 DV", "Bunn"), "Axiom");
  assert.equal(nameKey("Axiom DV APS"), nameKey("axiom-dv-aps"));
});

test("the first word of the document is the variation", () => {
  assert.deepEqual(docVariation("Axiom-DV-APS cleaning guide.pdf"), { word: "Axiom-DV-APS", maker: null });
  assert.deepEqual(docVariation("Bunn Axiom-35-3 manual.pdf", ["BUNN"]), { word: "Axiom-35-3", maker: "BUNN" });
  assert.equal(docVariation("41234.0001 rev C.pdf"), null);
  assert.equal(docVariation("Manual for the brewer.pdf"), null);
  assert.equal(docVariation("2024-03 scan.pdf"), null);
});

test("same variation name → same chip; a different name → no chip (a new one is made)", () => {
  assert.equal(chipForDoc("Axiom-DV-APS programming.pdf", bunn, "BUNN")?.id, 3);
  assert.equal(chipForDoc("axiom dv aps spec sheet.pdf", bunn, "BUNN")?.id, 3);
  assert.equal(chipForDoc("Axiom user guide.pdf", bunn, "BUNN")?.id, 1);
  assert.equal(chipForDoc("Nitron user guide.pdf", bunn, "BUNN")?.id, 7);
  assert.equal(chipForDoc("G9-2T HD Stainless spec.pdf", bunn, "BUNN")?.id, 5);
  // Never merged into a nearby model.
  assert.equal(chipForDoc("Axiom-35-3 cleaning guide.pdf", bunn, "BUNN"), null);
  assert.equal(chipForDoc("Axiom-DV cleaning guide.pdf", bunn, "BUNN"), null);
  assert.equal(chipForDoc("G9 parts.pdf", bunn, "BUNN"), null);
  assert.equal(chipForDoc("FPG manual.pdf", bunn, "BUNN"), null);
  // Maker in the name.
  assert.equal(chipForDoc("Bunn Axiom-Twin-APS manual.pdf", bunn)?.id, 4);
  // Not a model name.
  assert.equal(chipForDoc("41234.0001 rev C.pdf", bunn, "BUNN"), null);
});

import { customFileName } from "../src/lib/ops/library-file-rules.ts";

test("PM Guide is a manual type, and a typed file name keeps the file's extension", () => {
  assert.equal(MANUAL_TYPES.includes("PM Guide"), true);
  assert.equal(manualTypeFromName("Axiom-DV-APS PM checklist.pdf"), "PM Guide");
  assert.equal(manualTypeFromName("Axiom preventive maintenance.pdf"), "PM Guide");
  assert.deepEqual(customFileName("  Axiom-DV-APS - Annual PM  ", "old.pdf"), { name: "Axiom-DV-APS - Annual PM.pdf" });
  assert.deepEqual(customFileName("My guide.pdf", "old.pdf"), { name: "My guide.pdf" });
  assert.deepEqual(customFileName('Bad:"name"?', "old.docx"), { name: "Bad name.docx" });
  assert.ok("error" in customFileName(" ", "old.pdf"));
});

import { CHUNK_BYTES, CLEANUP_BOOKS, cleanupBookDecision, classifyImportDuplicates, collapseImportTargets, copiedManuals, docNumber, familyDuplicates, familyDuplicateGroups, importFailureSettled, importSkipReason, isMainChip, mainChipFor, removedCopies, shouldStartDownload, variationsOf, withDuplicateMarker } from "../src/lib/ops/library-file-rules.ts";

const fam = [
  { id: 1, title: "BUNN AXIOM", manufacturer: "BUNN" },
  { id: 2, title: "BUNN AXIOM-15-3 (2U/1L Warmer)", manufacturer: "BUNN" },
  { id: 3, title: "BUNN AXIOM-DV-APS", manufacturer: "BUNN" },
  { id: 4, title: "BUNN Axiom-DV-TC", manufacturer: "BUNN" },
  { id: 5, title: "BUNN G9-2T HD Stainless", manufacturer: "BUNN" },
  { id: 6, title: "BUNN ITCB", manufacturer: "BUNN" },
  { id: 7, title: "BUNN ITCB-DV", manufacturer: "BUNN" },
  { id: 8, title: "Fetco AXIOM", manufacturer: "Fetco" },
];
const famFiles = [
  { id: 10, section: "manuals", bookId: 1 },
  { id: 11, section: "spec", bookId: 1 },
  { id: 12, section: "parts", bookId: 1 },
  { id: 13, section: "manuals", bookId: 3 },
  { id: 14, section: "manuals", bookId: 6 },
];

test("the main chip is the variation named like its parent, and only when the family has another book", () => {
  assert.equal(isMainChip(fam[0], fam), true);
  assert.equal(isMainChip(fam[2], fam), false);
  assert.equal(isMainChip({ id: 43, title: "BUNN TB3", manufacturer: "BUNN" }, [{ id: 43, title: "BUNN TB3", manufacturer: "BUNN" }]), false);
  assert.equal(isMainChip({ id: 126, title: "Ditting 1403", manufacturer: "Ditting" }, [{ id: 126, title: "Ditting 1403", manufacturer: "Ditting" }]), false);
  assert.equal(isMainChip({ id: 142, title: "Vitrifrigo FG20i", manufacturer: "Vitrifrigo" }, [{ id: 142, title: "Vitrifrigo FG20i", manufacturer: "Vitrifrigo" }]), false);
  const eversys = [
    { id: 20, title: "Eversys Cameo", manufacturer: "Eversys" },
    { id: 21, title: "Eversys Cameo C'2s", manufacturer: "Eversys" },
    { id: 22, title: "Eversys Legacy", manufacturer: "Eversys" },
    { id: 23, title: "Eversys Legacy C'2s", manufacturer: "Eversys" },
  ];
  assert.equal(isMainChip(eversys[0], eversys), true);
  assert.equal(isMainChip(eversys[2], eversys), true);
  assert.equal(mainChipFor(fam[2], fam)?.id, 1);
  assert.equal(mainChipFor(fam[3], fam)?.id, 1);
  assert.equal(mainChipFor(fam[0], fam), null);
  // G9 has no chip named G9: nothing to copy from. ITCB has its own main chip. Another maker's Axiom is not ours.
  assert.equal(mainChipFor(fam[4], fam), null);
  assert.equal(mainChipFor(fam[6], fam)?.id, 6);
  assert.deepEqual(variationsOf(fam[0], fam).map((b) => b.id), [2, 3, 4]);
  assert.deepEqual(variationsOf(fam[2], fam), []);
});

test("main-chip manuals and parts show on every variation; spec sheets do not copy", () => {
  for (const v of [fam[1], fam[2], fam[3]]) assert.deepEqual(copiedManuals(v, fam, famFiles, []).map((f) => f.id), [10, 12]);
  assert.equal(copiedManuals(fam[2], fam, famFiles, []).some((f) => f.id === 11), false);
  // A parts file added on one variation stays on that variation only.
  const own = [...famFiles, { id: 20, section: "parts", bookId: 3 }];
  assert.equal(copiedManuals(fam[1], fam, own, []).some((f) => f.id === 20), false);
  assert.deepEqual(copiedManuals(fam[0], fam, famFiles, []), []);
  assert.deepEqual(copiedManuals(fam[6], fam, famFiles, []).map((f) => f.id), [14]);
  assert.deepEqual(copiedManuals(fam[4], fam, famFiles, []), []);
  // A manual added on a variation stays on that variation only.
  assert.equal(copiedManuals(fam[1], fam, famFiles, []).some((f) => f.id === 13), false);
});

test("removing a copy from one variation leaves the main chip and the others alone", () => {
  const hidden = [{ fileId: 10, bookId: 3 }];
  assert.deepEqual(copiedManuals(fam[2], fam, famFiles, hidden).map((f) => f.id), [12]);
  assert.deepEqual(removedCopies(fam[2], fam, famFiles, hidden).map((f) => f.id), [10]);
  assert.deepEqual(copiedManuals(fam[1], fam, famFiles, hidden).map((f) => f.id), [10, 12]);
  assert.deepEqual(copiedManuals(fam[3], fam, famFiles, hidden).map((f) => f.id), [10, 12]);
  // The same for a parts file: gone from one variation, still on the main chip and the others.
  const partGone = [{ fileId: 12, bookId: 4 }];
  assert.deepEqual(copiedManuals(fam[3], fam, famFiles, partGone).map((f) => f.id), [10]);
  assert.deepEqual(copiedManuals(fam[1], fam, famFiles, partGone).map((f) => f.id), [10, 12]);
  assert.equal(famFiles.some((f) => f.id === 12 && f.bookId === 1), true);
  assert.equal(famFiles.some((f) => f.id === 10 && f.bookId === 1), true);
});

test("uploads travel in 512 KB pieces", () => {
  assert.equal(CHUNK_BYTES, 512 * 1024);
});

test("FETCO letter-digit models share a series, and the older families stay as they were", () => {
  const of = (maker, model) => familyOf(`${maker} ${model}`, maker);
  assert.equal(of("Fetco", "CBS-1251"), of("Fetco", "CBS-1252"));
  assert.equal(of("Fetco", "CBS-1250"), of("Fetco", "CBS-1252"));
  assert.equal(of("Fetco", "CBS-1252"), "CBS-125");
  // The main chip is named like the family, and it stays in that family.
  assert.equal(of("Fetco", "CBS-125"), of("Fetco", "CBS-1252"));
  assert.notEqual(of("Fetco", "CBS-1231"), of("Fetco", "CBS-1251"));
  assert.equal(of("Fetco", "CBS-1231"), of("Fetco", "CBS-1232"));
  assert.equal(of("Fetco", "CBS-1231"), "CBS-123");
  assert.equal(of("Fetco", "GRS-1201"), "GRS-120");
  assert.equal(of("Fetco", "MBS-1221"), "MBS-122");
  assert.equal(of("Bunn", "GR-2.2"), of("Bunn", "GR-2.3"));
  assert.equal(of("Bunn", "GR-2.2"), "GR");
  assert.equal(familyOf("BUNN AXIOM-15-3 (2U/1L)", "BUNN"), "AXIOM");
  assert.equal(familyOf("BUNN AXIOM", "BUNN"), "AXIOM");
  assert.equal(familyOf("BUNN G9-2T HD Stainless", "BUNN"), "G9");
  assert.equal(familyOf("Eversys Enigma", "Eversys"), "Enigma");
  assert.equal(familyOf("Eversys Cameo C'2s", "Eversys"), "Cameo");
  assert.equal(familyOf("Eversys Legacy", "Eversys"), "Legacy");
  assert.equal(familyOf("Rancilio Classe 11", "Rancilio"), "Classe");
});

const fetco = [
  { id: 1, title: "Fetco CBS-1252", manufacturer: "Fetco" },
  { id: 2, title: "Fetco CBS-1251", manufacturer: "Fetco" },
  { id: 3, title: "Fetco CBS-1250", manufacturer: "Fetco" },
  { id: 4, title: "Fetco CBS-1231", manufacturer: "Fetco" },
  { id: 5, title: "Fetco CBS-125", manufacturer: "Fetco" },
];
const fetcoFiles = [
  { id: 10, name: "IPB 55012.pdf", size: 1000, section: "parts", bookId: 1 },
  { id: 11, name: "Shelf name.pdf", docName: "Other 55012.pdf", size: 1000, section: "parts", bookId: 2 },
  { id: 12, name: "Spec 55012.pdf", size: 1000, section: "spec", bookId: 2 },
  { id: 13, name: "Other 55012.pdf", size: 999, section: "parts", bookId: 2 },
  { id: 14, name: "CBS 55012.pdf", size: 1000, section: "parts", bookId: 4 },
  { id: 15, name: "Tied 55012.pdf", size: 1000, section: "manuals", bookId: 3, mpn: "FET-1" },
];

test("the document number is the last token of the file name", () => {
  assert.equal(docNumber("IPB 55012.pdf"), "55012");
  assert.equal(docNumber("Axiom-DV-APS cleaning guide.pdf"), "guide");
  assert.equal(docNumber("41234.0001.pdf"), "0001");
});

test("same size and document number in one family is a duplicate; spec sheets are not", () => {
  const hit = familyDuplicates({ name: "New 55012.pdf", size: 1000, section: "parts", bookId: 2 }, fetco, fetcoFiles).map((f) => f.id);
  assert.deepEqual(hit, [10]);
  // A spec sheet with the same size and number is not a duplicate, and neither is a different size or another series.
  assert.equal(familyDuplicates({ name: "New 55012.pdf", size: 1000, section: "spec", bookId: 2 }, fetco, fetcoFiles).length, 0);
  assert.equal(familyDuplicates({ name: "New 55012.pdf", size: 999, section: "parts", bookId: 1 }, fetco, fetcoFiles).some((f) => f.id === 10), false);
  assert.equal(familyDuplicates({ name: "New 55012.pdf", size: 1000, section: "parts", bookId: 1 }, fetco, fetcoFiles).some((f) => f.id === 14), false);
  // An MPN file stays on its variation.
  assert.equal(familyDuplicates({ name: "New 55012.pdf", size: 1000, section: "parts", bookId: 1 }, fetco, fetcoFiles).some((f) => f.id === 15), false);
  // Uploading onto the main chip is already one shared copy.
  assert.deepEqual(familyDuplicates({ name: "New 55012.pdf", size: 1000, section: "parts", bookId: 5 }, fetco, fetcoFiles), []);
  const groups = familyDuplicateGroups(fetco, fetcoFiles);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].family, "CBS-125");
  assert.equal(groups[0].docNumber, "55012");
  assert.deepEqual(groups[0].files.map((f) => f.id).sort((a, b) => a - b), [10, 11]);
  assert.equal(groups[0].files.some((f) => f.section === "spec"), false);
});

test("the empty duplicate books are removed only when the id, title and emptiness all match", () => {
  const empty = { id: 34, title: CLEANUP_BOOKS[0].title, files: 0, sheets: 0, fixes: 0, notes: 0 };
  assert.equal(cleanupBookDecision(CLEANUP_BOOKS[0], empty).action, "remove");
  assert.equal(cleanupBookDecision(CLEANUP_BOOKS[0], { ...empty, files: 1 }).action, "skip");
  assert.equal(cleanupBookDecision(CLEANUP_BOOKS[0], { ...empty, sheets: 1 }).action, "skip");
  assert.equal(cleanupBookDecision(CLEANUP_BOOKS[0], { ...empty, title: "BUNN AXIOM-15-3" }).action, "skip");
  assert.equal(cleanupBookDecision(CLEANUP_BOOKS[0], null).action, "missing");
  assert.equal(cleanupBookDecision(CLEANUP_BOOKS[1], { ...empty, id: 35, title: CLEANUP_BOOKS[1].title }).action, "remove");
});

const axiom = [
  { id: 1, title: "BUNN AXIOM", manufacturer: "BUNN" },
  { id: 2, title: "BUNN AXIOM-DV-APS", manufacturer: "BUNN" },
  { id: 3, title: "BUNN AXIOM-15-3 (2U/1L)", manufacturer: "BUNN" },
  { id: 4, title: "BUNN AXIOM-35-3", manufacturer: "BUNN" },
  { id: 5, title: "BUNN AXIOM-DV-TC", manufacturer: "BUNN" },
  { id: 6, title: "BUNN AXIOM-APS", manufacturer: "BUNN" },
];
const axiomName = (title) => `${title} - Manual 41154.0000`;

test("targets on all 5 BUNN AXIOM variations become one target on BUNN AXIOM", () => {
  const targets = [2, 3, 4, 5, 6].map((id) => ({
    bookId: id,
    section: "manuals",
    docType: "Programming Manual",
    name: axiomName(axiom.find((b) => b.id === id).title),
  }));
  const out = collapseImportTargets(targets, axiom);
  assert.equal(out.length, 1);
  assert.equal(out[0].bookId, 1);
  assert.equal(out[0].bookTitle, "BUNN AXIOM");
  assert.equal(out[0].name, "BUNN AXIOM - Manual 41154.0000");
  assert.equal(out.some((t) => t.missingBookId), false);
});

test("targets on 2 of 5 AXIOM variations stay on those books with the name unchanged", () => {
  const targets = [
    { bookId: 2, section: "manuals", docType: "Programming Manual", name: axiomName("BUNN AXIOM-DV-APS") },
    { bookId: 3, section: "manuals", docType: "Programming Manual", name: axiomName("BUNN AXIOM-15-3 (2U/1L)") },
  ];
  const out = collapseImportTargets(targets, axiom);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((t) => t.bookId), [2, 3]);
  assert.deepEqual(out.map((t) => t.name), [axiomName("BUNN AXIOM-DV-APS"), axiomName("BUNN AXIOM-15-3 (2U/1L)")]);
});

test("G1, G2, G3 and G9 grinders stay on their own books and no book is created", () => {
  const grinders = [
    { id: 10, title: "BUNN G1 HD", manufacturer: "BUNN" },
    { id: 11, title: "BUNN G2 HD", manufacturer: "BUNN" },
    { id: 12, title: "BUNN G3 HD", manufacturer: "BUNN" },
    { id: 13, title: "BUNN G9-2T DBC", manufacturer: "BUNN" },
  ];
  const targets = grinders.map((b) => ({ bookId: b.id, section: "manuals", docType: "User Manual", name: `${b.title} - Manual 46873.0000` }));
  const out = collapseImportTargets(targets, grinders);
  assert.equal(out.length, 4);
  assert.deepEqual(out.map((t) => t.bookId), [10, 11, 12, 13]);
  assert.deepEqual(out.map((t) => t.name), targets.map((t) => t.name));
  assert.equal(out.every((t) => grinders.some((b) => b.id === t.bookId)), true);
});

test("Rancilio Classe 9 USB and Classe 9 USB Tall stay on those books, not Rancilio Classe", () => {
  const classe = [
    { id: 20, title: "Rancilio Classe", manufacturer: "Rancilio" },
    { id: 21, title: "Rancilio Classe 5", manufacturer: "Rancilio" },
    { id: 22, title: "Rancilio Classe 7", manufacturer: "Rancilio" },
    { id: 23, title: "Rancilio Classe 9 USB", manufacturer: "Rancilio" },
    { id: 24, title: "Rancilio Classe 9 USB Tall", manufacturer: "Rancilio" },
  ];
  const targets = [
    { bookId: 23, section: "manuals", docType: "User Manual", name: "Rancilio Classe 9 USB - Manual 9USB" },
    { bookId: 24, section: "manuals", docType: "User Manual", name: "Rancilio Classe 9 USB Tall - Manual 9USB" },
  ];
  const out = collapseImportTargets(targets, classe);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((t) => t.bookId), [23, 24]);
  assert.deepEqual(out.map((t) => t.name), targets.map((t) => t.name));
  assert.equal(out.some((t) => t.bookId === 20), false);
});

test("a single-target manual whose family has no main chip stays on its book", () => {
  const books = [{ id: 30, title: "Mazzer Super Jolly", manufacturer: "Mazzer" }];
  const targets = [{ bookId: 30, section: "manuals", docType: "User Manual", name: "Mazzer Super Jolly - Manual SJ" }];
  const out = collapseImportTargets(targets, books);
  assert.equal(out.length, 1);
  assert.equal(out[0].bookId, 30);
  assert.equal(out[0].name, "Mazzer Super Jolly - Manual SJ");
  assert.equal(out[0].missingBookId, undefined);
});

test("a spec sheet never collapses", () => {
  const specs = collapseImportTargets(
    [
      { bookId: 3, section: "spec", docType: null, name: "BUNN AXIOM-15-3 (2U/1L) - Spec Sheet 38700.0000" },
      { bookId: 4, section: "spec", docType: null, name: "BUNN AXIOM-35-3 - Spec Sheet 38700.0002" },
    ],
    axiom,
  );
  assert.equal(specs.length, 2);
  assert.deepEqual(specs.map((t) => t.bookId), [3, 4]);
  assert.equal(specs[0].name, "BUNN AXIOM-15-3 (2U/1L) - Spec Sheet 38700.0000");
  assert.equal(specs[1].name, "BUNN AXIOM-35-3 - Spec Sheet 38700.0002");
});

test("a timeout or 5xx is not settled; 404 and Not a PDF are", () => {
  assert.equal(importFailureSettled("Timed out. will retry"), false);
  assert.equal(importFailureSettled("Download failed (503). will retry"), false);
  assert.equal(importFailureSettled("Could not download. network down. will retry"), false);
  assert.equal(importFailureSettled("Download failed (404)."), true);
  assert.equal(importFailureSettled("Download failed (410)."), true);
  assert.equal(importFailureSettled("Not a PDF."), true);
  assert.equal(importFailureSettled("Larger than 20 MB."), true);
});

test("skip when the same name is on the book, or the same size and document number is in the family", () => {
  const books = [
    { id: 1, title: "BUNN AXIOM", manufacturer: "BUNN" },
    { id: 2, title: "BUNN AXIOM-DV-APS", manufacturer: "BUNN" },
    { id: 9, title: "Fetco CBS-1252", manufacturer: "Fetco" },
  ];
  const files = [
    { name: "BUNN AXIOM - Programming 41154.0000", size: 1000, section: "manuals", bookId: 1, complete: true },
    { name: "BUNN AXIOM-DV-APS - Parts 55012.pdf", docName: "55012.pdf", size: 2000, section: "parts", bookId: 2, complete: true },
    { name: "Spec 55012.pdf", size: 2000, section: "spec", bookId: 2, complete: true },
    { name: "Unfinished.pdf", size: 1000, section: "manuals", bookId: 1, complete: false },
  ];
  assert.equal(
    importSkipReason({ name: "BUNN AXIOM - Programming 41154.0000", size: 5, section: "manuals", bookId: 1 }, books, files),
    "Already on this book with the same name.",
  );
  assert.equal(
    importSkipReason({ name: "BUNN AXIOM - Other 55012.pdf", size: 2000, section: "parts", bookId: 1 }, books, files),
    "A manual or parts file in this family already has this size and document number.",
  );
  assert.equal(importSkipReason({ name: "BUNN AXIOM-DV-APS - Spec 55012.pdf", size: 2000, section: "spec", bookId: 2 }, books, files), null);
  assert.equal(importSkipReason({ name: "Fetco CBS-1252 - Parts 55012.pdf", size: 2000, section: "parts", bookId: 9 }, books, files), null);
  assert.equal(importSkipReason({ name: "Unfinished.pdf", size: 1000, section: "manuals", bookId: 1 }, books, files), null);
  assert.equal(
    importSkipReason({ name: "BUNN AXIOM - 6 Month PM", size: 4000, section: "manuals", bookId: 1 }, books, [
      { name: "BUNN AXIOM - 12 Month PM", size: 4000, section: "manuals", bookId: 1, complete: true },
    ]),
    null,
  );
  assert.equal(
    importSkipReason(
      { name: "BUNN AXIOM - Programming 41154.0000", size: 5000, section: "manuals", bookId: 1 },
      books,
      [{ name: "BUNN AXIOM-DV-APS - Programming 41154.0000", size: 5000, section: "manuals", bookId: 2, complete: true }],
    ),
    "A manual or parts file in this family already has this size and document number.",
  );
  assert.equal(
    importSkipReason(
      { name: "BUNN AXIOM-15-3 (2U-1L) - Spec Sheet 38700.0000", size: 9, section: "spec", bookId: 2 },
      books,
      [{ name: "BUNN AXIOM-15-3 (2U-1L) - Spec Sheet 38700.0000.pdf", size: 9, section: "spec", bookId: 2, complete: true }],
    ),
    "Already on this book with the same name.",
  );
});

test("a download is not started once the run has used 150 seconds", () => {
  assert.equal(shouldStartDownload(149_999), true);
  assert.equal(shouldStartDownload(150_000), false);
  assert.equal(shouldStartDownload(150_001), false);
});

test("an import twin matches the older file once the extension is removed", () => {
  const files = [
    { id: 98, name: "X - Spec Sheet 38700.0000.pdf", size: 100, section: "spec", bookId: 3, fromImport: false },
    { id: 531, name: "X - Spec Sheet 38700.0000", size: 100, section: "spec", bookId: 3, fromImport: true },
    { id: 12, name: "BUNN AXIOM - 12 Month PM.pdf", size: 50, section: "manuals", bookId: 3, fromImport: false },
    { id: 600, name: "BUNN AXIOM - 12 Month PM", size: 50, section: "manuals", bookId: 3, fromImport: true },
    { id: 99, name: "X - Spec Sheet 38700.0000.pdf", size: 100, section: "spec", bookId: 4, fromImport: false },
    { id: 601, name: "X - Spec Sheet 38700.0000", size: 180, section: "spec", bookId: 4, fromImport: true },
    { id: 700, name: "X - Spec Sheet 38700.0000", size: 100, section: "spec", bookId: 9, fromImport: true },
  ];
  const out = classifyImportDuplicates(files);
  assert.equal(out.twins.length, 2);
  assert.deepEqual(out.twins.map((t) => [t.section, t.oldId, t.newId, t.size]), [
    ["manuals", 12, 600, 50],
    ["spec", 98, 531, 100],
  ]);
  assert.equal(out.differentSize.length, 1);
  assert.equal(out.differentSize[0].oldId, 99);
  assert.equal(out.differentSize[0].newId, 601);
  assert.equal(out.twins.some((t) => t.bookId === 9), false);
  assert.equal(withDuplicateMarker("X - Spec Sheet 38700.0000"), "X - Spec Sheet 38700.0000 - Duplicate To Delete");
  assert.equal(withDuplicateMarker("Guide.pdf"), "Guide - Duplicate To Delete.pdf");
});

test("Add Files: admin flag, Admin role, or Sales can edit; Service and no role cannot", () => {
  assert.equal(canEditFromRole({ is_admin: true, desk_role: null }), true);
  assert.equal(canEditFromRole({ is_admin: false, desk_role: "admin" }), true);
  assert.equal(canEditFromRole({ is_admin: false, desk_role: "sales" }), true);
  assert.equal(canEditFromRole({ is_admin: false, desk_role: "service" }), false);
  assert.equal(canEditFromRole({ is_admin: false, desk_role: null }), false);
  assert.equal(canEditFromRole(null), false);
});

