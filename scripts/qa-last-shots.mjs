import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const mate = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pass = "DeskRoles99!";
const stamp = Date.now().toString(36).slice(-4);
const owner = `chuy.last${stamp}`;
const mateName = `liz.last${stamp}`;

async function signUp(p, username) {
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const t = p.getByRole("button", { name: /Need an account|Create one/i });
  if (await t.count()) await t.click();
  await p.locator("#username").fill(username);
  await p.locator("#email").fill(`${username}@katz.test`);
  await p.locator("#password").fill(pass);
  await p.getByRole("button", { name: "Create account" }).click();
  await p.waitForTimeout(4500);
}

await signUp(page, owner);
await signUp(mate, mateName);
await page.goto(`${BASE}/access`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const ap = page.getByRole("button", { name: /^Approve$/ }).first();
if (await ap.count()) await ap.click();
await page.waitForTimeout(700);
await page.locator("li").filter({ hasText: owner }).last().locator('select[aria-label="Role"]').selectOption("sales");
await page.waitForTimeout(400);
await page.locator("li").filter({ hasText: mateName }).last().locator('select[aria-label="Role"]').selectOption("service");
await page.locator("h2", { hasText: "Needs a role" }).scrollIntoViewIfNeeded().catch(() => {});
await page.screenshot({ path: "/workspace/screenshots/qa-role-picker.png" });

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
// My View on hides unassigned-rep rows for sales — turn it off to show the mixed board
const myView = page.getByRole("button", { name: /My View/ }).first();
if (await myView.getAttribute("aria-pressed") === "true") await myView.click();
await page.waitForTimeout(400);
await page.evaluate(() => {
  const h = [...document.querySelectorAll("h2")].find((n) => n.textContent.trim() === "Coming due");
  h?.closest("div.rounded-xl")?.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(500);
const due = page.locator("h2", { hasText: /^Coming due$/ }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
await due.screenshot({ path: "/workspace/screenshots/qa-coming-due.png" }).catch(() =>
  page.screenshot({ path: "/workspace/screenshots/qa-coming-due.png" }),
);
await page.screenshot({ path: "/workspace/screenshots/qa-myview-sales.png" });

await page.goto(`${BASE}/planner`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const day = await page.evaluate(() => {
  const t = new Date();
  const d = t.getDay();
  const mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() + (d === 0 ? -6 : 1 - d));
  const wed = new Date(mon);
  wed.setDate(mon.getDate() + 2);
  const p = (n) => String(n).padStart(2, "0");
  return `${wed.getFullYear()}-${p(wed.getMonth() + 1)}-${p(wed.getDate())}`;
});
await page.evaluate((day) => {
  const inputs = [...document.querySelectorAll("label")].filter((l) => /^\s*Date/.test(l.textContent || "")).map((l) => l.querySelector('input[type="date"]')).filter(Boolean);
  for (const el of inputs.slice(0, 2)) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, day);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}, day);
await page.waitForTimeout(1800);
await page.screenshot({ path: "/workspace/screenshots/qa-install-planner.png" });

await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /All installs/i }).click();
await page.waitForTimeout(500);
await page.locator("main").locator("button").filter({ hasText: /d$|today|needs date/i }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1200);
const opened = await page.evaluate(() => document.body.innerText.includes("Avi Katz account"));
if (!opened) {
  await page.locator("main article").first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: "/workspace/screenshots/qa-ak-field.png" });

const ping = page.getByRole("button", { name: /^Ping$/ }).first();
if (await ping.count()) {
  await ping.click();
  await page.waitForTimeout(500);
  const box = page.getByPlaceholder(/short note|@username/i);
  if (await box.count()) await box.fill(`Need a gasket on this account before Friday.`);
  await page.getByRole("button", { name: new RegExp(`@${mateName}`) }).last().click();
  await page.waitForTimeout(1000);
}

await mate.goto(`${BASE}/`, { waitUntil: "networkidle" });
await mate.waitForTimeout(3000);
await mate.getByRole("button", { name: /notification/i }).click();
await mate.waitForTimeout(800);
await mate.screenshot({ path: "/workspace/screenshots/qa-ping-inbox.png" });

console.log("last shots ok", day, "ak", opened);
await browser.close();
