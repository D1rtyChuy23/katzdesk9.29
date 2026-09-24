import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-4);
const admin = `chuy.barn${stamp}`;
const pass = "DeskOps99!!";
const wh1 = `wh.lane${stamp}`;
const wh2 = `wh.reed${stamp}`;
const serial = `QA-BAY-${stamp}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function signup(name) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const out = page.getByRole("button", { name: /Sign out/i });
  if (await out.count()) {
    await out.first().click();
    await page.waitForTimeout(800);
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  }
  const create = page.getByRole("button", { name: /Need an account\? Create one/i });
  if (await create.count()) await create.click();
  await page.locator("#username").fill(name);
  await page.locator("#email").fill(`${name}@katz.test`);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(1600);
}

async function signin(name) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const out = page.getByRole("button", { name: /Sign out/i });
  if (await out.count()) {
    await out.first().click();
    await page.waitForTimeout(800);
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  }
  const back = page.getByRole("button", { name: /Already have an account/i });
  if (await back.count()) await back.click();
  await page.locator("#username").fill(name);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(1600);
}

try {
  await signup(admin);
  const nav = await page.getByTestId("side-nav").innerText();
  if (!nav.includes("Coming due")) throw new Error("nav missing coming due");
  const work = nav.split("INSTALLS")[0];
  if (work.indexOf("Coming due") > work.indexOf("Tickets")) throw new Error("coming due not first\n" + work);
  await page.locator("header").first().screenshot({ path: "/workspace/screenshots/qa-banner.png" });
  await page.getByTestId("side-nav").screenshot({ path: "/workspace/screenshots/qa-nav-coming.png" });

  await page.goto(`${BASE}/warehouse`, { waitUntil: "networkidle" });
  let chip = page.getByTestId("slot-G-L1");
  if (!(await chip.count())) chip = page.locator("[data-testid^='slot-']").first();
  await chip.scrollIntoViewIfNeeded();
  await chip.click();
  await page.getByTestId("slot-add").waitFor();
  await page.getByTestId("slot-add").screenshot({ path: "/workspace/screenshots/qa-slot-add.png" });

  await page.getByRole("button", { name: "Add to rack" }).click();
  const model = page.getByRole("combobox", { name: "Model" });
  await model.click();
  await model.fill("Bunn");
  await page.waitForTimeout(250);
  await model.press("Enter");
  await page.locator("input[name=serial]").fill(serial);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.getByPlaceholder("Find model or serial…").fill(serial);
  await page.waitForTimeout(300);
  await page.getByTestId(`move-${serial}`).click();
  const move = page.getByTestId("warehouse-move");
  await move.getByLabel("Location").selectOption("barn");
  await move.getByLabel("Barn bay").selectOption("G");
  const confirm = move.getByRole("button", { name: "Confirm" });
  if (await confirm.isEnabled()) throw new Error("confirm allowed without level");
  await move.getByLabel("Barn level").selectOption("1");
  await move.screenshot({ path: "/workspace/screenshots/qa-barn-level.png" });

  await signup(wh1);
  await signup(wh2);
  await signin(admin);
  await page.goto(`${BASE}/access`, { waitUntil: "networkidle" });
  for (const name of [wh1, wh2]) {
    const row = page.locator("li, tr, div").filter({ hasText: name }).last();
    await row.getByLabel("Role").selectOption("warehouse");
    await page.waitForTimeout(500);
  }
  await signin(wh1);
  const locked = await page.getByTestId("side-nav").innerText();
  if (/Tickets|Coming due|Recipes|Customers/.test(locked)) throw new Error("warehouse nav leaked\n" + locked);
  if (!locked.includes("Warehouse")) throw new Error("warehouse nav missing barn\n" + locked);
  await page.getByTestId("side-nav").screenshot({ path: "/workspace/screenshots/qa-warehouse-role.png" });
  await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if (!page.url().includes("/warehouse")) throw new Error("tickets stayed open " + page.url());
  console.log("ok", { errors, locked });
} catch (err) {
  console.error(errors, err instanceof Error ? err.message : err);
  await page.screenshot({ path: "/workspace/screenshots/qa-barn-role-fail.png" });
  process.exitCode = 1;
} finally {
  await browser.close();
}
