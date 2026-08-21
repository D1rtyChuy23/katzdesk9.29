import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`page: ${e}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

const shot = async (name) => {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
};

async function clearPending() {
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("katz-desk-pending");
    } catch {
      /* ignore */
    }
  });
}

async function gotoLogin() {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await clearPending();
  await page.reload({ waitUntil: "networkidle" });
  const back = page.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
}

async function signIn(username, pass) {
  await gotoLogin();
  const toggle = page.getByRole("button", { name: /Already have an account/i });
  if (await toggle.count()) await toggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(3500);
}

async function signup(username, email, pass) {
  await gotoLogin();
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(3500);
}

const pass = "DeskPublish99!";
const existing = "chuy.opsxhw6";
const fresh = `chuy.ops${Date.now().toString(36).slice(-4)}`;
const verdict = { user: existing, pages: {}, bugs: [], errors };

try {
  await signIn(existing, pass);
  let body = await page.locator("body").innerText();
  if (!/Operations clock|Active calls/i.test(body)) {
    verdict.user = fresh;
    await signup(fresh, `${fresh}@katz.test`, pass);
    body = await page.locator("body").innerText();
  }
  verdict.clock = /Operations clock|Active calls/i.test(body);
  verdict.waiting = /Waiting for approval/i.test(body);
  await shot("qa3-clock");

  if (!verdict.clock) {
    throw new Error("Owner did not reach the clock: " + body.slice(0, 240));
  }

  const routes = [
    ["/service", "qa3-service", /Service/i],
    ["/tlc", "qa3-tlc", /TLC|Factor/i],
    ["/pms", "qa3-pms", /Preventative|PM/i],
    ["/pipeline", "qa3-pipeline", /Pipeline|deal/i],
    ["/installs", "qa3-installs", /Install/i],
    ["/handoff", "qa3-handoff", /Handoff|Mine/i],
    ["/warehouse", "qa3-warehouse", /Warehouse|Barn/i],
    ["/locations", "qa3-locations", /Location|Deployed/i],
    ["/modules", "qa3-modules", /Module/i],
    ["/recipes", "qa3-recipes", /Recipe|House/i],
    ["/access", "qa3-access", /Access|Waiting|Approved/i],
  ];
  for (const [path, name, re] of routes) {
    const before = errors.length;
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    const text = await page.locator("body").innerText();
    verdict.pages[path] = { ok: re.test(text), newErrors: errors.slice(before) };
    await shot(name);
  }

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "New install" }).click();
  await page.waitForTimeout(400);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").first().click();
  await page.waitForTimeout(200);
  const custInput = page.locator("[data-combo-popover] input").first();
  await custInput.fill("QA Twin Machines");
  const addCust = page.getByRole("button", { name: /Add “QA Twin Machines”/i });
  if (await addCust.count()) await addCust.click();
  else await page.keyboard.press("Enter");
  await page.waitForTimeout(400);

  const equipCombo = dialog.locator('[role="combobox"]').nth(1);
  await equipCombo.click();
  await page.waitForTimeout(250);
  const search = page.locator("[data-combo-popover] input").first();
  await search.fill("Cameo");
  await page.waitForTimeout(300);
  const cameo = page.locator("[data-combo-popover] button").filter({ hasText: /Cameo/i }).first();
  if (await cameo.count()) {
    await cameo.click();
  } else {
    await page.getByRole("button", { name: /Add “/i }).first().click();
  }
  await page.waitForTimeout(350);
  await equipCombo.click();
  await page.waitForTimeout(250);
  const search2 = page.locator("[data-combo-popover] input").first();
  await search2.fill("Cameo");
  await page.waitForTimeout(300);
  const cameo2 = page.locator("[data-combo-popover] button").filter({ hasText: /Cameo|add another/i }).first();
  if (await cameo2.count()) await cameo2.click();
  await page.waitForTimeout(400);

  const serials = dialog.locator('input[placeholder="Type the serial"]');
  const serialCount = await serials.count();
  verdict.duplicateFields = serialCount;
  if (serialCount >= 2) {
    await serials.nth(0).fill("SN-ALPHA");
    await serials.nth(1).fill("SN-BRAVO");
  }
  await dialog.getByRole("button", { name: "Create" }).click();
  await page.waitForTimeout(1800);
  await shot("qa3-twin-created");

  const sheet = page.locator("[data-slot='sheet-content'], [role='dialog']").last();
  const afterCreate = await page.locator("body").innerText();
  verdict.createdHasBoth =
    /SN-ALPHA/.test(afterCreate) && /SN-BRAVO/.test(afterCreate);
  const sheetSerials = page.locator('input[placeholder="Type the serial"]');
  if ((await sheetSerials.count()) >= 2) {
    await sheetSerials.nth(0).fill("SN-ALPHA-KEEP");
    await sheetSerials.nth(1).fill("SN-BRAVO-KEEP");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: /QA Twin Machines/i }).first().click();
  await page.waitForTimeout(800);
  const reopened = await page.locator("body").innerText();
  verdict.persistedAfterClose =
    /SN-ALPHA-KEEP/.test(reopened) && /SN-BRAVO-KEEP/.test(reopened);
  await shot("qa3-twin-reopened");

  if (serialCount < 2) verdict.bugs.push("Could not add two of the same machine");
  if (!verdict.createdHasBoth) verdict.bugs.push("Create dialog did not keep both serials");
  if (!verdict.persistedAfterClose) verdict.bugs.push("Serials lost after closing the install sheet");
} catch (e) {
  verdict.crash = e instanceof Error ? e.message : String(e);
  await shot("qa3-crash");
}

verdict.errors = errors;
writeFileSync("/workspace/screenshots/qa3.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.crash || verdict.bugs?.length || errors.length ? 1 : 0);
