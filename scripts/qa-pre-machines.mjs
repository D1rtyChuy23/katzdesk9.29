import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-5);
const admin = `chuy.mach${stamp}`;
const pass = "DeskOps99!!";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
  "base64",
);
writeFileSync("/tmp/inspect-unit.png", png);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function addUnit(serial, electrical) {
  await page.getByTestId("add-inspection-equipment").click();
  const combo = page.getByRole("combobox", { name: "Model" });
  await combo.click();
  await combo.fill("Bunn");
  await page.waitForTimeout(300);
  await combo.press("Enter");
  await page.getByTestId("add-equipment-serial").fill(serial);
  await page.getByTestId("add-equipment-electrical").fill(electrical);
  await page.getByTestId("add-equipment-save").click();
  await page.getByTestId("machine-list").waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
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
  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Search installs").fill("waller");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Pre-inspection", exact: true }).first().click();
  await page.getByTestId("machine-list").waitFor({ timeout: 15000 });
  const before = await page.getByTestId("machine-progress").innerText();
  console.log("start", before, errors);
  if (/Could not|Unknown|error/i.test(await page.getByTestId("pre-inspection").innerText())) {
    throw new Error(await page.getByTestId("pre-inspection").innerText());
  }
  const startCount = Number(before.match(/of (\d+)/)?.[1] ?? 0);
  if (startCount < 2) {
    await addUnit(`QA-A-${stamp}`, "120V");
  }
  const two = await page.getByTestId("machine-progress").innerText();
  console.log("two", two);
  await page.screenshot({ path: "/workspace/screenshots/qa-machines-list.png" });
  await page.locator("[data-testid^=inspect-machine-]").first().click();
  await page.getByTestId("machine-detail").waitFor({ timeout: 8000 });
  const detail = await page.getByTestId("machine-detail").innerText();
  const five = ["Power", "Water", "Drain", "Ethernet", "Space"].every((c) => detail.includes(c));
  console.log("five", five);
  await page.locator("[data-testid=inspect-photo-power]").setInputFiles("/tmp/inspect-unit.png");
  await page.waitForTimeout(800);
  await page.locator("[data-testid=inspect-status-power]").selectOption("Pass");
  await page.waitForTimeout(500);
  await page.locator("[data-testid=inspect-photo-water]").setInputFiles("/tmp/inspect-unit.png");
  await page.waitForTimeout(800);
  await page.locator("[data-testid=inspect-status-water]").selectOption("Pass");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/workspace/screenshots/qa-machines-one.png" });
  await page.getByTestId("inspection-back").click();
  await page.getByTestId("machine-list").waitFor();
  const mid = await page.getByTestId("machine-progress").innerText();
  console.log("mid", mid);
  await addUnit(`QA-B-${stamp}`, "220V");
  const after = await page.getByTestId("machine-progress").innerText();
  const site = await page.getByTestId("inspection-badge").first().innerText();
  console.log("after", after, site, errors);
  await page.screenshot({ path: "/workspace/screenshots/qa-machines-three.png" });
  const n = Number(after.match(/of (\d+)/)?.[1] ?? 0);
  const passed = Number(after.match(/^(\d+)/)?.[1] ?? 99);
  if (!five || n < startCount + 1 || passed >= n || /Pre-inspection Passed/.test(site)) {
    throw new Error(`unexpected ${after} ${site} five=${five}`);
  }
} catch (err) {
  console.error(errors, err instanceof Error ? err.message : err);
  await page.screenshot({ path: "/workspace/screenshots/qa-machines-fail.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
