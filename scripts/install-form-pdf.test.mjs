// The Equipment Request Form's Download (10/23): an editable PDF with every value in a field, a Done box per checklist
// line and a Tech notes box in each section. Checked with pdf-lib (which builds it) and with pdf.js, the engine Firefox
// uses to show and fill PDFs, so the fields are known to work in a PDF app that didn't make them.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { buildInstallFormPdf, installFormPdfName, pdfSafeText, wrappedLines, TECH_NOTE_FIELDS } = await import("../src/lib/ops/install-form-pdf.ts");
const { PDFDocument, PDFCheckBox, PDFName, PDFRadioGroup, PDFTextField, StandardFonts } = await import("pdf-lib");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const NOW = new Date("2026-10-23T15:00:00Z");
const check = (labels, value = () => "") => labels.map((label) => ({ label, notes: value(label) }));
const PRE = [
  "Account inspected by",
  "Cold water source confirmed",
  "Power supply verified",
  "Space clearance (H/W/D) checked",
  "Pre-Inspection photos taken",
  "Cleaning/Care sheets & recipe cards ready",
  "Is there an opening order?",
  "Training needs identified",
  "Katz Coffee signage included",
  "Equipment sale/loan docs signed",
];
const TASKS = [
  "Water filtration (leak-free) Hardness Test/Dated",
  "Equipment calibrated to specs",
  "Test brew completed (coffee/tea) / TDS",
  "Parameters recorded",
  "Photos of equipment/filtration uploaded",
  "QR Code Training",
];
const CORRIGO = ["Equipment added to profile", "Serial numbers logged", "Equipment location details", "Install date added"];

/** Install #135 as the printed form shows it: three machines, recipes, a short serial, two WOs. */
function install135(over = {}) {
  return {
    id: 135,
    customer: "Bar By The Wayside",
    siteContact: "Braden",
    contactPhone: "",
    installDate: "Tue, Oct 20, 2026",
    accountRep: "Amanda Logg",
    address: "5644 Navigation Blvd, Houston, TX 77011",
    accountType: "update",
    technician: "Oliver Garcia",
    workOrders: ["WO-0859", "WO-0860"],
    inspector: "Amanda Logg",
    inspectedOn: "Oct 7, 2026",
    completedOn: "",
    rows: [
      { equipment: "MAZZER SUPER JOLLY V UP ELECTRONIC", serials: ["2626066"], qty: 1, terms: "Sold", outlet: "120V · 5-15P", plugs: ["5-15"], notes: [{ title: "Espresso", text: "Grind setting: 18 grams" }] },
      { equipment: "BUNN G9-2T", serials: ["G900046833"], qty: 1, terms: "Loan", outlet: "120V · NEMA 5-15P", plugs: ["5-15"], notes: [{ title: "Standard", text: "Coffee 1: Half pound batches" }] },
      { equipment: "LA MARZOCCO LINEA PB", serials: ["L"], qty: 1, terms: "", outlet: "220V", plugs: [], notes: [{ title: "", text: "Flip tray up for the pitcher" }] },
    ],
    pre: check(PRE, (l) => (l === "Account inspected by" ? "Amanda Logg" : l === "Equipment sale/loan docs signed" ? "PENDING" : l.startsWith("Cold") ? "YES" : "")),
    tasks: check(TASKS, (l) => (l.startsWith("Photos") ? "YES" : "")),
    corrigo: check(CORRIGO, (l) => (l === "Serial numbers logged" ? "YES" : "")),
    ...over,
  };
}

const PAGE = { w: 612, h: 792, margin: 36, bottom: 54 };

/** Every box on the page, with its field: where it is, and on which page. */
async function boxes(bytes) {
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  const out = [];
  for (const field of doc.getForm().getFields()) {
    for (const w of field.acroField.getWidgets()) {
      const page = pages.findIndex((p) => p.ref === w.P());
      out.push({ name: field.getName(), page, ...w.getRectangle() });
    }
  }
  return { doc, pages, boxes: out };
}

/** No box overlaps another, and each sits inside the margins, below its page's band and above the footer. */
function assertLaidOut({ pages, boxes: all }) {
  for (const b of all) {
    assert.ok(b.page >= 0, `${b.name} is on a page`);
    const bandBottom = PAGE.h - (b.page === 0 ? 92 : 64) - 7;
    // A box's outline is drawn centred on its edge, so its rectangle reaches half a border (0.375pt) past it.
    assert.ok(b.x >= PAGE.margin - 0.5 && b.x + b.width <= PAGE.w - PAGE.margin + 0.5, `${b.name} is inside the side margins`);
    assert.ok(b.y >= PAGE.bottom - 0.5 && b.y + b.height <= bandBottom, `${b.name} is between the band and the footer (page ${b.page + 1})`);
  }
  for (let p = 0; p < pages.length; p++) {
    const on = all.filter((b) => b.page === p);
    for (let i = 0; i < on.length; i++)
      for (let j = i + 1; j < on.length; j++) {
        const a = on[i];
        const b = on[j];
        const apart = a.x + a.width <= b.x + 0.01 || b.x + b.width <= a.x + 0.01 || a.y + a.height <= b.y + 0.01 || b.y + b.height <= a.y + 0.01;
        assert.ok(apart, `${a.name} and ${b.name} overlap on page ${p + 1}`);
      }
  }
}

async function pdfjsOpen(bytes) {
  return pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
}

async function pageText(doc, n) {
  const content = await (await doc.getPage(n)).getTextContent();
  return content.items
    .map((i) => i.str)
    .join(" ")
    .replace(/\s+/g, " ");
}

test("every value on the form is in a field that can be changed, with a Done box per checklist line and Tech notes in each section", async () => {
  const bytes = await buildInstallFormPdf(install135(), { now: NOW });
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const text = (name) => form.getTextField(name).getText() ?? "";
  assert.equal(text("customer"), "Bar By The Wayside");
  assert.equal(text("install_date"), "Tue, Oct 20, 2026");
  assert.equal(text("site_contact"), "Braden");
  assert.equal(text("contact_phone"), "");
  assert.equal(text("install_address"), "5644 Navigation Blvd, Houston, TX 77011");
  assert.equal(text("account_rep"), "Amanda Logg");
  assert.equal(text("technician"), "Oliver Garcia");
  assert.equal(form.getRadioGroup("account_type").getSelected(), "Update");
  assert.deepEqual(form.getRadioGroup("account_type").getOptions(), ["New account", "Update"]);

  // Each machine: model, serial, quantity, terms, outlet and notes, as the printed form has them.
  assert.equal(text("eq_1_equipment"), "MAZZER SUPER JOLLY V UP ELECTRONIC");
  assert.equal(text("eq_1_serial"), "2626066");
  assert.equal(text("eq_1_qty"), "1");
  assert.equal(text("eq_1_terms"), "Sold");
  assert.equal(text("eq_1_outlet"), "120V · 5-15P");
  assert.equal(text("eq_1_notes"), "Espresso — Grind setting: 18 grams");
  assert.equal(text("eq_2_terms"), "Loan");
  assert.equal(text("eq_3_serial"), "L");
  assert.equal(text("eq_3_notes"), "Flip tray up for the pitcher");
  // At least one blank row to write in an extra.
  assert.equal(text("eq_4_equipment"), "");

  // The checklists: the KatzDesk value in Notes, an empty Done box to tick.
  assert.equal(text("pre_1_notes"), "Amanda Logg");
  assert.equal(text("pre_2_notes"), "Yes");
  assert.equal(text("pre_10_notes"), "Pending");
  assert.equal(text("pre_verified_by"), "Amanda Logg");
  assert.equal(text("pre_date"), "Oct 7, 2026");
  assert.equal(text("tasks_5_notes"), "Yes");
  assert.equal(text("corrigo_2_notes"), "Yes");
  assert.equal(text("corrigo_work_orders"), "WO-0859, WO-0860");
  for (const [key, labels] of [["pre", PRE], ["tasks", TASKS], ["corrigo", CORRIGO]]) {
    labels.forEach((_, i) => {
      const box = form.getField(`${key}_${i + 1}_done`);
      assert.ok(box instanceof PDFCheckBox, `${key} line ${i + 1} has a Done box`);
      assert.equal(box.isChecked(), false);
    });
  }
  assert.equal(text("tech_name"), "Oliver Garcia");
  assert.equal(text("tech_signature"), "");
  assert.equal(text("owner_name"), "Chuy");

  // A Tech notes box in every section, empty and taking several lines.
  assert.deepEqual(Object.keys(TECH_NOTE_FIELDS), ["account", "equipment", "pre", "tasks", "corrigo", "signoff"]);
  for (const name of Object.values(TECH_NOTE_FIELDS)) {
    const f = form.getField(name);
    assert.ok(f instanceof PDFTextField, `${name} is a text box`);
    assert.equal(f.getText() ?? "", "");
    assert.ok(f.isMultiline(), `${name} takes several lines`);
    assert.equal(f.isReadOnly(), false);
  }
  // Nothing on the form is locked.
  for (const f of form.getFields()) assert.equal(f.isReadOnly(), false, `${f.getName()} can be changed`);

  const laid = await boxes(bytes);
  assert.equal(laid.pages.length, 3, "account and machines, then the checklists, then Corrigo and sign-off");
  assertLaidOut(laid);
  assert.equal(doc.getTitle(), "Equipment Request Form · Install #135 · Bar By The Wayside");
  assert.equal(doc.getPage(0).getSize().width, 612, "Letter");
});

test("pdf.js (Firefox's PDF viewer) sees every field, its name and value, and a note typed there saves into the file", async () => {
  const bytes = await buildInstallFormPdf(install135(), { now: NOW });
  const doc = await pdfjsOpen(bytes);
  assert.equal(doc.numPages, 3);
  const fields = await doc.getFieldObjects();
  const field = (name) => fields[name].find((f) => f.type);
  assert.equal(field("customer").value, "Bar By The Wayside");
  assert.equal(field("eq_1_notes").multiline, true);
  assert.equal(field("pre_1_done").type, "checkbox");
  assert.equal(field("pre_1_done").value, "Off");
  assert.deepEqual(
    fields.account_type.filter((f) => f.type).map((f) => f.type),
    ["radiobutton", "radiobutton"],
  );
  for (const name of Object.values(TECH_NOTE_FIELDS)) assert.equal(field(name).multiline, true, name);

  // Each box on the page says what it is, for screen readers and for apps that show it on tap.
  const annots = (await Promise.all([1, 2, 3].map(async (n) => (await doc.getPage(n)).getAnnotations()))).flat().filter((a) => a.subtype === "Widget");
  assert.equal(annots.length, Object.values(fields).reduce((n, f) => n + f.filter((x) => x.type).length, 0));
  for (const a of annots) assert.ok(a.alternativeText, `${a.fieldName} has a spoken name`);
  assert.equal(annots.find((a) => a.fieldName === "notes_pre").alternativeText, "Tech notes: Pre-installation checklist");

  const text1 = await pageText(doc, 1);
  for (const words of ["Equipment Request Form", "Equipment to install", "Page 1 of 3", "Install #135 · Bar By The Wayside", "· Account & install"]) assert.ok(text1.includes(words), `page 1 says ${words}`);
  // Small capitals are letter-spaced, so they read back a letter at a time.
  const squash = (t) => t.replace(/\s+/g, "");
  for (const words of ["ACCOUNT & INSTALL", "TECH NOTES", "SALES REP", "CUSTOMER", "ACCOUNT TYPE"]) assert.ok(squash(text1).includes(squash(words)), `page 1 says ${words}`);
  const text2 = await pageText(doc, 2);
  for (const words of ["Install Checklist & Sign-Off", "Pre-installation checklist", "Installation tasks", "Water filtration (leak-free) Hardness Test/Dated"]) assert.ok(text2.includes(words), `page 2 says ${words}`);
  const text3 = await pageText(doc, 3);
  for (const words of ["Corrigo account update tasks", "Sign-off", "Page 3 of 3"]) assert.ok(text3.includes(words), `page 3 says ${words}`);

  // Fill a Tech note and a Done box the way a PDF app does, save, and read the file back.
  const note = annots.find((a) => a.fieldName === TECH_NOTE_FIELDS.equipment);
  const done = annots.find((a) => a.fieldName === "tasks_1_done");
  doc.annotationStorage.setValue(note.id, { value: "Filter changed, hardness 4 gpg." });
  doc.annotationStorage.setValue(done.id, { value: true });
  const filled = await PDFDocument.load(await doc.saveDocument());
  assert.equal(filled.getForm().getTextField(TECH_NOTE_FIELDS.equipment).getText(), "Filter changed, hardness 4 gpg.");
  assert.equal(filled.getForm().getCheckBox("tasks_1_done").isChecked(), true);
  assert.equal(filled.getForm().getTextField("customer").getText(), "Bar By The Wayside");
  await doc.destroy();
});

test("the fonts the fields are typed in are listed on the form, so a PDF app can redraw a field as someone types", async () => {
  const doc = await PDFDocument.load(await buildInstallFormPdf(install135(), { now: NOW }));
  const acro = doc.catalog.getOrCreateAcroForm().dict;
  const fonts = acro.lookup(PDFName.of("DR")).lookup(PDFName.of("Font"));
  const listed = fonts.keys().map((k) => k.decodeText());
  for (const field of doc.getForm().getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    const da = field.acroField.getDefaultAppearance() ?? "";
    const font = /\/([^\s]+)\s+[\d.]+\s+Tf/.exec(da)?.[1];
    assert.ok(font && listed.includes(font), `${field.getName()} is typed in ${font}, which the form lists`);
  }
});

test("a long install runs onto more pages: the heading comes back, every row is whole, nothing overlaps", async () => {
  const many = Array.from({ length: 14 }, (_, i) => ({
    equipment: i % 3 ? `BUNN ITCB-DV ${i + 1}` : "EVERSYS CAMEO C'2S/ST CLASSIC WITH MILK",
    serials: i % 4 === 0 ? [`SN${1000 + i}`, `SN${2000 + i}`] : [`SN${1000 + i}`],
    qty: i % 4 === 0 ? 3 : 1,
    terms: ["Sold", "Loan", "Lease", ""][i % 4],
    outlet: "208/240V · 30A · L6-30P",
    plugs: [],
    notes: [
      { title: "", text: "Needs a dedicated circuit; the counter is 36 inches deep and the cabinet below is open." },
      { title: "House espresso", text: "Coffee 1: 18 g in, 38 g out, 28 seconds · Coffee 2: 20 g in, 42 g out · Milk: 140°F, light foam" },
    ],
  }));
  many[1].outlet = "208/240V · 30A · L6-30P / 120V · 20A · NEMA 5-20P";
  const customer = "Eversys Service:Black Rifle Coffee Company - Downtown Flagship Location";
  const bytes = await buildInstallFormPdf(install135({ rows: many, customer }), { now: NOW });
  const laid = await boxes(bytes);
  assertLaidOut(laid);
  const form = laid.doc.getForm();
  // Too long for one line, a name or an outlet takes two rather than being cut off.
  assert.equal(form.getTextField("customer").getText(), customer);
  assert.equal(form.getTextField("customer").isMultiline(), true);
  assert.equal(form.getTextField("eq_2_outlet").isMultiline(), true);
  assert.equal(form.getTextField("eq_3_outlet").isMultiline(), false);
  for (let n = 1; n <= 14; n++) assert.equal(form.getTextField(`eq_${n}_serial`).getText()?.split("\n")[0], `SN${1000 + n - 1}`);
  // Two blank rows to write in extras when the machines run on anyway.
  assert.equal(form.getTextField("eq_16_equipment").getText() ?? "", "");
  assert.ok(laid.pages.length >= 4, `pages: ${laid.pages.length}`);
  // A machine with three units gets a line for each serial; the two it has are filled in.
  assert.equal(form.getTextField("eq_1_serial").getText(), "SN1000\nSN2000");
  assert.equal(form.getTextField("eq_1_serial").isMultiline(), true);
  const doc = await pdfjsOpen(bytes);
  const text2 = await pageText(doc, 2);
  assert.ok(text2.includes("Equipment to Install, Continued"), "page 2's band says it continues");
  assert.ok(text2.includes("Equipment to install, continued"), "and the heading comes back over its rows");
  const last = await pageText(doc, doc.numPages);
  assert.ok(last.includes("Sign-off") && last.includes(`Page ${doc.numPages} of ${doc.numPages}`));
  await doc.destroy();
});

test("blank write-in rows give way so a short list keeps its Tech notes on page 1", async () => {
  // One machine: both blank rows fit.
  const one = await boxes(await buildInstallFormPdf(install135({ rows: install135().rows.slice(0, 1) }), { now: NOW }));
  const names1 = new Set(one.boxes.map((b) => b.name));
  assert.ok(names1.has("eq_2_equipment") && names1.has("eq_3_equipment") && !names1.has("eq_4_equipment"));
  assert.equal(one.boxes.find((b) => b.name === TECH_NOTE_FIELDS.equipment).page, 0);
  // Three units of one model with a long recipe: the second blank row goes, and the Tech notes stay with the machines.
  const itcb = {
    equipment: "BUNN ITCB-DV",
    serials: ["ITCB138003", "L"],
    qty: 3,
    terms: "",
    outlet: "220V",
    plugs: [],
    notes: [
      { title: "", text: "Flip tray up for the pitcher" },
      { title: "Espresso", text: "Coffee 1: 18 g in, 36 g out, 27 seconds · Coffee 2: 20 g in · Milk: steam to 140°F, stretch 3 seconds" },
    ],
  };
  const three = await boxes(await buildInstallFormPdf(install135({ rows: [...install135().rows.slice(0, 2), itcb] }), { now: NOW }));
  const names3 = new Set(three.boxes.map((b) => b.name));
  assert.ok(names3.has("eq_4_equipment") && !names3.has("eq_5_equipment"));
  assert.equal(three.boxes.find((b) => b.name === TECH_NOTE_FIELDS.equipment).page, 0);
  // Each checklist starts on the page after the machines, kept whole when it fits on one page.
  const page = (name) => three.boxes.find((b) => b.name === name).page;
  assert.equal(page("pre_1_done"), 1);
  assert.equal(page("pre_10_done"), 1);
  assert.equal(page("corrigo_1_done"), page("corrigo_4_done"));
  assert.equal(page(TECH_NOTE_FIELDS.corrigo), page("corrigo_1_done"));
  assert.equal(page("tech_signature"), page(TECH_NOTE_FIELDS.signoff));
});

test("New account is the choice ticked when the install is a new account", async () => {
  const doc = await PDFDocument.load(await buildInstallFormPdf(install135({ accountType: "new" }), { now: NOW }));
  const group = doc.getForm().getField("account_type");
  assert.ok(group instanceof PDFRadioGroup);
  assert.equal(group.getSelected(), "New account");
});

test("names and notes in any language never stop the download: letters the PDF fonts lack are spelled out or shown as ?", async () => {
  const odd = install135({
    customer: "Café Ñandú — “Ünïcode” → 東京 ☕",
    address: "12 Rue d’Œuf\nSuite 4\tBack door",
    rows: [{ equipment: "BUNN ITCB-DV", serials: ["ITCB…01"], qty: 1, terms: "Sold", outlet: "120V", plugs: [], notes: [{ title: "Latte ✓", text: "≥ 140°F · ½ milk −2%" }] }],
  });
  const bytes = await buildInstallFormPdf(odd, { now: NOW });
  const form = (await PDFDocument.load(bytes)).getForm();
  assert.equal(form.getTextField("customer").getText(), "Café Ñandú — “Ünïcode” -> ?? ?");
  assert.equal(form.getTextField("install_address").getText(), "12 Rue d’Œuf\nSuite 4 Back door");
  assert.equal(form.getTextField("eq_1_notes").getText(), "Latte — >= 140°F · ½ milk -2%");
  assert.equal(installFormPdfName(odd), "Equipment Request Form - Install 135 - Cafe Nandu Unicode.pdf");
  assert.equal(installFormPdfName({ id: 7, customer: "" }), "Equipment Request Form - Install 7.pdf");
  assert.equal(installFormPdfName({ id: 8, customer: "A/B: C*D?" }), "Equipment Request Form - Install 8 - A B C D.pdf");
});

test("pdfSafeText keeps lines only where a box takes several, and wrappedLines counts lines as the PDF app breaks them", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  assert.equal(pdfSafeText("a\nb\r\nc", font, true), "a\nb\nc");
  assert.equal(pdfSafeText("a\nb\r\nc", font), "a b c");
  assert.equal(pdfSafeText(null, font), "");
  assert.equal(pdfSafeText("\u200bzero\u00a0width", font), "zero width");
  assert.equal(wrappedLines("", font, 10, 100), 0);
  assert.equal(wrappedLines("short", font, 10, 100), 1);
  assert.equal(wrappedLines("one\ntwo", font, 10, 100), 2);
  const long = "word ".repeat(40).trim();
  const lines = wrappedLines(long, font, 10, 100);
  assert.ok(lines > 5, `${lines}`);
  // One word wider than the box stays on one line.
  assert.equal(wrappedLines("W".repeat(40), font, 10, 50), 1);
});
