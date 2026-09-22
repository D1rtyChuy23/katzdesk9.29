import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const owner = `chuy.ak3${Date.now().toString(36).slice(-4)}`;
const pass = "DeskRoles99!";
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
const t = page.getByRole("button", { name: /Need an account|Create one/i });
if (await t.count()) await t.click();
await page.locator("#username").fill(owner);
await page.locator("#email").fill(`${owner}@katz.test`);
await page.locator("#password").fill(pass);
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForTimeout(5000);
await page.goto(`${BASE}/installs?open=1`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const scroller = page.locator(".sheet-scroll").last();
if (await scroller.count()) {
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
}
await page.getByText("Avi Katz account").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: "/workspace/screenshots/qa-ak-field.png" });
console.log("ak visible", await page.getByText("Avi Katz account").count());
await browser.close();
