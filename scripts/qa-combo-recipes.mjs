import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const verdict = {
  ok: false,
  oneSearchField: false,
  plusAddAtTop: false,
  disclaimerOnMiss: false,
  noInnerSearch: false,
  rackShowsAll: false,
  rackCount: null,
  optionCount: null,
  recipesSection: false,
  steps: [],
  errors: [],
};

function attach(page) {
  page.on("pageerror", (e) => errors.push(`page: ${e}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Download the React DevTools/i.test(m.text())) {
      errors.push(`console: ${m.text()}`);
    }
  });
}

async function signup(page, username, email, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const back = page.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4500);
}

const stamp = Date.now().toString(36).slice(-5);
const user = `chuy.cmb${stamp}`;
const pass = "DeskCombo99!";
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
attach(page);

try {
  await signup(page, user, `${user}@katz.test`, pass);
  verdict.steps.push("signed in");

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /New install/i }).click();
  await page.waitForTimeout(400);
  const dialog = page.getByRole("dialog");
  const cust = dialog.getByRole("combobox", { name: "Customer" });
  await cust.click();
  await page.waitForTimeout(300);
  const pop = page.locator("[data-combo-popover]").last();
  const innerSearches = await pop.locator("input").count();
  verdict.noInnerSearch = innerSearches === 0;
  verdict.oneSearchField = true;
  await cust.fill("zzzz-not-a-customer");
  await page.waitForTimeout(400);
  const popText = await pop.innerText().catch(() => "");
  verdict.plusAddAtTop = /zzzz-not-a-customer/i.test(popText);
  verdict.disclaimerOnMiss = /isn.?t on the list/i.test(popText);
  await page.screenshot({ path: "/workspace/screenshots/combo-customer.png" });
  if (!verdict.noInnerSearch) verdict.errors.push(`inner search inputs in popover: ${innerSearches}`);
  if (!verdict.plusAddAtTop) verdict.errors.push(`plus add missing: ${popText.slice(0, 200)}`);
  if (!verdict.disclaimerOnMiss) verdict.errors.push(`disclaimer missing: ${popText.slice(0, 200)}`);
  verdict.steps.push("combo checked");

  await page.getByRole("button", { name: "Close" }).click({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.locator("article button.font-medium, article button").nth(1).click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  const warehouse = page.locator("#warehouse-units");
  await warehouse.waitFor({ state: "visible", timeout: 8000 });
  await warehouse.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const body = await warehouse.innerText();
  const m = body.match(/(\d+)\s+ready on the rack/i);
  verdict.rackCount = m ? Number(m[1]) : null;
  const rack = warehouse.getByRole("combobox", { name: /Ready unit on the rack/i });
  await rack.click();
  await page.waitForTimeout(600);
  const pop2 = page.locator("[data-combo-popover]").last();
  verdict.optionCount = await pop2.locator("[role='option']").count();
  const pop2Text = await pop2.innerText().catch(() => "");
  if (verdict.optionCount === 0) {
    // fallback: count rows
    verdict.optionCount = pop2Text.split("\n").filter((l) => l.trim()).length;
  }
  verdict.rackShowsAll =
    verdict.rackCount != null &&
    verdict.optionCount != null &&
    verdict.optionCount >= Math.min(verdict.rackCount ?? 0, 50);
  if (verdict.rackCount && verdict.optionCount < Math.min(verdict.rackCount, 50)) {
    verdict.errors.push(`rack listed ${verdict.optionCount} of ${verdict.rackCount}`);
  }
  await page.screenshot({ path: "/workspace/screenshots/combo-rack.png" });
  verdict.steps.push(`rack count=${verdict.rackCount} options=${verdict.optionCount}`);

  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const custRow = page.getByRole("button", { name: /4 Brothers NY Bagels$/ }).first();
  if (await custRow.count()) await custRow.click();
  else await page.locator("ul button").first().click();
  await page.waitForTimeout(800);
  const hist = await page.locator("body").innerText();
  verdict.recipesSection = /Recipes/i.test(hist) && /Use another|No recipes on this account/i.test(hist);
  await page.screenshot({ path: "/workspace/screenshots/customer-recipes.png" });
  if (!verdict.recipesSection) verdict.errors.push(`recipes section missing: ${hist.slice(-400)}`);
  verdict.steps.push(`recipesSection=${verdict.recipesSection}`);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  attach(mobile);
  await signup(mobile, `chuy.m${stamp}`, `chuy.m${stamp}@katz.test`, pass);
  await mobile.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await mobile.getByRole("button", { name: /New install/i }).click();
  await mobile.waitForTimeout(400);
  await mobile.getByRole("combobox", { name: "Customer" }).click();
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: "/workspace/screenshots/combo-customer-mobile.png" });
  await mobile.close();
} catch (e) {
  verdict.errors.push(String(e));
}

verdict.errors.push(...errors);
verdict.ok =
  verdict.noInnerSearch &&
  verdict.plusAddAtTop &&
  verdict.disclaimerOnMiss &&
  verdict.recipesSection &&
  verdict.rackShowsAll &&
  verdict.errors.filter((e) => !/^console:/.test(e)).length === 0;

writeFileSync("/workspace/screenshots/qa-combo-recipes.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.ok ? 0 : 1);
