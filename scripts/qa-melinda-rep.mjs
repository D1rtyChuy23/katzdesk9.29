import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(20000);

const stamp = Date.now().toString(36).slice(-4);
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
if (await createToggle.count()) await createToggle.click();
await page.locator("#username").fill(`chuy.mw${stamp}`);
await page.locator("#email").fill(`chuy.mw${stamp}@katz.test`);
await page.locator("#password").fill("DeskRep99!");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForTimeout(4000);

await page.goto(`${BASE}/pipeline`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /New deal/i }).click();
const dialog = page.getByRole("dialog");
await dialog.waitFor({ state: "visible" });
const options = await dialog.locator("select, [name=producer]").first().locator("option").allTextContents();
const text = options.join(" | ") || (await dialog.innerText());
const has = /Melinda Warden \(MW\)/.test(text) || options.some((o) => /Melinda Warden/.test(o) && /MW/.test(o));
await page.screenshot({ path: "/workspace/screenshots/qa-melinda-rep.png" });
console.log(JSON.stringify({ has, options: options.filter(Boolean).slice(0, 20) }, null, 2));
if (!has) {
  console.error("Melinda Warden (MW) missing from deal rep dropdown");
  process.exit(1);
}
await browser.close();
