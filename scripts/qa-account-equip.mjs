import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
page.setDefaultTimeout(30000);
const verdict = { errors: [], preview: {}, account: {} };

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  const stamp = Date.now().toString(36).slice(-4);
  await page.locator("#username").fill(`chuy.eq${stamp}`);
  await page.locator("#email").fill(`chuy.eq${stamp}@katz.test`);
  await page.locator("#password").fill("DeskEquip99!");
  await page.getByRole("button", { name: "Create account" }).click();
  for (let i = 0; i < 25; i++) {
    const t = await page.locator("body").innerText();
    if (/Service tracker|Operations clock|Customers/i.test(t)) break;
    await page.waitForTimeout(400);
  }

  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const importBtn = page.getByRole("button", { name: /Import equipment list/i });
  if (!(await importBtn.count())) verdict.errors.push("Import equipment list button missing");
  await page.screenshot({ path: "/workspace/screenshots/qa-equip-import-button.png" });

  await page.locator('input[type=file]').setInputFiles("/workspace/attachments/Equipment List.xlsx");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(1500);

  const dialogText = await dialog.innerText();
  verdict.preview.hasAccountCol = /Account/i.test(dialogText);
  verdict.preview.hasModelCol = /Catalog model/i.test(dialogText);
  verdict.preview.hasEquipCol = /Equipment Name/i.test(dialogText);
  verdict.preview.hasSerialCol = /Serial/i.test(dialogText);
  verdict.preview.hasDateCol = /Install date/i.test(dialogText);
  verdict.preview.hasOwnCol = /Ownership/i.test(dialogText);
  verdict.preview.hasStatusCol = /Status/i.test(dialogText);
  verdict.preview.hasFirstMarket = /First Market/i.test(dialogText);
  verdict.preview.hasWalkIn = /Walk\s*-?\s*In/i.test(dialogText);
  verdict.preview.hasNeedsReview = /Needs review/i.test(dialogText);
  verdict.preview.hasMatched = /Matched|Update existing/i.test(dialogText);
  verdict.preview.snippet = dialogText.slice(0, 800);

  const firstRow = dialog.locator("tbody tr").filter({ hasText: "First Market" }).first();
  if (await firstRow.count()) {
    verdict.preview.firstMarketChecked = await firstRow.locator("input[type=checkbox]").isChecked();
    verdict.preview.firstMarketStatus = await firstRow.locator("td").last().innerText();
    verdict.preview.firstMarketCatalog = await firstRow.locator("td").nth(2).innerText();
  } else {
    verdict.errors.push("First Market row missing from preview");
  }

  const walkRow = dialog.locator("tbody tr").filter({ hasText: /Walk\s*-?\s*In/i }).first();
  if (await walkRow.count()) {
    verdict.preview.walkChecked = await walkRow.locator("input[type=checkbox]").isChecked();
    verdict.preview.walkStatus = await walkRow.locator("td").last().innerText();
  } else {
    await dialog.getByRole("button", { name: /Needs review/i }).click();
    await page.waitForTimeout(500);
    const walk2 = dialog.locator("tbody tr").filter({ hasText: /Walk\s*-?\s*In/i }).first();
    if (await walk2.count()) {
      verdict.preview.walkChecked = await walk2.locator("input[type=checkbox]").isChecked();
      verdict.preview.walkStatus = await walk2.locator("td").last().innerText();
      verdict.preview.hasWalkIn = true;
    } else {
      verdict.errors.push("Walk-In review row missing from preview");
    }
  }

  await dialog.screenshot({ path: "/workspace/screenshots/qa-equip-import-preview.png" });

  if (verdict.preview.walkChecked) verdict.errors.push("Walk-In row should not be checked");
  if (verdict.preview.firstMarketChecked === false) verdict.errors.push("First Market confident match should be checked");

  await dialog.getByRole("button", { name: /Deselect all/i }).click();
  await page.waitForTimeout(200);
  const firstMarketRows = dialog.locator("tbody tr").filter({ hasText: "First Market" });
  const n = await firstMarketRows.count();
  for (let i = 0; i < n; i++) {
    const box = firstMarketRows.nth(i).locator("input[type=checkbox]");
    if (!(await box.isChecked()) && (await box.isEnabled())) await box.check();
  }
  verdict.preview.confirming = await firstMarketRows.count();
  page.setDefaultTimeout(60000);
  await dialog.getByRole("button", { name: /Confirm import/i }).click();
  await page.getByText(/Equipment list saved/i).waitFor({ timeout: 60000 }).catch(async () => {
    const still = await page.getByRole("heading", { name: "Import equipment list" }).count();
    if (still) {
      const t = await page.getByRole("dialog").innerText().catch(() => "");
      verdict.errors.push(`Confirm did not finish: ${t.slice(0, 240)}`);
    }
  });
  await page.waitForTimeout(1500);

  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  await page.getByLabel("Search customers").fill("First Market");
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /First Market/i }).first().click();
  await page.waitForTimeout(1200);
  const sheet = page.locator("[data-state=open], [role=dialog]").last();
  const sheetText = (await page.locator("body").innerText()).slice(0, 4000);
  verdict.account.hasSection = /Equipment on this account/i.test(sheetText);
  verdict.account.hasItcb = /ITCB/i.test(sheetText);
  verdict.account.hasGrinder = /GR2\.2|Grinder/i.test(sheetText);
  await page.screenshot({ path: "/workspace/screenshots/qa-equip-account.png" });
  if (!verdict.account.hasSection) verdict.errors.push("Account sheet missing equipment list");
  if (!verdict.account.hasItcb) verdict.errors.push("First Market missing imported ITCB");
} catch (e) {
  verdict.errors.push(e instanceof Error ? e.message : String(e));
  await page.screenshot({ path: "/workspace/screenshots/qa-equip-error.png" }).catch(() => {});
}

writeFileSync("/workspace/screenshots/qa-equip-import.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
if (verdict.errors.length) process.exit(1);
