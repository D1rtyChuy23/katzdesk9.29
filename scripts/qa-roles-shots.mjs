import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const log = [];

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
  log.push(name);
}

try {
  const stamp = Date.now().toString(36).slice(-4);
  const owner = `chuy.cap${stamp}`;
  const mate = `liz.cap${stamp}`;
  const pass = "DeskRoles99!";

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const page = await ctx.newPage();

  async function signUp(p, username) {
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const t = p.getByRole("button", { name: /Need an account|Create one/i });
    if (await t.count()) await t.click();
    await p.locator("#username").fill(username);
    await p.locator("#email").fill(`${username}@katz.test`);
    await p.locator("#password").fill(pass);
    await p.getByRole("button", { name: "Create account" }).click();
    await p.waitForTimeout(5000);
  }

  await signUp(page, owner);
  const mateCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const matePage = await mateCtx.newPage();
  await signUp(matePage, mate);

  await page.goto(`${BASE}/access`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const ap = page.getByRole("button", { name: /^Approve$/ }).first();
  if (await ap.count()) await ap.click();
  await page.waitForTimeout(800);
  const ownerRow = page.locator("li").filter({ hasText: owner }).first();
  await ownerRow.locator('select[aria-label="Role"]').selectOption("sales");
  await page.waitForTimeout(500);
  const mateRow = page.locator("li").filter({ hasText: mate }).first();
  if (await mateRow.locator('select[aria-label="Role"]').count()) {
    await mateRow.locator('select[aria-label="Role"]').selectOption("service");
  }
  await ownerRow.scrollIntoViewIfNeeded();
  await shot(page, "qa-role-picker");

  try {
    await page.goto(`${BASE}/pipeline`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const allChip = page.getByRole("button", { name: /All deals/i });
    if (await allChip.count()) await allChip.click();
    await page.waitForTimeout(600);
    await page.locator("main").getByRole("button").filter({ hasText: /Needs good to order|Step / }).first().click({ timeout: 8000 });
    await page.waitForTimeout(1200);
    const ak = page.locator("label").filter({ hasText: /Avi Katz/ });
    if (await ak.count()) await ak.first().click({ force: true });
    await page.waitForTimeout(400);
    await shot(page, "qa-ak-field");
    await page.keyboard.press("Escape");
  } catch (e) {
    log.push("deal sheet: " + e.message);
    await shot(page, "qa-ak-field");
  }

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const due = page.locator("h2", { hasText: "Coming due" });
  if (await due.count()) {
    await due.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const row = page.locator("h2", { hasText: "Coming due" }).locator("xpath=following::a[1]");
    if (await row.count()) await row.hover();
  }
  await shot(page, "qa-coming-due");
  await shot(page, "qa-myview-sales");

  await page.goto(`${BASE}/access`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const ownerRow2 = page.locator("li").filter({ hasText: owner }).first();
  await ownerRow2.locator('select[aria-label="Role"]').selectOption("service");
  await page.waitForTimeout(600);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const due2 = page.locator("h2", { hasText: "Coming due" });
  if (await due2.count()) await due2.first().scrollIntoViewIfNeeded();
  await shot(page, "qa-myview-service");

  await page.goto(`${BASE}/planner`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  log.push("planner url " + page.url());
  const dateInputs = page.locator('input[type="date"]');
  const n = await dateInputs.count();
  log.push("date inputs " + n);
  const today = new Date();
  const dow = today.getUTCDay();
  const mon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + (dow === 0 ? -6 : 1 - dow)));
  const wed = new Date(mon);
  wed.setUTCDate(mon.getUTCDate() + 2);
  const day = wed.toISOString().slice(0, 10);
  // skip the filter from/to (last two in the filter row) — row dates are per-install
  if (n >= 4) {
    await dateInputs.nth(2).fill(day);
    await page.waitForTimeout(500);
    await dateInputs.nth(3).fill(day);
    await page.waitForTimeout(800);
  }
  await page.locator("h2", { hasText: "Install planner" }).first().scrollIntoViewIfNeeded();
  await shot(page, "qa-install-planner");

  await matePage.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await matePage.waitForTimeout(1500);
  await matePage.locator("main article button, main .border-b button, main button.font-medium").first().click();
  await matePage.waitForTimeout(1200);
  const ping = matePage.getByRole("button", { name: /^Ping$/ }).first();
  if (await ping.count()) {
    await ping.click();
    await matePage.waitForTimeout(500);
    const box = matePage.getByPlaceholder(/short note|@username/i);
    if (await box.count()) await box.fill("Need a gasket on this account before Friday.");
    const tgt = matePage.getByRole("button", { name: new RegExp(`@${owner}`) });
    if (await tgt.count()) await tgt.click();
    else {
      const tagged = matePage.getByRole("button", { name: /Ping tagged/i });
      if (await tagged.count()) await tagged.click();
    }
    await matePage.waitForTimeout(1000);
  }
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /notification/i }).click();
  await page.waitForTimeout(600);
  await shot(page, "qa-ping-inbox");
} catch (e) {
  log.push(String(e?.stack || e));
} finally {
  writeFileSync("/workspace/screenshots/qa-roles-shots.json", JSON.stringify(log, null, 2));
  console.log(log.join("\n"));
  await browser.close();
}
