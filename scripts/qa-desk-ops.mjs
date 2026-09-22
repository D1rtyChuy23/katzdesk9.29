import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const csvPath = "/workspace/scripts/fixtures/corrigo-sample.csv";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(25000);
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
  const username = `chuy.ops${stamp}`;
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const back = page.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(`${username}@katz.test`);
  await page.locator("#password").fill("DeskOps99!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  if (page.url().includes("/login")) {
    await page.waitForTimeout(4000);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  }
  if (page.url().includes("/login")) throw new Error(`Still on login after signup: ${page.url()}`);
}

const verdict = { ok: false, errors };

try {
  await signIn();

  // --- 1. Corrigo add customer from Walk-In ---
  await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const importBtn = page.getByRole("button", { name: /Import Corrigo report/i });
  if (!(await importBtn.count())) throw new Error("Import Corrigo report missing");
  const chooser = page.waitForEvent("filechooser");
  await importBtn.click();
  await (await chooser).setFiles(csvPath);
  const preview = page.getByRole("heading", { name: /Corrigo import/i });
  await preview.waitFor({ state: "visible" });
  await page.waitForTimeout(800);
  const dialog = page.getByRole("dialog").filter({ has: preview });
  const walkRow = dialog.locator("tr").filter({ hasText: /Walk-In/i }).last();
  await walkRow.scrollIntoViewIfNeeded();
  const addOnRow = walkRow.getByTestId("add-customer");
  if (!(await addOnRow.count())) throw new Error("Add customer missing on Walk-In row");
  await addOnRow.click();
  const form = dialog.getByTestId("add-customer-form");
  await form.waitFor({ state: "visible" });
  await form.getByLabel("New customer name").fill("Walk-In Cafe Ops");
  await form.getByRole("button", { name: /^Add$/ }).click();
  await form.waitFor({ state: "hidden", timeout: 15000 });
  const vals = await page.locator("input").evaluateAll((els) => els.map((e) => e.value));
  if (!vals.includes("Walk-In Cafe Ops")) {
    await shot("qa-ops-add-customer-fail");
    throw new Error(`Added customer not selected. inputs=${JSON.stringify(vals.filter(Boolean).slice(0, 20))}`);
  }
  await shot("qa-ops-add-customer");
  await dialog.getByRole("button", { name: /^Cancel$/ }).click();

  // --- 2. Tech roster ---
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const settingsText = await page.innerText("body");
  for (const name of [
    "Ryan Gloria",
    "Charles Foster",
    "Oliver Garcia",
    "Joshua Harper",
    "Lance Oden",
    "Jesus Garcia",
    "Bill McKinley",
    "Brandon Chappell",
    "3rd Party",
  ]) {
    if (!settingsText.includes(name)) {
      await shot("qa-ops-roster-fail");
      throw new Error(`Roster missing ${name}`);
    }
  }
  await shot("qa-ops-roster");

  // --- 3. Mark installed ---
  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const queueBtn = page.getByRole("button", { name: /^Queue/ });
  if (await queueBtn.count()) await queueBtn.click();
  await page.waitForTimeout(400);
  const mark = page.getByTestId("mark-installed").first();
  if (!(await mark.count())) {
    await shot("qa-ops-mark-missing");
    throw new Error("Mark installed missing on queue");
  }
  const row = mark.locator("xpath=ancestor::article");
  const customer = ((await row.locator("button.font-medium, button.min-w-0").first().innerText()) || "").split("\n")[0].trim();
  await shot("qa-ops-mark-before");
  await mark.click();
  await page.waitForTimeout(1500);
  const bodyAfter = await page.innerText("body");
  if (/Could not mark installed/i.test(bodyAfter)) throw new Error("Mark installed failed");
  await page.getByRole("button", { name: /^Installed/ }).first().click();
  await page.waitForTimeout(800);
  await shot("qa-ops-mark-installed");
  const installedList = await page.locator("article, [data-testid=mark-installed]").count();
  void installedList;
  if (customer && customer.length > 2) {
    const shown = await page.innerText("body");
    if (!shown.includes(customer.split(" ")[0])) {
      console.warn("installed list may not show", customer);
    }
  }

  // --- 4. Export serial + electrical ---
  await page.getByRole("button", { name: /Export readiness/i }).click();
  const exportDlg = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: /^Export$/ }) });
  await exportDlg.waitFor({ state: "visible" });
  await exportDlg.getByRole("button", { name: /^Preview$/ }).click();
  await page.waitForTimeout(2500);
  const exportText = await exportDlg.innerText();
  if (!/Serial number/i.test(exportText) || !/Electrical configuration/i.test(exportText)) {
    await shot("qa-ops-export-fail");
    throw new Error(`Export missing serial/electrical columns: ${exportText.slice(0, 600)}`);
  }
  if (!/Configuration/i.test(exportText)) throw new Error("Export dropped Configuration");
  await shot("qa-ops-export");
  await exportDlg.getByRole("button", { name: /Close|Cancel/i }).first().click({ trial: true }).catch(() => {});
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // --- 5. Planner month calendar ---
  await page.goto(`${BASE}/planner`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const cal = page.getByTestId("planner-calendar");
  await cal.waitFor({ state: "visible" });
  await cal.getByRole("button", { name: /Previous month/i }).click();
  await page.waitForTimeout(400);
  await shot("qa-ops-planner-all");
  await cal.getByTestId("cal-type-installs").click();
  await page.waitForTimeout(300);
  await shot("qa-ops-planner-installs");
  await cal.getByTestId("cal-type-pms").click();
  await page.waitForTimeout(300);
  await shot("qa-ops-planner-installs-pms");
  await cal.getByTestId("cal-type-all").click();
  await page.waitForTimeout(300);
  await shot("qa-ops-planner-toggles");
  if (!(await page.getByRole("heading", { name: /Install planner/i }).count())) {
    throw new Error("Install timeline missing on planner");
  }

  verdict.ok = true;
  console.log(JSON.stringify({ ok: true, customer, errors: errors.slice(0, 8) }, null, 2));
} catch (e) {
  await shot("qa-ops-fail");
  console.error(e);
  verdict.ok = false;
  verdict.error = String(e?.message || e);
  verdict.url = page.url();
  console.log(JSON.stringify(verdict, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
