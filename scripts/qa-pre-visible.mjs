import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-4);
const admin = `chuy.see${stamp}`;
const pass = "DeskOps99!!";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
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
  await page.waitForTimeout(1800);
  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Pre-inspection", exact: true }).first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-preinspect-button.png" });
  await page.getByRole("button", { name: "Pre-inspection", exact: true }).first().click();
  await page.getByTestId("pre-inspection-inline").waitFor({ timeout: 10000 });
  await page.getByText("Correct voltage/phase/outlet").waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/workspace/screenshots/qa-preinspect-inline.png" });
  const text = await page.getByTestId("pre-inspection-inline").innerText();
  const cats = ["Power", "Water", "Drain", "Ethernet", "Space"].every((c) => text.includes(c));
  console.log(JSON.stringify({ cats, errors, snippet: text.slice(0, 280) }));
  if (!cats) process.exit(1);
} catch (err) {
  console.error(errors, err instanceof Error ? err.message : err);
  await page.screenshot({ path: "/workspace/screenshots/qa-preinspect-inline-fail.png" }).catch(() => {});
  process.exit(1);
} finally {
  await browser.close();
}
