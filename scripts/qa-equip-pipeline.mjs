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
const username = `chuy.fix${stamp}`;
const pass = "DeskHistory99!";

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await attach(page);

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(`${username}@katz.test`);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4000);

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const installText = await page.locator("body").innerText();
  const hasLead = /2-week lead-time/i.test(installText);
  verdict.steps.push(hasLead ? "install page has lead-time disclaimer" : "MISSING install disclaimer");
  if (!hasLead) verdict.errors.push("install page missing 2-week lead-time");
  await page.screenshot({ path: "/workspace/screenshots/install-leadtime.png" });

  await page.getByRole("button", { name: /New install/i }).click();
  await page.waitForTimeout(400);
  const dialog = page.getByRole("dialog");
  const dialogText = await dialog.innerText();
  const dialogLead = /2-week lead-time/i.test(dialogText);
  verdict.steps.push(dialogLead ? "new-install dialog has disclaimer" : "MISSING dialog disclaimer");
  if (!dialogLead) verdict.errors.push("new install dialog missing disclaimer");

  await dialog.getByRole("combobox", { name: "Equipment" }).click();
  await page.waitForTimeout(200);
  const search = page.locator("input[placeholder*='Search the full equipment']").last();
  await search.fill("GB/5 S 3 Group");
  await page.waitForTimeout(400);
  const option = page.getByRole("option", { name: /La Marzocco GB\/5 S 3 Group AV/i }).first();
  if (await option.count()) await option.click();
  else {
    const any = page.getByRole("button", { name: /La Marzocco GB\/5 S 3 Group AV/i }).first();
    if (await any.count()) await any.click();
    else verdict.errors.push("could not pick GB/5 S 3 Group AV");
  }
  await page.waitForTimeout(400);
  const chips = dialog.locator("span").filter({ hasText: /La Marzocco|5 S 3 Group/ });
  const chipTexts = await chips.allInnerTexts();
  verdict.steps.push(`equipment chips: ${JSON.stringify(chipTexts.map((t) => t.trim()).filter(Boolean))}`);
  const split = chipTexts.some((t) => /^5 S 3 Group/i.test(t.trim())) && chipTexts.some((t) => /La Marzocco GB$/i.test(t.trim()));
  if (split) verdict.errors.push("GB/5 name was split into two chips");
  const intact = chipTexts.some((t) => /GB\/5 S 3 Group AV/i.test(t));
  if (!intact) verdict.errors.push("full GB/5 S 3 Group AV chip not shown");
  await page.screenshot({ path: "/workspace/screenshots/equip-unsplit.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.goto(`${BASE}/pipeline`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const pipe = await page.locator("body").innerText();
  const gtoFirst = /Good to order/i.test(pipe);
  const steps = /Step 1|Good to order first|waiting to be ordered/i.test(pipe);
  verdict.steps.push(gtoFirst ? "pipeline shows Good to order" : "pipeline missing GTO");
  verdict.steps.push(steps ? "pipeline describes GTO then Ordered" : "pipeline missing step copy");
  const chipsOrder = await page.locator("button[aria-pressed]").allInnerTexts();
  verdict.steps.push(`pipeline chips: ${JSON.stringify(chipsOrder)}`);
  if (chipsOrder[0] && !/good to order/i.test(chipsOrder[0])) {
    verdict.errors.push(`first chip should be Good to order, got ${chipsOrder[0]}`);
  }
  await page.screenshot({ path: "/workspace/screenshots/pipeline-steps.png" });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await attach(mobile);
  await mobile.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  if (await mobile.locator("#username").count()) {
    const signToggle = mobile.getByRole("button", { name: /Have an account|Sign in/i });
    if (await signToggle.count()) await signToggle.click();
    await mobile.locator("#username").fill(username);
    await mobile.locator("#password").fill(pass);
    await mobile.getByRole("button", { name: /^Sign in$/ }).click();
    await mobile.waitForTimeout(3000);
  }
  await mobile.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(500);
  await mobile.screenshot({ path: "/workspace/screenshots/install-leadtime-mobile.png" });
  await mobile.goto(`${BASE}/pipeline`, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(500);
  await mobile.screenshot({ path: "/workspace/screenshots/pipeline-steps-mobile.png" });
  await mobile.close();

  verdict.ok = errors.length === 0;
} catch (e) {
  verdict.errors.push(String(e));
} finally {
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();
  process.exit(verdict.ok ? 0 : 1);
}
