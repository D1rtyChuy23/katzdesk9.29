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

const shot = (name) => page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
const verdict = { errors, bugs: [] };

async function pickCombo(trigger, typed, preferExisting = true) {
  await trigger.click();
  await page.waitForTimeout(200);
  const pop = page.locator("[data-combo-popover]").last();
  await pop.locator("input").fill(typed);
  await page.waitForTimeout(350);
  if (preferExisting) {
    const opt = pop.locator("button[role='option']").filter({ hasText: new RegExp(typed, "i") }).first();
    if (await opt.count()) {
      await opt.click();
      await page.waitForTimeout(250);
      return;
    }
  }
  const add = pop.getByRole("button", { name: new RegExp(`Add .${typed}`, "i") });
  if (await add.count()) await add.click();
  else await page.keyboard.press("Enter");
  await page.waitForTimeout(350);
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.removeItem("katz-desk-pending"));
  await page.reload({ waitUntil: "networkidle" });
  const back = page.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  const toggle = page.getByRole("button", { name: /Already have an account/i });
  if (await toggle.count()) await toggle.click();
  await page.locator("#username").fill("chuy.opsxhw6");
  await page.locator("#password").fill("DeskPublish99!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "New install" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await shot("qa-twin-dialog");

  await pickCombo(dialog.getByRole("button", { name: "Customer" }), "QA Twin Machines", false);
  await shot("qa-twin-customer");

  const equip = dialog.getByRole("combobox", { name: "Equipment" });
  await pickCombo(equip, "Cameo", true);
  await pickCombo(equip, "Cameo", true);
  await shot("qa-twin-equip");

  const serials = dialog.locator('input[placeholder="Type the serial"]');
  const n = await serials.count();
  verdict.serialFields = n;
  if (n < 2) {
    verdict.bugs.push("Did not get two serial fields");
    verdict.dialogText = await dialog.innerText();
  } else {
    await serials.nth(0).fill("SN-ALPHA");
    await serials.nth(1).fill("SN-BRAVO");
  }
  await dialog.getByRole("button", { name: "Create" }).click();
  await page.waitForTimeout(2000);
  await shot("qa-twin-created");
  const createdText = await page.locator("body").innerText();
  verdict.createdHasBoth = /SN-ALPHA/.test(createdText) && /SN-BRAVO/.test(createdText);

  const sheetSerials = page.locator('input[placeholder="Type the serial"]');
  if ((await sheetSerials.count()) >= 2) {
    await sheetSerials.nth(0).fill("SN-ALPHA-KEEP");
    await sheetSerials.nth(1).fill("SN-BRAVO-KEEP");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  await page.getByText("QA Twin Machines").first().click();
  await page.waitForTimeout(900);
  const reopened = await page.locator("body").innerText();
  verdict.persistedAfterClose = /SN-ALPHA-KEEP/.test(reopened) && /SN-BRAVO-KEEP/.test(reopened);
  await shot("qa-twin-reopened");
  if (!verdict.createdHasBoth) verdict.bugs.push("Create did not keep both serials");
  if (!verdict.persistedAfterClose) verdict.bugs.push("Serials lost after closing the sheet");
} catch (e) {
  verdict.crash = e instanceof Error ? e.stack || e.message : String(e);
  await shot("qa-twin-crash");
  try {
    verdict.body = (await page.locator("body").innerText()).slice(0, 1500);
  } catch {
    /* ignore */
  }
}

verdict.errors = errors;
writeFileSync("/workspace/screenshots/qa-twin.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.crash || verdict.bugs.length || errors.length ? 1 : 0);
