import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
const pass = "DeskRoles99!";
const owner = `chuy.dbg${Date.now().toString(36).slice(-4)}`;
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
const t = page.getByRole("button", { name: /Need an account|Create one/i });
if (await t.count()) await t.click();
await page.locator("#username").fill(owner);
await page.locator("#email").fill(`${owner}@katz.test`);
await page.locator("#password").fill(pass);
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForTimeout(5000);
await page.goto(`${BASE}/access`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.locator("li").filter({ hasText: owner }).last().locator('select[aria-label="Role"]').selectOption("sales");
await page.waitForTimeout(800);
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].map((n) => n.textContent.trim());
  const coming = [...document.querySelectorAll("h2")].find((n) => n.textContent.trim() === "Coming due");
  return {
    h2,
    hasComing: !!coming,
    header: document.querySelector("h1")?.textContent,
    sub: document.querySelector("header p.mt-1")?.textContent,
    comingParent: coming?.parentElement?.innerText?.slice(0, 400) ?? null,
  };
});
console.log(JSON.stringify(info, null, 2));
if (info.hasComing) {
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((n) => n.textContent.trim() === "Coming due");
    h?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/workspace/screenshots/qa-coming-due.png" });
}
await page.goto(`${BASE}/planner`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const pinfo = await page.evaluate(() => ({
  url: location.pathname,
  h1: document.querySelector("h1")?.textContent,
  h2: [...document.querySelectorAll("h2")].map((n) => n.textContent.trim()),
  dates: document.querySelectorAll('input[type="date"]').length,
}));
console.log("planner", pinfo);
await page.screenshot({ path: "/workspace/screenshots/qa-install-planner.png" });

await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /All installs/i }).click().catch(() => {});
await page.waitForTimeout(400);
const cust = page.locator("article button.min-w-0, article .font-medium").first();
await cust.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "/workspace/screenshots/qa-ak-field.png" });
const sheet = await page.evaluate(() => document.body.innerText.includes("Avi Katz account"));
console.log("ak in body", sheet);

await browser.close();
