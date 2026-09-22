import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const verdict = { ok: false, steps: [], errors };

async function attach(page) {
  page.on("pageerror", (e) => errors.push(`page: ${e}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
}

const stamp = Date.now().toString(36).slice(-5);
const username = `chuy.hist${stamp}`;
const email = `${username}@katz.test`;
const pass = "DeskHistory99!";

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await attach(page);

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4000);
  const landed = await page.locator("body").innerText();
  if (!/Operations clock|Customers|Service tracker/i.test(landed)) {
    verdict.steps.push(`did not land on desk: ${landed.slice(0, 240)}`);
  } else {
    verdict.steps.push("signed in");
  }

  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  await page.getByLabel("Search customers").fill("The Gathery");
  await page.waitForTimeout(400);
  const nameBtn = page.getByRole("button", { name: /The Gathery/i }).first();
  await nameBtn.click();
  await page.waitForTimeout(800);
  const sheet = page.getByRole("dialog").filter({ hasText: "The Gathery" });
  const sheetText = (await sheet.innerText().catch(() => "")) || "";
  verdict.steps.push(`history sheet: ${sheetText.slice(0, 220).replace(/\s+/g, " ")}`);
  const hasHistory = /Service|TLC|PM/i.test(sheetText) && /Select a call or record/i.test(sheetText);
  if (!hasHistory) verdict.errors.push("history sheet missing expected copy or kinds");
  await page.screenshot({ path: "/workspace/screenshots/customer-history.png", fullPage: false });

  const callRow = sheet.getByRole("button", { name: /SC-\d/i }).first();
  if (await callRow.count()) {
    await callRow.click();
    await page.waitForTimeout(900);
    const editor = page.getByRole("dialog").filter({ hasText: /Service call/i });
    const editorOpen = (await editor.count()) > 0;
    verdict.steps.push(editorOpen ? "service editor opened" : "service editor missing");
    await page.screenshot({ path: "/workspace/screenshots/customer-history-edit.png", fullPage: false });
    if (editorOpen) {
      const notes = editor.locator("textarea[name='notes']");
      if (await notes.count()) {
        await notes.fill("History review from Customers — QA note.");
        await editor.getByRole("button", { name: /^Save$/ }).click();
        await page.waitForTimeout(800);
        verdict.steps.push("saved notes on selected call");
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const stillCustomer = await page.getByRole("dialog").filter({ hasText: "The Gathery" }).count();
      verdict.steps.push(stillCustomer ? "customer sheet stayed open" : "customer sheet closed with editor");
    }
  } else {
    verdict.errors.push("no service-call row to select");
  }

  await page.screenshot({ path: "/workspace/screenshots/customer-history-after.png", fullPage: false });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await attach(mobile);
  await mobile.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const back = mobile.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  // already have a session in a different context — sign in
  if (await mobile.locator("#username").count()) {
    const signToggle = mobile.getByRole("button", { name: /Have an account|Sign in/i });
    if (await signToggle.count()) await signToggle.click();
    await mobile.locator("#username").fill(username);
    await mobile.locator("#password").fill(pass);
    await mobile.getByRole("button", { name: /^Sign in$/ }).click();
    await mobile.waitForTimeout(3000);
  }
  await mobile.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  await mobile.getByLabel("Search customers").fill("The Gathery");
  await mobile.waitForTimeout(400);
  await mobile.getByRole("button", { name: /The Gathery/i }).first().click();
  await mobile.waitForTimeout(800);
  await mobile.screenshot({ path: "/workspace/screenshots/customer-history-mobile.png" });
  const mobileBox = await mobile.getByRole("dialog").first().boundingBox();
  verdict.steps.push(`mobile sheet width ${mobileBox?.width ?? "?"}`);
  await mobile.close();

  verdict.ok = errors.length === 0 && hasHistory;
} catch (e) {
  verdict.errors.push(String(e));
} finally {
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();
  process.exit(verdict.ok ? 0 : 1);
}
