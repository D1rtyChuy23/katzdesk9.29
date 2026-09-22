import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const v = { ok: false, title: false, nav: false, removed: false, stillGone: false, errors: [], steps: [] };

function attach(page) {
  page.on("pageerror", (e) => errors.push(String(e)));
}

async function signup(page) {
  const stamp = Date.now().toString(36).slice(-5);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const t = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await t.count()) await t.click();
  await page.locator("#username").fill(`chuy.rm${stamp}`);
  await page.locator("#email").fill(`chuy.rm${stamp}@katz.test`);
  await page.locator("#password").fill("DeskNetwork99!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4500);
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
attach(page);
try {
  await signup(page);
  await page.goto(`${BASE}/network`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  v.title = /Out of Network/.test(body);
  v.nav = (await page.getByRole("link", { name: "Out of Network" }).count()) > 0;
  v.steps.push(`title=${v.title} nav=${v.nav}`);

  await page.getByRole("button", { name: "Add provider" }).click();
  await page.waitForTimeout(300);
  await page.locator("#name").fill("Temp Remove Co");
  await page.getByRole("button", { name: "Add provider" }).click();
  await page.waitForTimeout(800);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove Temp Remove Co" }).click();
  await page.waitForTimeout(800);
  const after = await page.locator("body").innerText();
  v.removed = !after.includes("Temp Remove Co");
  await page.screenshot({ path: "/workspace/screenshots/network-removed.png" });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  v.stillGone = !(await page.locator("body").innerText()).includes("Temp Remove Co");
  v.steps.push(`removed=${v.removed} stillGone=${v.stillGone}`);
} catch (e) {
  v.errors.push(String(e));
}
v.errors.push(...errors);
v.ok = v.title && v.nav && v.removed && v.stillGone && v.errors.length === 0;
writeFileSync("/workspace/screenshots/qa-network-remove.json", JSON.stringify(v, null, 2));
console.log(JSON.stringify(v, null, 2));
await browser.close();
process.exit(v.ok ? 0 : 1);
