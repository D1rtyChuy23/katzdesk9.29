import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const v = { ok: false, address: false, contact: false, noBigBubble: false, expanded: false, dup: false, errors: [], steps: [] };
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => v.errors.push(String(e)));

try {
  const stamp = Date.now().toString(36).slice(-5);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const t = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await t.count()) await t.click();
  await page.locator("#username").fill(`chuy.ppl${stamp}`);
  await page.locator("#email").fill(`chuy.ppl${stamp}@katz.test`);
  await page.locator("#password").fill("DeskNetwork99!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4500);

  await page.goto(`${BASE}/network`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /A-1 Restuarant/i }).first().click();
  await page.waitForTimeout(900);
  let body = await page.locator("body").innerText();
  v.address = /Odessa/i.test(body) && /Tulip/i.test(body);
  v.noBigBubble = !(await page.locator("textarea#contacts").count());
  await page.screenshot({ path: "/workspace/screenshots/network-address.png" });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /All Espresso Service/i }).first().click();
  await page.waitForTimeout(900);
  body = await page.locator("body").innerText();
  v.contact = /Lillie/i.test(body);
  const contactAdd = page.locator("#ppl-name").locator("xpath=ancestor::fieldset[1]").getByRole("button", { name: /^Add$/ });
  await page.locator("#ppl-name").fill("QA Tech");
  await page.locator("#ppl-phone").fill("713-555-0100");
  await contactAdd.click();
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  v.expanded = /QA Tech/.test(body) && /Lillie/i.test(body);
  await page.locator("#ppl-name").fill("QA Tech");
  await page.locator("#ppl-phone").fill("713-555-0100");
  await contactAdd.click();
  await page.waitForTimeout(600);
  body = await page.locator("body").innerText();
  v.dup = /Already listed/i.test(body);
  await page.screenshot({ path: "/workspace/screenshots/network-contacts.png" });
  v.steps.push(`addr=${v.address} contact=${v.contact} noBubble=${v.noBigBubble} expanded=${v.expanded} dup=${v.dup}`);
} catch (e) {
  v.errors.push(String(e));
}
v.ok = v.address && v.contact && v.noBigBubble && v.expanded && v.dup && v.errors.length === 0;
writeFileSync("/workspace/screenshots/qa-people.json", JSON.stringify(v, null, 2));
console.log(JSON.stringify(v, null, 2));
await browser.close();
process.exit(v.ok ? 0 : 1);
