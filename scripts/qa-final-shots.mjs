import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
const mate = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pass = "DeskRoles99!";
const stamp = Date.now().toString(36).slice(-4);
const ownerName = `chuy.fin${stamp}`;
const mateName = `liz.fin${stamp}`;

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

function shot(p, name) {
  return p.screenshot({ path: `/workspace/screenshots/${name}.png` });
}

await signUp(page, ownerName);
await signUp(mate, mateName);

await page.goto(`${BASE}/access`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const ap = page.getByRole("button", { name: /^Approve$/ }).first();
if (await ap.count()) await ap.click();
await page.waitForTimeout(800);
await page.locator("li").filter({ hasText: ownerName }).last().locator('select[aria-label="Role"]').selectOption("sales");
await page.waitForTimeout(400);
await page.locator("li").filter({ hasText: mateName }).last().locator('select[aria-label="Role"]').selectOption("service");
await page.locator("li").filter({ hasText: ownerName }).last().scrollIntoViewIfNeeded();
await shot(page, "qa-role-picker");

// Coming due on sales clock — scroll the PANEL, not the KPI
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const h = [...document.querySelectorAll("h2")].find((n) => n.textContent?.trim() === "Coming due");
  h?.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(400);
await shot(page, "qa-coming-due");
await shot(page, "qa-myview-sales");

// Service view
await page.goto(`${BASE}/access`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.locator("li").filter({ hasText: ownerName }).last().locator('select[aria-label="Role"]').selectOption("service");
await page.waitForTimeout(600);
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const h = [...document.querySelectorAll("h2")].find((n) => n.textContent?.trim() === "Coming due");
  h?.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(300);
await shot(page, "qa-myview-service");

// Installs sheet for AK + rep
await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("main article button, main .font-medium").first().click();
await page.waitForTimeout(1500);
await shot(page, "qa-ak-field");

// Planner with conflict
await page.goto(`${BASE}/planner`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const day = await page.evaluate(() => {
  const t = new Date();
  const d = t.getDay();
  const mon = new Date(t);
  mon.setDate(t.getDate() + (d === 0 ? -6 : 1 - d));
  const wed = new Date(mon);
  wed.setDate(mon.getDate() + 2);
  return wed.toISOString().slice(0, 10);
});
await page.evaluate((day) => {
  const inputs = [...document.querySelectorAll('input[type="date"]')].filter((el) => {
    const lab = el.closest("label");
    return lab && /Date/i.test(lab.textContent || "");
  });
  for (const el of inputs.slice(0, 2)) {
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    proto.set.call(el, day);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}, day);
await page.waitForTimeout(1500);
await shot(page, "qa-install-planner");

// Ping mate from a flagged row
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const pingBtns = page.getByRole("button", { name: /^Ping$/ });
if (await pingBtns.count()) {
  await pingBtns.first().click();
  await page.waitForTimeout(600);
  const box = page.getByPlaceholder(/short note|@username/i);
  if (await box.count()) await box.fill(`Need a gasket before Friday @${mateName}`);
  const tgt = page.getByRole("button", { name: new RegExp(`@${mateName}`) });
  if (await tgt.count()) await tgt.click();
  else if (await page.getByRole("button", { name: /Ping tagged/i }).count()) {
    await page.getByRole("button", { name: /Ping tagged/i }).click();
  }
  await page.waitForTimeout(1200);
}

await mate.goto(`${BASE}/`, { waitUntil: "networkidle" });
await mate.waitForTimeout(3000);
await mate.getByRole("button", { name: /notification/i }).click();
await mate.waitForTimeout(700);
await shot(mate, "qa-ping-inbox");

console.log("done", day);
await browser.close();
