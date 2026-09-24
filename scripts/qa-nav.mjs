import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-4);
const admin = `chuy.nav${stamp}`;
const pass = "DeskOps99!!";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(admin);
  await page.locator("#email").fill(`${admin}@katz.test`);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(1800);
  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  const nav = page.locator("aside nav");
  await nav.waitFor({ timeout: 10000 });
  const text = await nav.innerText();
  const more = /\bMore\b/.test(text);
  const needed = [
    "Work",
    "Tickets",
    "TLC + Factor",
    "PMs",
    "Coming due",
    "Planner",
    "Handoff",
    "Installs",
    "Board",
    "Recipes",
    "Pipeline",
    "Shop",
    "Warehouse",
    "Rebuilds",
    "Locations",
    "Modules",
    "Accounts",
    "Customers",
    "Out of Network",
    "Admin",
    "Settings",
  ];
  const missing = needed.filter((n) => !text.includes(n));
  console.log(JSON.stringify({ more, missing, text }));
  if (more || missing.length) process.exitCode = 1;
  await nav.screenshot({ path: "/workspace/screenshots/qa-nav.png" });
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  await page.screenshot({ path: "/workspace/screenshots/qa-nav-fail.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
