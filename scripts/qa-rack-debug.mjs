import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const stamp = Date.now().toString(36).slice(-4);
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
if (await createToggle.count()) await createToggle.click();
await page.locator("#username").fill(`chuy.rk${stamp}`);
await page.locator("#email").fill(`chuy.rk${stamp}@katz.test`);
await page.locator("#password").fill("DeskCombo99!");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForTimeout(4000);
await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.locator("article").first().locator("button").nth(1).click();
await page.waitForTimeout(1000);
const warehouse = page.locator("#warehouse-units");
console.log("warehouse", await warehouse.count(), (await warehouse.innerText()).slice(0, 300));
await warehouse.scrollIntoViewIfNeeded();
const combos = await warehouse.getByRole("combobox").all();
console.log("combos", combos.length);
for (const c of combos) console.log("combo name", await c.getAttribute("aria-label"), await c.evaluate(el => el.outerHTML.slice(0, 200)));
if (combos[0]) {
  await combos[0].click();
  await page.waitForTimeout(800);
}
console.log("popovers", await page.locator("[data-combo-popover]").count());
const pops = page.locator("[data-combo-popover]");
const n = await pops.count();
for (let i = 0; i < n; i++) {
  const t = await pops.nth(i).innerText();
  console.log("pop", i, "len", t.length, t.slice(0, 180).replace(/\n/g, " | "));
}
await page.screenshot({ path: "/workspace/screenshots/combo-rack-debug.png" });
await browser.close();
