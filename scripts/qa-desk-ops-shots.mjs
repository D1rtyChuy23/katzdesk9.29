import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const csvPath = "/workspace/scripts/fixtures/corrigo-sample.csv";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(25000);

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

const stamp = Date.now().toString(36).slice(-4);
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
if (await createToggle.count()) await createToggle.click();
await page.locator("#username").fill(`chuy.shot${stamp}`);
await page.locator("#email").fill(`chuy.shot${stamp}@katz.test`);
await page.locator("#password").fill("DeskOps99!");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForTimeout(2500);
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
if (page.url().includes("/login")) {
  await page.waitForTimeout(4000);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
}
if (page.url().includes("/login")) throw new Error("login failed");

try {
  await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Import Corrigo report/i }).click();
  await (await chooser).setFiles(csvPath);
  const preview = page.getByRole("heading", { name: /Corrigo import/i });
  await preview.waitFor({ state: "visible" });
  const dialog = page.getByRole("dialog").filter({ has: preview });
  const walkRow = dialog.locator("tr").filter({ hasText: /Walk-In/i }).last();
  await walkRow.scrollIntoViewIfNeeded();
  await walkRow.getByTestId("add-customer").click();
  const form = dialog.getByTestId("add-customer-form");
  await form.waitFor({ state: "visible" });
  await form.getByLabel("New customer name").fill("Walk-In Cafe Ops");
  await shot("qa-ops-add-customer");
  await form.getByRole("button", { name: /^Add$/ }).click();
  await form.waitFor({ state: "hidden", timeout: 15000 });
  const vals = await page.locator("input").evaluateAll((els) => els.map((e) => e.value));
  if (!vals.includes("Walk-In Cafe Ops")) throw new Error("customer not selected after add");
  await shot("qa-ops-add-customer-selected");
  await dialog.getByRole("button", { name: /^Cancel$/ }).click();

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const boardBtn = page.locator("#desk-main").getByRole("button", { name: "Board", exact: true }).last();
  if (await boardBtn.count()) await boardBtn.click();
  await page.waitForTimeout(400);
  const mark = page.getByTestId("mark-installed").first();
  await mark.waitFor({ state: "visible" });
  const card = mark.locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
  const who = ((await card.locator("p.font-medium").first().innerText()) || "").split("\n")[0].trim();
  await shot("qa-ops-mark-before");
  const readyBefore = await page.getByTestId("mark-installed").count();
  await mark.click();
  await page.waitForTimeout(1800);
  const readyAfter = await page.getByTestId("mark-installed").count();
  if (readyAfter >= readyBefore) throw new Error(`Mark installed did not leave prep (${readyBefore} → ${readyAfter})`);
  await page.getByRole("button", { name: /^Installed/ }).first().click();
  await page.waitForTimeout(800);
  await shot("qa-ops-mark-installed");
  const listed = await page.innerText("body");
  if (who && !listed.includes(who.split(" ")[0])) {
    console.warn("installed list missing", who);
  }

  await page.goto(`${BASE}/planner`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const cal = page.getByTestId("planner-calendar");
  await cal.waitFor({ state: "visible" });
  await cal.getByRole("button", { name: /Previous month/i }).click();
  await page.waitForTimeout(400);
  const scheduled = async () => {
    const t = await cal.locator("p").filter({ hasText: /scheduled/ }).innerText();
    const n = Number((t.match(/(\d+) scheduled/) || [])[1] || 0);
    return n;
  };
  const allN = await scheduled();
  await shot("qa-ops-planner-all");
  await cal.getByTestId("cal-type-installs").click();
  await page.waitForTimeout(400);
  const instN = await scheduled();
  if (!(instN < allN) && allN > 0) throw new Error(`Installs toggle did not filter (${instN} vs all ${allN})`);
  const instText = await cal.innerText();
  if (/\bPM\b/.test(instText.split("Month")[1] || instText) && /Kol Fac/.test(instText)) {
    // Kol Fac is a PM in August — must not remain when Installs-only
    if (instText.includes("Kol Fac")) throw new Error("PM still visible after Installs toggle");
  }
  await shot("qa-ops-planner-installs");
  await cal.getByTestId("cal-type-pms").click();
  await page.waitForTimeout(300);
  await shot("qa-ops-planner-installs-pms");
  await cal.getByTestId("cal-type-all").click();
  await page.waitForTimeout(300);
  await shot("qa-ops-planner-toggles");

  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.getByRole("heading", { name: /Service tech roster/i }).scrollIntoViewIfNeeded();
  await shot("qa-ops-roster");

  console.log(JSON.stringify({ ok: true, who, readyBefore, readyAfter, allN, instN }, null, 2));
} catch (e) {
  await shot("qa-ops-fail");
  console.error(e);
  console.log(JSON.stringify({ ok: false, error: String(e?.message || e), url: page.url() }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
