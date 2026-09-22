import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const csvPath = "/workspace/scripts/fixtures/corrigo-sample.csv";
const rematchPath = "/workspace/scripts/fixtures/corrigo-sample-rematch.csv";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`page: ${e}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

async function signIn() {
  const stamp = Date.now().toString(36).slice(-4);
  const username = `chuy.corr${stamp}`;
  const email = `${username}@katz.test`;
  const pass = "DeskCorrigo99!";
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("katz-desk-pending");
    } catch {
      /* ignore */
    }
  });
  const back = page.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(5000);
}

async function importFile(path) {
  const importBtn = page.getByRole("button", { name: /Import Corrigo report/i });
  const chooser = page.waitForEvent("filechooser");
  await importBtn.click();
  const fileChooser = await chooser;
  await fileChooser.setFiles(path);
  await page.waitForTimeout(2500);
}

const verdict = { ok: false, errors };

try {
  await signIn();
  await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const importBtn = page.getByRole("button", { name: /Import Corrigo report/i });
  if (!(await importBtn.count())) throw new Error("Import Corrigo report button missing");
  await shot("corrigo-import-button");

  await importFile(csvPath);
  const preview = page.getByRole("heading", { name: /Corrigo import/i });
  if (!(await preview.count())) {
    await shot("corrigo-preview-missing");
    throw new Error("Preview dialog did not open");
  }
  const body = await page.locator("[role=dialog]").innerText();
  if (!/selected to update/i.test(body) || !/selected to create/i.test(body)) {
    throw new Error(`Preview missing counts: ${body.slice(0, 400)}`);
  }
  if (!/unchecked \(will skip\)/i.test(body)) {
    throw new Error(`Preview missing unchecked count: ${body.slice(0, 400)}`);
  }
  if (!(await page.getByRole("button", { name: /Select all/i }).count())) {
    throw new Error("Select all missing");
  }
  if (!(await page.getByRole("button", { name: /Deselect all/i }).count())) {
    throw new Error("Deselect all missing");
  }
  if (!(await page.getByRole("checkbox", { name: /Import WO-0888/i }).count())) {
    throw new Error("Row checkboxes missing");
  }
  if (!/WO-0550/.test(body) || !/WO-0888/.test(body) || !/unmapped/i.test(body)) {
    throw new Error(`Preview missing sample rows: ${body.slice(0, 500)}`);
  }
  if (!/matched as 9391 → WO-9391/i.test(body)) {
    throw new Error(`Missing 9391 match note: ${body.slice(0, 800)}`);
  }
  if (!/TLC \/ Factor/i.test(body) || !/Install/i.test(body) || !/\bPM\b/.test(body)) {
    throw new Error(`Missing TLC/PM/Install board labels: ${body.slice(0, 800)}`);
  }
  if (!/conflict/i.test(body)) {
    throw new Error(`Missing WO conflict row: ${body.slice(0, 800)}`);
  }
  if (!/will flag/i.test(body) && !/also on/i.test(body)) {
    throw new Error(`Conflict row should update the original and flag extras: ${body.slice(0, 800)}`);
  }
  if (/WO-9376[\s\S]{0,80}\bskip\b/i.test(body)) {
    throw new Error("WO-9376 should update the original ticket, not skip");
  }
  if (!/repeated after 9999/i.test(body) && !/used again after 9999/i.test(body)) {
    throw new Error(`WO wrap after 9999 not flagged: ${body.slice(0, 800)}`);
  }
  const walkKeep = page.getByRole("button", { name: /Keep as Walk-In/i });
  if (!(await walkKeep.count())) {
    await page.getByRole("checkbox", { name: /Import WO-2001/i }).scrollIntoViewIfNeeded().catch(() => {});
    await shot("corrigo-walkin-missing");
    throw new Error("Walk-In row missing Keep as Walk-In");
  }
  await walkKeep.scrollIntoViewIfNeeded();
  if (!(await page.getByPlaceholder(/Pick a customer/i).count())) {
    throw new Error("Walk-In customer picker should start empty");
  }
  await shot("corrigo-preview");

  await page.getByRole("checkbox", { name: /Import WO-1999/i }).uncheck();
  await page.getByRole("checkbox", { name: /Import WO-2001/i }).uncheck();
  await page.waitForTimeout(300);
  const afterUncheck = await page.locator("[role=dialog]").innerText();
  if (!/1 unchecked \(will skip\)/i.test(afterUncheck) && !/unchecked \(will skip\)/i.test(afterUncheck)) {
    throw new Error(`Uncheck did not update skip count: ${afterUncheck.slice(0, 400)}`);
  }
  await shot("corrigo-preview-unchecked");

  const confirmBtn = page.getByRole("button", { name: /Confirm import/i });
  if (await confirmBtn.isDisabled()) {
    throw new Error("Confirm stayed disabled after handling Walk-In / unchecked rows");
  }
  await confirmBtn.click();
  await page.waitForTimeout(3000);
  await shot("corrigo-after-confirm");
  const review = page.getByRole("heading", { name: /For review/i });
  if (!(await review.count())) throw new Error("Review list missing after confirm");
  const afterSave = await page.locator("body").innerText();
  if (/Skip Cafe/i.test(afterSave)) throw new Error("Unchecked WO-1999 was still imported");

  await importFile(rematchPath);
  const rematchDialog = page.locator("[role=dialog]");
  if (!(await rematchDialog.count())) throw new Error("Rematch preview did not open");
  const rematch = await rematchDialog.innerText();
  if (!/matched as WO5440 → WO-5440/i.test(rematch)) {
    throw new Error(`Rematch missing 5440 note: ${rematch.slice(0, 800)}`);
  }
  if (!/selected to update/i.test(rematch)) {
    throw new Error(`Rematch should update existing tickets: ${rematch.slice(0, 400)}`);
  }
  if (!/0 selected to create/i.test(rematch)) {
    throw new Error(`Rematch created a duplicate: ${rematch.slice(0, 400)}`);
  }
  if (!/\bPM\b/i.test(rematch)) {
    throw new Error(`Rematch missing PM update: ${rematch.slice(0, 400)}`);
  }
  await shot("corrigo-rematch-5440");
  await page.getByRole("button", { name: /Confirm import/i }).click();
  await page.waitForTimeout(2500);

  await page.getByRole("button", { name: /New Cafe Corrigo/i }).first().click();
  await page.waitForTimeout(1200);
  const work = page.getByLabel(/Description of work/i);
  if (!(await work.count())) throw new Error("Description of work field missing on ticket");
  const workVal = await work.inputValue();
  if (!/Reset boiler/i.test(workVal)) {
    throw new Error(`Description of work not filled: ${workVal}`);
  }
  const notes = page.getByLabel(/^Notes$/i);
  if (!(await notes.count())) throw new Error("Notes field missing — must remain on ticket");
  await shot("corrigo-ticket-work-done");

  const noteBox = page.getByPlaceholder(/Write a note/i);
  if (!(await noteBox.count())) throw new Error("Handoff note field missing on ticket");
  await noteBox.fill("Need a handoff check from service.");
  await page.getByRole("button", { name: /^Post$/ }).click();
  await page.waitForTimeout(1000);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await page.goto(`${BASE}/handoff`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const allToggle = page.getByRole("button", { name: "All", exact: true });
  if (await allToggle.count()) {
    await allToggle.click();
    await page.waitForTimeout(600);
  }
  const mineToggle = page.getByRole("button", { name: /^Mine/ });
  if (await mineToggle.count()) {
    await mineToggle.click();
    await page.waitForTimeout(600);
  }
  await page.getByText(/Need a handoff check from service/i).first().waitFor({ timeout: 8000 });
  const replyBtn = page.getByText("Reply", { exact: true }).first();
  if (!(await replyBtn.count())) {
    const labels = await page.locator("button").evaluateAll((els) =>
      els.slice(0, 50).map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()),
    );
    await shot("handoff-reply-missing");
    throw new Error(`Reply action missing on handoff. buttons=${JSON.stringify(labels)}`);
  }
  await shot("handoff-reply-button");
  await replyBtn.click();
  await page.waitForTimeout(400);
  const box = page.getByPlaceholder(/Write a reply/i);
  if (!(await box.count())) throw new Error("Reply box did not open on handoff");
  await box.fill("On it — parts are on the truck.");
  await page.getByRole("button", { name: /^Send$/ }).click();
  await page.waitForTimeout(1500);
  if (!/handoff/i.test(page.url())) throw new Error("Reply navigated away from Handoff");
  const after = await page.locator("body").innerText();
  if (!/On it — parts are on the truck/i.test(after) && !/On it — parts are on the truck/.test(after)) {
    throw new Error("Reply did not show on the handoff item");
  }
  if (!(await page.getByRole("heading", { name: /Open asks|Recent notes/i }).count())) {
    throw new Error("Handoff list disappeared after reply");
  }
  await shot("handoff-reply-sent");

  verdict.ok = true;
} catch (e) {
  verdict.errors.push(e instanceof Error ? e.message : String(e));
  await shot("corrigo-error").catch(() => {});
}

verdict.pageErrors = errors.slice(0, 12);
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.ok ? 0 : 1);
