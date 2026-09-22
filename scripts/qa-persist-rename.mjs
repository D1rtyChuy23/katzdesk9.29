import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const v = { ok: false, renamed: false, afterReload: false, autoSave: false, errors: [], steps: [] };
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => v.errors.push(String(e)));

try {
  const stamp = Date.now().toString(36).slice(-5);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const t = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await t.count()) await t.click();
  await page.locator("#username").fill(`chuy.ren${stamp}`);
  await page.locator("#email").fill(`chuy.ren${stamp}@katz.test`);
  await page.locator("#password").fill("DeskNetwork99!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(5000);

  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  v.steps.push(`url=${page.url()} body=${(await page.locator("body").innerText()).slice(0, 500).replace(/\s+/g, " ")}`);
  await page.getByLabel("Search customers").waitFor({ timeout: 15000 });
  await page.getByText(/[1-9]\d* accounts/).waitFor({ timeout: 60000 });
  await page.getByLabel("Search customers").fill("The Gathery");
  await page.waitForTimeout(500);
  const newName = `Persist Cafe ${stamp}`;
  const row = page.getByRole("button", { name: /The Gathery/i }).first();
  const original = ((await row.innerText()) || "").split("\n")[0].trim();
  v.steps.push(`open ${original}`);
  await row.click();
  await page.waitForTimeout(900);
  const nameField = page.getByLabel("Customer name");
  await nameField.waitFor({ timeout: 8000 });
  await nameField.fill(newName);
  await page.getByRole("button", { name: "Save name" }).click();
  await page.waitForTimeout(1200);
  let body = await page.locator("body").innerText();
  v.renamed = body.includes(newName);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  body = await page.locator("body").innerText();
  v.afterReload = body.includes(newName);
  v.steps.push(`renamed=${v.renamed} afterReload=${v.afterReload} orig=${original}`);

  await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /SC-/ }).first().click();
  await page.waitForTimeout(800);
  const combo = page.getByPlaceholder("Search customers…").first();
  if (await combo.count()) {
    await combo.fill(newName);
    await page.waitForTimeout(300);
    const opt = page.getByRole("option", { name: newName }).or(page.getByText(newName, { exact: true }));
    if (await opt.count()) await opt.first().click();
    else await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /SC-/ }).first().click();
    await page.waitForTimeout(700);
    v.autoSave = (await page.locator("body").innerText()).includes(newName);
  }
  await page.screenshot({ path: "/workspace/screenshots/persist-rename.png" });
} catch (e) {
  v.errors.push(String(e));
}
v.ok = v.renamed && v.afterReload && v.errors.length === 0;
writeFileSync("/workspace/screenshots/qa-persist-rename.json", JSON.stringify(v, null, 2));
console.log(JSON.stringify(v, null, 2));
await browser.close();
process.exit(v.ok ? 0 : 1);
