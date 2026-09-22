import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const verdict = {
  ok: false,
  unsourcedGone: false,
  servicePlaceholder: false,
  claimVisible: false,
  claimed: false,
  pendingBefore: null,
  pendingAfterRemove: null,
  bouncedBack: null,
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
  await signup(page, `chuy.ho${stamp}`, `chuy.ho${stamp}@katz.test`, "DeskHandoff99!");
  verdict.steps.push("signed in");

  await page.goto(`${BASE}/handoff`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const allBtn = page.getByRole("button", { name: /^All$/ });
  if (await allBtn.count()) await allBtn.click();
  await page.waitForTimeout(400);
  const body = await page.locator("body").innerText();
  const recentBlock = body.split("Recent notes")[1]?.slice(0, 1800) ?? body;
  verdict.unsourcedGone = !/Service/.test(recentBlock)
    ? false
    : !/(Amanda|Oliver|Lizbeth|Charles|Josh) · (Milton|The Gathery|Tejas|Hyde Park|Eurest)/i.test(
        recentBlock,
      );
  verdict.servicePlaceholder = /Service · (Milton|The Gathery|Tejas|Hyde Park)/i.test(recentBlock) || /Service/.test(recentBlock);
  verdict.claimVisible = await page.getByRole("button", { name: "Claim" }).count() > 0;
  await page.screenshot({ path: "/workspace/screenshots/handoff-notes.png" });
  verdict.steps.push(`notes unsourcedGone=${verdict.unsourcedGone} service=${verdict.servicePlaceholder} claim=${verdict.claimVisible}`);

  if (verdict.claimVisible) {
    await page.getByRole("button", { name: "Claim" }).first().click();
    await page.waitForTimeout(800);
    const after = await page.locator("body").innerText();
    verdict.claimed = after.includes(`chuy.ho${stamp}`) || /Note is under your name/i.test(after);
    await page.screenshot({ path: "/workspace/screenshots/handoff-claimed.png" });
  }

  const pendingSection = page.getByRole("heading", { name: /Completed deals not yet/i });
  const send = page.getByRole("button", { name: /Send to installs/i });
  verdict.pendingBefore = await send.count();
  if (verdict.pendingBefore > 0) {
    const customer = await pendingSection.locator("..").locator("li").first().locator("p.font-medium").innerText().catch(async () => {
      return page.locator("section").filter({ hasText: "Completed deals" }).locator("li p.font-medium").first().innerText();
    });
    await send.first().click();
    await page.waitForTimeout(1200);
    await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const row = page.getByText(customer, { exact: false }).first();
    await row.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    const remove = page.getByRole("button", { name: /Remove/i }).last();
    if (await remove.count()) {
      page.once("dialog", (d) => d.accept().catch(() => {}));
      await remove.click();
      await page.waitForTimeout(600);
    }
    await page.goto(`${BASE}/handoff`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    if (await allBtn.count()) await allBtn.click();
    await page.waitForTimeout(400);
    verdict.pendingAfterRemove = await page.getByRole("button", { name: /Send to installs/i }).count();
    const afterBody = await page.locator("body").innerText();
    verdict.bouncedBack = afterBody.includes(customer) && afterBody.includes("Completed deals");
    await page.screenshot({ path: "/workspace/screenshots/handoff-after-remove.png" });
    verdict.steps.push(`customer=${customer} pendingAfter=${verdict.pendingAfterRemove} bounced=${verdict.bouncedBack}`);
  } else {
    verdict.steps.push("no pending deals — creating one to test bounce-back");
    const cafe = `Bounce Cafe ${stamp}`;
    await page.goto(`${BASE}/pipeline`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /New deal/i }).click();
    await page.waitForTimeout(400);
    const cust = page.getByRole("combobox", { name: /Customer/i });
    await cust.click();
    await cust.fill(cafe);
    await page.waitForTimeout(300);
    const addName = page.getByRole("button", { name: new RegExp(cafe) }).first();
    if (await addName.count()) await addName.click();
    else await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /^Create$/i }).click();
    await page.waitForTimeout(1200);
    const complete = page.locator("select").filter({ has: page.locator("option[value='complete']") }).first();
    if (await complete.count()) {
      await complete.selectOption("complete");
      const save = page.getByRole("button", { name: /Save/i }).first();
      if (await save.count()) await save.click();
      await page.waitForTimeout(1000);
    }
    await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const bounceRow = page.getByText(cafe, { exact: false }).first();
    if (await bounceRow.count()) {
      await bounceRow.click();
      await page.waitForTimeout(600);
    }
    page.once("dialog", (d) => d.accept().catch(() => {}));
    const removeBtn = page.getByRole("button", { name: /Remove Bounce Cafe|Remove/i }).first();
    if (await page.getByRole("button", { name: new RegExp(`Remove ${cafe}`) }).count()) {
      await page.getByRole("button", { name: new RegExp(`Remove ${cafe}`) }).click();
    } else if (await removeBtn.count()) {
      await removeBtn.click();
    }
    await page.waitForTimeout(800);
    await page.goto(`${BASE}/handoff`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const all2 = page.getByRole("button", { name: /^All$/ });
    if (await all2.count()) await all2.click();
    await page.waitForTimeout(400);
    const afterBody = await page.locator("body").innerText();
    const pendingText = afterBody.includes("Completed deals not yet")
      ? afterBody.split("Completed deals not yet")[1]?.split("Open asks")[0] ?? ""
      : "";
    verdict.bouncedBack = pendingText.includes(cafe);
    verdict.pendingAfterRemove = (pendingText.match(/Send to installs/g) || []).length;
    await page.screenshot({ path: "/workspace/screenshots/handoff-after-remove.png" });
    verdict.steps.push(`bounce cafe=${cafe} bounced=${verdict.bouncedBack}`);
  }
} catch (e) {
  verdict.errors.push(String(e));
}

verdict.errors.push(...errors);
verdict.ok =
  verdict.unsourcedGone &&
  verdict.servicePlaceholder &&
  verdict.claimVisible &&
  verdict.bouncedBack !== true &&
  verdict.errors.filter((e) => !/^console:/.test(e)).length === 0;

writeFileSync("/workspace/screenshots/qa-handoff.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.ok ? 0 : 1);
