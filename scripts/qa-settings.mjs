import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const verdict = {
  ok: false,
  navSettings: false,
  darkClass: false,
  largeText: false,
  highContrast: false,
  compact: false,
  steps: [],
  errors: [],
};

function attach(page) {
  page.on("pageerror", (e) => errors.push(`page: ${e}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Download the React DevTools/i.test(m.text())) {
      errors.push(`console: ${m.text()}`);
    }
  });
}

async function signup(page, username, email, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4500);
}

const stamp = Date.now().toString(36).slice(-5);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
attach(page);

try {
  await signup(page, `chuy.set${stamp}`, `chuy.set${stamp}@katz.test`, "DeskPrefs99!");
  verdict.steps.push("signed in");

  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  verdict.navSettings = await page.getByRole("link", { name: "Settings" }).count() > 0;
  await page.screenshot({ path: "/workspace/screenshots/settings-light.png" });

  await page.getByRole("radio", { name: "Dark" }).click();
  await page.waitForTimeout(400);
  verdict.darkClass = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  await page.screenshot({ path: "/workspace/screenshots/settings-dark.png" });

  await page.getByRole("radio", { name: "Large" }).click();
  await page.getByRole("radio", { name: "High" }).click();
  await page.getByRole("radio", { name: "Compact" }).click();
  await page.waitForTimeout(300);
  const attrs = await page.evaluate(() => ({
    text: document.documentElement.dataset.text,
    contrast: document.documentElement.dataset.contrast,
    density: document.documentElement.dataset.density,
    font: getComputedStyle(document.documentElement).fontSize,
  }));
  verdict.largeText = attrs.text === "large";
  verdict.highContrast = attrs.contrast === "high";
  verdict.compact = attrs.density === "compact";
  await page.screenshot({ path: "/workspace/screenshots/settings-large-contrast.png" });
  verdict.steps.push(JSON.stringify(attrs));

  await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/workspace/screenshots/settings-dark-service.png" });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  attach(mobile);
  await signup(mobile, `chuy.sm${stamp}`, `chuy.sm${stamp}@katz.test`, "DeskPrefs99!");
  await mobile.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await mobile.getByRole("radio", { name: "Dark" }).click();
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: "/workspace/screenshots/settings-dark-mobile.png" });
  await mobile.close();
} catch (e) {
  verdict.errors.push(String(e));
}

verdict.errors.push(...errors);
verdict.ok =
  verdict.navSettings &&
  verdict.darkClass &&
  verdict.largeText &&
  verdict.highContrast &&
  verdict.compact &&
  verdict.errors.filter((e) => !/^console:/.test(e)).length === 0;

writeFileSync("/workspace/screenshots/qa-settings.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.ok ? 0 : 1);
