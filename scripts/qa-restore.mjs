import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const v = { ok: false, clock: false, customers: false, jobs: false, errors: [], steps: [] };
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => v.errors.push(String(e)));

try {
  const stamp = Date.now().toString(36).slice(-5);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const t = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await t.count()) await t.click();
  await page.locator("#username").fill(`chuy.rst${stamp}`);
  await page.locator("#email").fill(`chuy.rst${stamp}@katz.test`);
  await page.locator("#password").fill("DeskNetwork99!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(8000);

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByText(/SC-|flagged|Open calls|service tracker/i).first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  let body = await page.locator("body").innerText();
  v.clock = /SC-\d/.test(body);
  v.steps.push(`clock: ${body.slice(0, 400).replace(/\s+/g, " ")}`);
  await page.screenshot({ path: "/workspace/screenshots/restore-clock.png" });

  await page.goto(`${BASE}/customers`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Search customers").waitFor({ timeout: 15000 });
  await page.waitForTimeout(4000);
  body = await page.locator("body").innerText();
  v.customers = /The Gathery|Common Bond|Uptown Catering|[1-9]\d{2,} accounts/i.test(body);
  v.steps.push(`customers: ${body.slice(0, 400).replace(/\s+/g, " ")}`);
  await page.screenshot({ path: "/workspace/screenshots/restore-customers.png" });

  await page.goto(`${BASE}/service`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  body = await page.locator("body").innerText();
  v.jobs = /SC-\d/.test(body);
  v.steps.push(`service: ${body.slice(0, 300).replace(/\s+/g, " ")}`);
  await page.screenshot({ path: "/workspace/screenshots/restore-service.png" });
} catch (e) {
  v.errors.push(String(e));
}
v.ok = v.clock && v.customers && v.jobs && v.errors.length === 0;
writeFileSync("/workspace/screenshots/qa-restore.json", JSON.stringify(v, null, 2));
console.log(JSON.stringify(v, null, 2));
await browser.close();
process.exit(v.ok ? 0 : 1);
