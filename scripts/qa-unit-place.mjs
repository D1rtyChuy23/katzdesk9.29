import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-5);
const admin = `chuy.loc${stamp}`;
const pass = "DeskOps99!!";
const serial = `QA-LOC-${stamp}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(admin);
  await page.locator("#email").fill(`${admin}@katz.test`);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(1800);

  await page.goto(`${BASE}/warehouse`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add to rack" }).click();
  const model = page.getByRole("combobox", { name: "Model" });
  await model.click();
  await model.fill("Bunn");
  await page.waitForTimeout(250);
  await model.press("Enter");
  await page.locator("input[name=serial]").fill(serial);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.waitForTimeout(800);
  console.log("barn added", errors);

  await page.goto(`${BASE}/locations`, { waitUntil: "networkidle" });
  await page.getByTestId("add-from-barn").click();
  await page.getByPlaceholder("Search model, serial, or name").fill(serial);
  await page.waitForTimeout(400);
  const row = page.getByTestId("barn-pick").locator("label").filter({ hasText: serial });
  if (!(await row.count())) throw new Error("barn unit missing from picker");
  await row.locator("input").check();
  await page.getByRole("button", { name: "Add selected" }).click();
  await page.waitForTimeout(800);
  const lobby = page.locator("section").filter({ has: page.getByRole("heading", { name: "Front Lobby" }) });
  const onLobby = await lobby.innerText();
  if (!onLobby.includes(serial)) throw new Error("not on lobby: " + onLobby.slice(0, 400));
  await page.getByPlaceholder("Filter…").fill(serial);
  await page.waitForTimeout(200);
  await shot("qa-place-lobby");
  console.log("on lobby");

  const unit = page.getByRole("button", { name: serial }).locator("xpath=ancestor::div[contains(@class,'grid')][1]");
  await unit.getByRole("button", { name: "Move to barn" }).click();
  await page.getByTestId("bay-picker").selectOption("F");
  await page.getByTestId("bay-move").getByRole("button", { name: "Confirm" }).click();
  await page.waitForTimeout(800);
  const after = await lobby.innerText();
  if (after.includes(serial)) throw new Error("still on lobby");
  await shot("qa-place-bay");
  console.log("moved", errors);

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New install" }).click();
  const cust = page.getByRole("combobox").first();
  await cust.click();
  await cust.fill("a");
  await page.waitForTimeout(300);
  await cust.press("Enter");
  const equip = page.getByRole("combobox", { name: /Equipment|Search/i }).last();
  await equip.click();
  await equip.fill("Bunn");
  await page.waitForTimeout(250);
  await equip.press("Enter");
  await page.getByTestId("unit-place").waitFor({ timeout: 8000 });
  const placeText = await page.getByTestId("unit-place").innerText();
  console.log("place field", placeText, errors);
  if (!/Location/.test(placeText)) throw new Error(placeText);
  await shot("qa-place-field");
} catch (err) {
  console.error(errors, err instanceof Error ? err.message : err);
  await shot("qa-place-fail");
  process.exitCode = 1;
} finally {
  await browser.close();
}
