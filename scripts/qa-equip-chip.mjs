import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(15000);

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
if (await createToggle.count()) await createToggle.click();
const stamp = Date.now().toString(36).slice(-4);
await page.locator("#username").fill(`chuy.eq${stamp}`);
await page.locator("#email").fill(`chuy.eq${stamp}@katz.test`);
await page.locator("#password").fill("DeskEquip99!");
await page.getByRole("button", { name: "Create account" }).click();
for (let i = 0; i < 15; i++) {
  const t = await page.locator("body").innerText();
  if (/Operations clock|Service tracker|waiting for approval/i.test(t)) break;
  await page.waitForTimeout(700);
}
await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /New call/i }).click();
await page.waitForTimeout(800);
const dialog = page.getByRole("dialog");
const boxes = dialog.getByRole("combobox");
const equip = boxes.nth(1);
await equip.click();
await page.waitForTimeout(400);
const opts = dialog.getByRole("option");
const pick = async (i) => {
  const o = opts.nth(i);
  if (await o.count()) {
    const label = (await o.innerText()).trim();
    await o.click();
    return label;
  }
  return "";
};
const a = await pick(0);
const b = await pick(2);
await dialog.getByLabel(/Issue/i).click();
await page.waitForTimeout(400);
const text = await dialog.innerText();
console.log("picked", a, b);
console.log("---DIALOG---");
console.log(text);
await page.screenshot({ path: "/workspace/screenshots/qa-ticket-equipment.png" });
await browser.close();
