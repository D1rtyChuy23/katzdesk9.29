import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-4);
const admin = `chuy.inspect${stamp}`;
const pass = "DeskOps99!!";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
  "base64",
);
writeFileSync("/tmp/inspect-power.png", png);
writeFileSync("/tmp/inspect-drain.png", png);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const verdict = { steps: [], error: null };

function log(step, ok, extra = "") {
  verdict.steps.push({ step, ok, extra });
  console.log(`${ok ? "ok" : "FAIL"} ${step} ${extra}`);
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(admin);
  await page.locator("#email").fill(`${admin}@katz.test`);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(2000);

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.getByText("Install clock").waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const board = await page.locator("body").innerText();
  log("install board", /Prep/.test(board) && /Not ready/.test(board));

  const row = page.locator("article").first();
  await row.waitFor({ timeout: 10000 });
  const account = (await row.locator("button.font-medium, button").nth(1).innerText()).split("\n")[0].trim();
  log("picked account", !!account, account);
  await row.locator("button").nth(1).click();
  const sheet = page.locator("[role=dialog]").last();
  await sheet.waitFor({ state: "visible", timeout: 8000 });
  await sheet.getByText("Pre-inspection", { exact: false }).first().waitFor({ timeout: 10000 });
  const panel = await sheet.innerText();
  const cats = ["Power", "Water", "Drain", "Ethernet", "Space"].every((c) => panel.includes(c));
  log("five categories", cats);
  await page.screenshot({ path: "/workspace/screenshots/qa-preinspect-panel.png" });

  const status = sheet.locator('select[name="equipStatus"]');
  if (await status.count()) {
    await status.selectOption("Ready");
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForTimeout(600);
  }

  await sheet.locator("[data-testid=inspect-photo-power]").setInputFiles("/tmp/inspect-power.png");
  await page.waitForTimeout(1200);
  await sheet.locator("[data-testid=inspect-status-power]").selectOption("Pass");
  await sheet.getByRole("button", { name: "Save Power" }).click();
  await page.waitForTimeout(800);

  await sheet.locator("[data-testid=inspect-photo-drain]").setInputFiles("/tmp/inspect-drain.png");
  await page.waitForTimeout(1200);
  await sheet.locator("[data-testid=inspect-status-drain]").selectOption("Fail");
  await sheet.locator("[data-testid=inspect-drain] textarea").fill("No floor drain at the bar");
  await sheet.getByRole("button", { name: "Save Drain" }).click();
  await page.waitForTimeout(900);
  const after = await sheet.innerText();
  log("power photo", /photo/i.test(after) && after.includes("Pass"));
  log("failed drain", after.includes("Pre-inspection Failed") && after.includes("No floor drain"));
  await sheet.locator("[data-testid=pre-inspection]").screenshot({
    path: "/workspace/screenshots/qa-preinspect-failed.png",
  });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /^Not ready/ }).click();
  await page.waitForTimeout(400);
  const notReady = await page.locator("body").innerText();
  log("stays off ready", notReady.includes(account) && /Pre-inspection Failed/.test(notReady), account);
  await page.screenshot({ path: "/workspace/screenshots/qa-preinspect-board.png" });

  await page.getByRole("button", { name: /^Ready/ }).click();
  await page.waitForTimeout(400);
  const readyText = await page.locator("article").allInnerTexts();
  const onReady = readyText.some((t) => t.includes(account));
  log("not on ready list", !onReady);

  await page.locator("summary", { hasText: "Export" }).click();
  await page.getByRole("button", { name: "Export readiness" }).click();
  const exportDlg = page.locator("[role=dialog]").last();
  await exportDlg.getByRole("button", { name: "Preview" }).click();
  await exportDlg.getByText("Pre-inspection status").first().waitFor({ timeout: 15000 });
  const table = await exportDlg.innerText();
  log("export column", table.includes("Pre-inspection status") && table.includes("Failed items") && table.includes("Failed"));
  log("export serial kept", table.includes("Serial number") && table.includes("Electrical configuration"));
  await page.screenshot({ path: "/workspace/screenshots/qa-preinspect-export.png" });
} catch (err) {
  verdict.error = err instanceof Error ? err.message : String(err);
  console.error(verdict.error);
  await page.screenshot({ path: "/workspace/screenshots/qa-preinspect-fail.png" }).catch(() => {});
} finally {
  await browser.close();
  if (verdict.error || verdict.steps.some((s) => !s.ok)) process.exit(1);
}
