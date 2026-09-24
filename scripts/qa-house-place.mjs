import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-5);
const admin = `chuy.house${stamp}`;
const pass = "DeskOps99!!";
const serial = `QA-HOUSE-${stamp}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(admin);
  await page.locator("#email").fill(`${admin}@katz.test`);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(1600);

  await page.goto(`${BASE}/warehouse`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add to rack" }).click();
  const model = page.getByRole("combobox", { name: "Model" });
  await model.click();
  await model.fill("Bunn");
  await page.waitForTimeout(250);
  await model.press("Enter");
  await page.locator("input[name=serial]").fill(serial);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.getByPlaceholder("Find model or serial…").fill(serial);
  await page.waitForTimeout(300);
  await page.getByTestId(`move-${serial}`).click();
  await page.getByTestId("warehouse-move").getByLabel("Location").selectOption("training");
  await page.getByTestId("warehouse-move").getByRole("button", { name: "Confirm" }).click();
  await page.waitForTimeout(700);
  await shot("qa-house-training");
  console.log("moved training", errors);

  await page.goto(`${BASE}/locations`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Filter…").fill(serial);
  await page.waitForTimeout(300);
  const training = page.locator("section").filter({ has: page.getByRole("heading", { name: "Training", exact: true }) });
  const lobbyHead = page.getByRole("heading", { name: "Lobby", exact: true });
  if (!(await training.innerText()).includes(serial)) throw new Error("not in training");
  if (!(await lobbyHead.count())) throw new Error("lobby heading missing");
  await shot("qa-house-lists");

  await training.getByRole("button", { name: serial }).click();
  await page.getByTestId("unit-place").getByLabel("Location").selectOption("lobby");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(900);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const lobby = page.locator("section").filter({ has: page.getByRole("heading", { name: "Lobby", exact: true }) });
  const lobbyText = await lobby.innerText();
  const trainingText = await training.innerText();
  console.log("after save", { training: trainingText.includes(serial), lobby: lobbyText.includes(serial), errors });
  if (trainingText.includes(serial) || !lobbyText.includes(serial)) throw new Error("place did not become lobby");
  await shot("qa-house-lobby");
} catch (err) {
  console.error(errors, err instanceof Error ? err.message : err);
  await shot("qa-house-fail");
  process.exitCode = 1;
} finally {
  await browser.close();
}
