import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-4);
const admin = `chuy.gate${stamp}`;
const pass = "DeskOps99!!";

const browser = await chromium.launch({ headless: true });
const verdict = {
  pipelineChips: false,
  gtoFilter: false,
  orderedFilter: false,
  removeDeal: false,
  duplicateWarn: false,
  duplicateBadge: false,
  removeInstall: false,
  mobileChips: false,
  errors: [],
};

async function signup(page, username, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("katz-desk-pending");
    } catch {
      /* ignore */
    }
  });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(2500);
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("dialog", async (d) => {
    console.log("dialog:", d.type(), d.message());
    await d.accept();
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("console.error:", msg.text());
  });
  page.on("pageerror", (err) => console.log("pageerror:", err.message));
  await signup(page, admin, `${admin}@katz.test`);

  await page.goto(`${BASE}/pipeline`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const pipeText = await page.locator("body").innerText();
  verdict.pipelineChips =
    /Good to order/i.test(pipeText) && /Equipment ordered/i.test(pipeText);
  await page.screenshot({ path: "/workspace/screenshots/pipeline-gates.png" });

  const gtoChip = page.getByRole("button", { name: /Good to order \(/i });
  await gtoChip.click();
  await page.waitForTimeout(400);
  verdict.gtoFilter = (await gtoChip.getAttribute("aria-pressed")) === "true";
  await page.screenshot({ path: "/workspace/screenshots/pipeline-gto.png" });

  const orderedChip = page.getByRole("button", { name: /Equipment ordered \(/i });
  await orderedChip.click();
  await page.waitForTimeout(400);
  verdict.orderedFilter = (await orderedChip.getAttribute("aria-pressed")) === "true";
  await page.screenshot({ path: "/workspace/screenshots/pipeline-ordered.png" });

  await page.locator("button[aria-pressed]").filter({ hasText: /^Open \(/ }).click();
  await page.waitForTimeout(400);
  const list = page.locator("div.mt-4.overflow-hidden.rounded-xl");
  const names = await list.locator("button[data-testid=archive-row]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label")),
  );
  console.log("archive buttons", names);
  const target = list.locator("button[data-testid=archive-row]").first();
  const targetName = await target.getAttribute("aria-label");
  await target.click();
  await page.waitForTimeout(1200);
  const after = await page.locator("body").innerText();
  const gone = targetName ? !after.includes(targetName.replace("Remove ", "").replace(" from the list", "")) : false;
  const toasted = /Removed /i.test(after);
  verdict.removeDeal = gone || toasted || /Open \(7\)/.test(after);
  if (!verdict.removeDeal) verdict.errors.push(`removeDeal failed for ${targetName}`);
  await page.screenshot({ path: "/workspace/screenshots/pipeline-removed.png" });

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "New install" }).click();
  const dialog = page.locator("[role=dialog]");
  await dialog.waitFor({ state: "visible", timeout: 8000 });
  await dialog.getByRole("button", { name: "Customer" }).click();
  const search = dialog.locator("input").filter({ visible: true }).first();
  await search.fill("Doug's Diner");
  await page.waitForTimeout(400);
  const opt = page.locator("[role=listbox] [role=option]").filter({ hasText: /Doug/i }).first();
  if (await opt.count()) await opt.click();
  else await search.press("Enter");
  await page.waitForTimeout(500);
  const dlgText = await dialog.innerText();
  verdict.duplicateWarn = /already has/i.test(dlgText);
  await page.screenshot({ path: "/workspace/screenshots/install-dupe-warn.png" });
  await dialog.getByRole("button", { name: /Create new request|Create/i }).click();
  await page.waitForTimeout(1500);
  const listText = await page.locator("body").innerText();
  verdict.duplicateBadge = /Possible duplicate/i.test(listText);
  await page.screenshot({ path: "/workspace/screenshots/install-dupe-badge.png" });

  const sheet = page.locator("[role=dialog]").filter({ hasText: "Possible duplicate" });
  if (await sheet.count()) {
    const banner = await sheet.innerText();
    if (!/already had an install request/i.test(banner)) {
      verdict.errors.push("sheet missing duplicate banner");
    }
    await sheet.getByRole("button", { name: /Remove from list/i }).click();
    await page.waitForTimeout(1000);
    verdict.removeInstall = !(await page.locator("body").innerText()).includes("Possible duplicate");
  } else {
    const dupeRow = page.locator("article").filter({ hasText: "Possible duplicate" }).first();
    if (await dupeRow.count()) {
      await dupeRow.locator("button[data-testid=archive-row]").click({ force: true });
      await page.waitForTimeout(1000);
      verdict.removeInstall = !(await page.locator("body").innerText()).includes("Possible duplicate");
    } else {
      verdict.errors.push("no duplicate badge after create");
    }
  }
  await page.screenshot({ path: "/workspace/screenshots/install-after-remove.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/pipeline`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/workspace/screenshots/pipeline-gates-mobile.png" });
  const mobileText = await page.locator("body").innerText();
  verdict.mobileChips = /Good to order/i.test(mobileText) && /Equipment ordered/i.test(mobileText);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  if (overflow) verdict.errors.push("mobile horizontal overflow on pipeline");

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/workspace/screenshots/installs-mobile-gates.png" });
} catch (err) {
  verdict.errors.push(err instanceof Error ? err.message : String(err));
  console.error(err);
} finally {
  await browser.close();
  console.log(JSON.stringify(verdict, null, 2));
}
