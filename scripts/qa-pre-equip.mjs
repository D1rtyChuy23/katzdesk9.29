import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-4);
const admin = `chuy.equip${stamp}`;
const pass = "DeskOps99!!";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
  await page.waitForTimeout(500);
  await page.locator("article").first().locator("button").nth(1).click();
  const sheet = page.locator("[role=dialog]").last();
  await sheet.getByTestId("pre-inspection").waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  const text = await sheet.getByTestId("pre-inspection").innerText();
  console.log(text.slice(0, 900));
  await sheet.getByTestId("pre-inspection").screenshot({ path: "/workspace/screenshots/qa-preinspect-equip.png" });
} finally {
  await browser.close();
}
