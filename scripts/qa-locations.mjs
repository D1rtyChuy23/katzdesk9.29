import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const v = {
  ok: false,
  grouped: false,
  duplicateNote: false,
  added: false,
  errors: [],
  steps: [],
};
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => v.errors.push(String(e)));

try {
  const stamp = Date.now().toString(36).slice(-5);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const t = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await t.count()) await t.click();
  await page.locator("#username").fill(`chuy.loc${stamp}`);
  await page.locator("#email").fill(`chuy.loc${stamp}@katz.test`);
  await page.locator("#password").fill("DeskNetwork99!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4500);

  await page.goto(`${BASE}/network`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /ETSC/ }).first().click();
  await page.waitForTimeout(1200);
  const body0 = await page.locator("body").innerText();
  v.grouped = /Coverage/.test(body0) && (/\bKS\b/.test(body0) || /Statewide/.test(body0) || /67456/.test(body0));
  v.steps.push(`sheetHasKS=${/\bKS\b/.test(body0)} hasCoverage=${/Coverage/.test(body0)} hasStatewide=${/Statewide/.test(body0)}`);
  await page.screenshot({ path: "/workspace/screenshots/network-locations.png" });
  v.steps.push(`grouped=${v.grouped}`);

  await page.locator("#loc-state").selectOption("TX");
  await page.locator("#loc-city").fill("Houston");
  await page.locator("#loc-zip").fill("77002");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await page.waitForTimeout(700);
  let body = await page.locator("body").innerText();
  v.added = /Houston/.test(body) && /77002/.test(body);

  await page.locator("#loc-state").selectOption("TX");
  await page.locator("#loc-city").fill("Houston");
  await page.locator("#loc-zip").fill("77002");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await page.waitForTimeout(700);
  body = await page.locator("body").innerText();
  v.duplicateNote = /Already listed/i.test(body);
  await page.screenshot({ path: "/workspace/screenshots/network-dup-location.png" });
  v.steps.push(`added=${v.added} dup=${v.duplicateNote}`);
} catch (e) {
  v.errors.push(String(e));
}
v.ok = v.grouped && v.added && v.duplicateNote && v.errors.length === 0;
writeFileSync("/workspace/screenshots/qa-locations.json", JSON.stringify(v, null, 2));
console.log(JSON.stringify(v, null, 2));
await browser.close();
process.exit(v.ok ? 0 : 1);
