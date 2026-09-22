import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(15000);
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
if (await createToggle.count()) await createToggle.click();
const stamp = Date.now().toString(36).slice(-4);
await page.locator("#username").fill(`chuy.ov${stamp}`);
await page.locator("#email").fill(`chuy.ov${stamp}@katz.test`);
await page.locator("#password").fill("DeskEquip99!");
await page.getByRole("button", { name: "Create account" }).click();
for (let i = 0; i < 15; i++) {
  const t = await page.locator("body").innerText();
  if (/Service tracker|Operations clock|waiting for approval/i.test(t)) break;
  await page.waitForTimeout(700);
}
await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /New call/i }).click();
await page.waitForTimeout(600);
const dialog = page.getByRole("dialog");
await dialog.getByRole("combobox").nth(1).click();
const opts = dialog.getByRole("option");
await opts.nth(0).click();
await page.waitForTimeout(200);
await opts.nth(2).click();
await page.waitForTimeout(200);
await dialog.getByLabel(/Issue/i).click();
await page.waitForTimeout(200);

const boxes = await dialog.evaluate(() => {
  const root = document.querySelector('[role="dialog"]');
  if (!root) return [];
  const els = [...root.querySelectorAll("li, p, input, label")];
  return els.slice(0, 20).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      text: (el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 48),
      y: Math.round(r.y),
      h: Math.round(r.height),
      x: Math.round(r.x),
      w: Math.round(r.width),
    };
  });
});
console.log(JSON.stringify(boxes, null, 2));
await page.screenshot({ path: "/workspace/screenshots/qa-ticket-equipment.png" });
await browser.close();
