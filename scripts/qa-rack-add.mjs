import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-5);
const pass = "DeskOps99!!";
const admin = `chuy.rack${stamp}`;
const wh = `lane.rack${stamp}`;
const sales = `reed.rack${stamp}`;
const serial = `RACK${stamp}`.toUpperCase();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function ensureLoggedOut() {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  }).catch(() => undefined);
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#username").waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
}

async function signup(name) {
  await ensureLoggedOut();
  await page.waitForTimeout(1500);
  const create = page.locator("button", { hasText: "Need an account? Create one" });
  console.log("toggle", await create.count(), await page.locator("h2").allInnerTexts());
  await create.first().click({ force: true });
  await page.waitForTimeout(500);
  console.log("after click", await page.locator("h2").allInnerTexts(), "email", await page.locator("#email").count());
  if (!(await page.locator("#email").count())) {
    await create.first().click({ force: true });
    await page.waitForTimeout(500);
    console.log("after second", await page.locator("h2").allInnerTexts(), "email", await page.locator("#email").count());
  }
  await page.locator("#email").waitFor({ timeout: 10000 });
  await page.locator("#username").fill(name);
  await page.locator("#email").fill(`${name}@katz.test`);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(2000);
}

async function signin(name) {
  await ensureLoggedOut();
  const back = page.getByRole("button", { name: /Already have an account/i });
  if (await back.count()) await back.click();
  await page.locator("#password").waitFor();
  await page.locator("#username").fill(name);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(2000);
}

async function setRole(name, role) {
  await page.goto(`${BASE}/access`, { waitUntil: "domcontentloaded" });
  await page.getByText(name).first().waitFor({ timeout: 15000 });
  const pending = page.locator("li").filter({ hasText: name }).filter({ has: page.getByRole("button", { name: "Approve" }) });
  if (await pending.count()) {
    await pending.first().getByRole("button", { name: "Approve" }).click();
    await page.waitForTimeout(900);
  }
  const row = page.locator("li").filter({ hasText: name }).filter({ has: page.getByLabel("Role") }).first();
  await row.getByLabel("Role").selectOption(role);
  await page.waitForTimeout(700);
}

try {
  await signup(admin);
  await signup(wh);
  await signup(sales);
  await signin(admin);
  await setRole(wh, "warehouse");
  await setRole(sales, "sales");

  await signin(sales);
  await page.goto(`${BASE}/warehouse`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Barn warehouse" }).waitFor({ timeout: 15000 });
  if (await page.getByRole("button", { name: "Add to rack" }).count()) {
    throw new Error("sales saw Add to rack");
  }
  const salesSlot = page.locator("[data-testid^='slot-']").first();
  await salesSlot.click();
  await page.waitForTimeout(400);
  if (await page.getByTestId("slot-add").count()) throw new Error("sales saw slot add");
  const slotText = ((await salesSlot.innerText()) || "").trim();
  if (slotText === "Add") throw new Error("sales empty slot says Add");

  await signin(wh);
  await page.goto(`${BASE}/warehouse`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Barn warehouse" }).waitFor({ timeout: 15000 });
  const nav = await page.getByTestId("side-nav").innerText();
  if (/Tickets|Coming due|Recipes|Customers/.test(nav)) throw new Error("warehouse nav leaked\n" + nav);
  const chip = page.locator("[data-testid^='slot-']").first();
  await chip.scrollIntoViewIfNeeded();
  const slotName = await chip.getAttribute("data-testid");
  await chip.click();
  const form = page.getByTestId("slot-add");
  await form.waitFor();
  await form.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/workspace/screenshots/rack-add-empty.png", fullPage: false });
  const shot = page.locator("table").locator("xpath=ancestor::div[contains(@class,'overflow-x-auto')]").first();
  await shot.screenshot({ path: "/workspace/screenshots/rack-add-grid.png" }).catch(() => {});
  await form.screenshot({ path: "/workspace/screenshots/rack-add-form.png" });

  const model = form.getByRole("combobox", { name: "Model" });
  await model.click();
  await model.fill("Bunn");
  await page.waitForTimeout(500);
  await model.press("Enter");
  await page.waitForTimeout(400);
  await form.locator("#slot-serial").fill(serial);
  await form.locator("#slot-electrical").fill("120V");
  await form.getByTestId("slot-save").click();
  const row = page.getByTestId(`rack-row-${serial}`);
  await row.waitFor({ timeout: 15000 });
  await page.getByPlaceholder("Find model or serial…").fill(serial);
  await page.waitForTimeout(400);
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const rowText = await row.innerText();
  if (!rowText.includes("Pending review")) throw new Error("missing pending review\n" + rowText);
  if (!rowText.includes("Needs test")) throw new Error("missing needs test\n" + rowText);
  await row.screenshot({ path: "/workspace/screenshots/rack-pending-needs.png" });

  const testedBtn = page.getByTestId(`mark-tested-${serial}`);
  console.log("tested buttons", await testedBtn.count());
  await testedBtn.scrollIntoViewIfNeeded();
  await testedBtn.click({ force: true });
  await page.waitForTimeout(800);
  const testedText = await row.innerText();
  if (!testedText.includes("Tested")) throw new Error("not marked tested\n" + testedText);
  if (!testedText.includes("Pending review")) throw new Error("review cleared too soon\n" + testedText);
  await row.screenshot({ path: "/workspace/screenshots/rack-tested.png" });
  await page.screenshot({ path: "/workspace/screenshots/rack-tested-list.png" });

  await signin(admin);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /notification/i }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /notification/i }).click();
  const notice = page.locator("li").filter({ hasText: serial }).first();
  await notice.waitFor({ timeout: 10000 });
  const noticeText = await notice.innerText();
  if (!/Needs review/i.test(noticeText)) throw new Error("notice missing needs review\n" + noticeText);
  if (!noticeText.includes(wh)) throw new Error("notice missing who\n" + noticeText);
  await page.locator("[data-radix-popper-content-wrapper], [role='dialog']").first().screenshot({
    path: "/workspace/screenshots/rack-review-notice.png",
  }).catch(async () => {
    await page.screenshot({ path: "/workspace/screenshots/rack-review-notice.png" });
  });
  const href = await notice.locator("a").getAttribute("href");
  console.log("notice href", href);
  if (!href) throw new Error("notice has no link");
  await page.goto(href.startsWith("http") ? href : `${BASE}${href}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Approve" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/workspace/screenshots/rack-review-sheet.png" });

  console.log("ok", { slotName, serial, errors, noticeText });
} catch (err) {
  console.error(errors, err instanceof Error ? err.message : err);
  await page.screenshot({ path: "/workspace/screenshots/rack-add-fail.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
