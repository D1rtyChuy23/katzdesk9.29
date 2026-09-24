import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-4);
const admin = `chuy.wh${stamp}`;
const pass = "DeskOps99!!";
const wh1 = `lane.wh${stamp}`;
const wh2 = `reed.wh${stamp}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

async function toLogin() {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const back = page.getByRole("button", { name: "Back to sign in" });
  if (await back.count()) await back.click();
  await page.locator("#username").waitFor({ timeout: 10000 });
}

async function signup(name) {
  await toLogin();
  const create = page.getByRole("button", { name: /Need an account\? Create one/i });
  if (await create.count()) await create.click();
  await page.locator("#username").fill(name);
  await page.locator("#email").fill(`${name}@katz.test`);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(1400);
}

async function signin(name) {
  await toLogin();
  const back = page.getByRole("button", { name: /Already have an account/i });
  if (await back.count()) await back.click();
  await page.locator("#username").fill(name);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(1400);
}

try {
  await signup(admin);
  if (page.url().includes("login") || (await page.getByText("Waiting for approval").count())) {
    throw new Error("admin not approved " + page.url());
  }

  await signup(wh1);
  await signup(wh2);
  await signin(admin);
  await page.goto(`${BASE}/access`, { waitUntil: "networkidle" });
  for (const name of [wh1, wh2]) {
    const block = page.locator("li").filter({ hasText: name }).first();
    if (await block.getByRole("button", { name: "Approve" }).count()) {
      await block.getByRole("button", { name: "Approve" }).click();
      await page.waitForTimeout(500);
    }
  }
  for (const name of [wh1, wh2]) {
    const row = page.locator("li").filter({ hasText: name }).filter({ has: page.getByLabel("Role") }).first();
    await row.getByLabel("Role").selectOption("warehouse");
    await page.waitForTimeout(400);
  }
  await signin(wh1);
  const locked = await page.getByTestId("side-nav").innerText();
  if (/Tickets|Coming due|Recipes|Customers/.test(locked)) throw new Error("leaked\n" + locked);
  await page.getByTestId("side-nav").screenshot({ path: "/workspace/screenshots/qa-warehouse-role.png" });
  await page.goto(`${BASE}/service`);
  await page.waitForTimeout(800);
  console.log("role", page.url(), locked.replaceAll("\n", " | "));
  if (!page.url().includes("/warehouse")) throw new Error("still on " + page.url());
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  await page.screenshot({ path: "/workspace/screenshots/qa-role-fail.png" });
  process.exitCode = 1;
} finally {
  await browser.close();
}
