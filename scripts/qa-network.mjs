import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const verdict = {
  ok: false,
  nav: false,
  providerCount: 0,
  unassigned: false,
  dispatchOnCustomer: false,
  dispatchOnTicket: false,
  addProvider: false,
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
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(5000);
}

const stamp = Date.now().toString(36).slice(-5);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
attach(page);

try {
  await signup(page, `chuy.net${stamp}`, `chuy.net${stamp}@katz.test`, "DeskNetwork99!");
  verdict.steps.push("signed in");

  await page.goto(`${BASE}/network`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  verdict.nav = (await page.getByRole("link", { name: "Out of network" }).count()) > 0;
  const body = await page.locator("body").innerText();
  verdict.unassigned = /Hawkers - Bethesda/i.test(body);
  verdict.providerCount = await page.getByRole("button", { name: /All Espresso Service|ETSC|PriorityOne/ }).count();
  await page.screenshot({ path: "/workspace/screenshots/network-providers.png" });
  verdict.steps.push(`nav=${verdict.nav} unassigned=${verdict.unassigned} providersVisible=${verdict.providerCount}`);

  await page.getByRole("button", { name: /ETSC/ }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/workspace/screenshots/network-provider-sheet.png" });

  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByPlaceholder("Search customers").or(page.locator("input[aria-label='Filter'], input[placeholder*='Search']")).first().fill("Porsche Little Rock");
  await page.waitForTimeout(400);
  const porsche = page.getByRole("button", { name: /Porsche Little Rock/i }).first();
  if (await porsche.count()) {
    await porsche.click();
    await page.waitForTimeout(900);
    const sheet = await page.locator("body").innerText();
    verdict.dispatchOnCustomer = /Remolinos Group/i.test(sheet) && /479/i.test(sheet);
    await page.screenshot({ path: "/workspace/screenshots/network-customer.png" });
  } else {
    verdict.steps.push("porsche row missing");
  }

  await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /New|Open call/i }).first().click();
  await page.waitForTimeout(400);
  const combo = page.getByRole("combobox").first();
  await combo.click();
  await combo.fill("Porsche Little Rock");
  await page.waitForTimeout(400);
  const opt = page.locator('button[role="option"]').first();
  if (await opt.count()) await opt.click();
  await page.waitForTimeout(800);
  const dlg = await page.locator("body").innerText();
  verdict.dispatchOnTicket = /Remolinos Group/i.test(dlg) && /Out-of-network dispatch/i.test(dlg);
  await page.screenshot({ path: "/workspace/screenshots/network-new-ticket.png" });

  await page.goto(`${BASE}/network`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add provider" }).click();
  await page.waitForTimeout(400);
  await page.locator("#name").fill(`QA Service Co ${stamp}`);
  await page.locator("#status").selectOption("Active");
  await page.locator("#dispatchPhone").fill("713-555-0199");
  await page.locator("#standardRate").fill("$120/hr");
  await page.getByRole("button", { name: "Add provider" }).click();
  await page.waitForTimeout(900);
  const after = await page.locator("body").innerText();
  verdict.addProvider = after.includes(`QA Service Co ${stamp}`);
  await page.screenshot({ path: "/workspace/screenshots/network-added.png" });
} catch (e) {
  verdict.errors.push(String(e));
}

verdict.errors.push(...errors);
verdict.ok =
  verdict.nav &&
  verdict.unassigned &&
  verdict.providerCount > 0 &&
  verdict.dispatchOnCustomer &&
  verdict.dispatchOnTicket &&
  verdict.addProvider &&
  verdict.errors.filter((e) => !/^console:/.test(e)).length === 0;

writeFileSync("/workspace/screenshots/qa-network.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.ok ? 0 : 1);
