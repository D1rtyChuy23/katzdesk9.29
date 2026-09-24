import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-5);
const admin = `chuy.stg${stamp}`;
const pass = "DeskOps99!!";
const serial = `QA-STG-${stamp}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

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
  const move = page.getByTestId("warehouse-move").getByLabel("Location");
  const moveOptions = await move.locator("option").allTextContents();
  if (!moveOptions.includes("Staging area")) throw new Error("warehouse picker missing staging: " + moveOptions.join("|"));
  await move.selectOption("staging");
  await page.getByTestId("warehouse-move").screenshot({ path: "/workspace/screenshots/qa-staging-warehouse.png" });
  await page.getByTestId("warehouse-move").getByRole("button", { name: "Confirm" }).click();
  await page.waitForTimeout(700);

  await page.goto(`${BASE}/locations`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Filter…").fill(serial);
  await page.waitForTimeout(400);
  const staging = page.locator("section").filter({ has: page.getByRole("heading", { name: "Staging area", exact: true }) });
  const text = await staging.innerText();
  if (!text.includes(serial)) throw new Error("not under staging: " + text.slice(0, 300));
  if ((await page.locator("section").filter({ has: page.getByRole("heading", { name: "Training", exact: true }) }).innerText()).includes(serial)) {
    throw new Error("also on training");
  }
  await staging.screenshot({ path: "/workspace/screenshots/qa-staging-list.png" });

  await staging.getByRole("button", { name: serial }).click();
  await page.getByTestId("unit-place").waitFor();
  const attrOptions = await page.getByTestId("unit-place").getByLabel("Location").locator("option").allTextContents();
  if (!attrOptions.includes("Staging area")) throw new Error("attribute picker missing staging: " + attrOptions.join("|"));
  await page.getByTestId("unit-place-current").getByText("Staging area").waitFor({ timeout: 8000 });
  await page.getByTestId("unit-place").screenshot({ path: "/workspace/screenshots/qa-staging-attr.png" });
  const now = await page.getByTestId("unit-place-current").innerText();
  console.log("staging ok", { moveOptions, attrOptions, now, errors });
} catch (err) {
  console.error(errors, err instanceof Error ? err.message : err);
  await page.screenshot({ path: "/workspace/screenshots/qa-staging-fail.png" });
  process.exitCode = 1;
} finally {
  await browser.close();
}
