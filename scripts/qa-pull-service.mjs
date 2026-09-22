import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const verdict = { ok: false, steps: [], errors };

async function attach(page) {
  page.on("pageerror", (e) => errors.push(`page: ${e}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
}

const stamp = Date.now().toString(36).slice(-5);
const username = `chuy.svc${stamp}`;
const pass = "DeskHistory99!";

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await attach(page);

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(`${username}@katz.test`);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4000);

  await page.goto(`${BASE}/warehouse`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const first = page.locator("button").filter({ hasText: /B-L|H-L|J-L|C-L|D-L/ }).first();
  const unitBtn = page.locator(".overflow-hidden.rounded-xl button").first();
  if (await unitBtn.count()) await unitBtn.click();
  else throw new Error("no warehouse unit to open");
  await page.waitForTimeout(600);

  const sheet = page.locator("[data-slot='sheet-content'], [role='dialog']").last();
  const body = await page.locator("body").innerText();
  const hasInstall = /Pull for install/i.test(body);
  const hasService = /Pull for service/i.test(body);
  verdict.steps.push(hasInstall ? "has Pull for install" : "MISSING pull for install");
  verdict.steps.push(hasService ? "has Pull for service" : "MISSING pull for service");
  if (!hasService) verdict.errors.push("Pull for service section missing");
  const heading = page.getByText("Pull for service", { exact: true });
  await heading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/workspace/screenshots/pull-service-sheet.png" });

  const serviceBlock = page.locator("p", { hasText: "Pull for service" }).locator("xpath=ancestor::div[contains(@class,'space-y-3')]");
  await serviceBlock.getByRole("button", { name: "Customer" }).click();
  await page.waitForTimeout(400);
  const search = page.locator("input[placeholder*='Search accounts']").last();
  if (await search.count()) await search.fill("a");
  await page.waitForTimeout(400);
  const option = page.locator("button[role='option']").first();
  const optName = (await option.innerText().catch(() => "")).trim();
  if (!optName) verdict.errors.push("no customer options");
  else {
    await option.click();
    verdict.steps.push(`picked customer ${optName.split("\n")[0]}`);
  }
  await page.waitForTimeout(300);
  const assignBtns = page.getByRole("button", { name: /Assign & remove from barn/i });
  await assignBtns.last().click();
  await page.waitForTimeout(1500);
  const after = await page.locator("body").innerText();
  const pulled = /Pulled for service|On service|Out on service/i.test(after);
  verdict.steps.push(pulled ? "assigned toast/status shown" : "no assign confirmation in UI");
  await page.screenshot({ path: "/workspace/screenshots/pull-service-after.png" });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await attach(mobile);
  await mobile.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  if (await mobile.locator("#username").count()) {
    const signToggle = mobile.getByRole("button", { name: /Have an account|Sign in/i });
    if (await signToggle.count()) await signToggle.click();
    await mobile.locator("#username").fill(username);
    await mobile.locator("#password").fill(pass);
    await mobile.getByRole("button", { name: /^Sign in$/ }).click();
    await mobile.waitForTimeout(3000);
  }
  await mobile.goto(`${BASE}/warehouse`, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(600);
  const mUnit = mobile.locator(".overflow-hidden.rounded-xl button").first();
  if (await mUnit.count()) await mUnit.click();
  await mobile.waitForTimeout(600);
  const mBody = await mobile.locator("body").innerText();
  if (!/Pull for service/i.test(mBody)) verdict.errors.push("mobile missing Pull for service");
  await mobile.screenshot({ path: "/workspace/screenshots/pull-service-mobile.png" });
  await mobile.close();

  verdict.ok = errors.length === 0 && !verdict.errors.length;
} catch (e) {
  verdict.errors.push(String(e));
} finally {
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();
  process.exit(verdict.ok ? 0 : 1);
}
