import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
page.setDefaultTimeout(20000);
const verdict = { errors: [], warehouse: {}, service: {}, ticket: {} };

function overlap(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x > 2 && y > 2;
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  const stamp = Date.now().toString(36).slice(-4);
  await page.locator("#username").fill(`chuy.ap${stamp}`);
  await page.locator("#email").fill(`chuy.ap${stamp}@katz.test`);
  await page.locator("#password").fill("DeskBays99!");
  await page.getByRole("button", { name: "Create account" }).click();
  for (let i = 0; i < 20; i++) {
    const t = await page.locator("body").innerText();
    if (/Service tracker|Operations clock|waiting for approval/i.test(t)) break;
    await page.waitForTimeout(400);
  }

  await page.goto(`${BASE}/warehouse`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const headers = await page.locator("table thead th button").allTextContents();
  verdict.warehouse.headers = headers.map((h) => h.trim()).filter(Boolean);
  if (verdict.warehouse.headers.join("") !== "ABCDEFGHIJKLMNOP") {
    verdict.errors.push(`Expected A–P, got ${verdict.warehouse.headers.join(",")}`);
  }
  await page.locator("table thead").screenshot({ path: "/workspace/screenshots/qa-warehouse-ap-headers.png" });
  await page.screenshot({ path: "/workspace/screenshots/qa-warehouse-ap.png" });

  const pBtn = page.locator("table thead th button", { hasText: /^P$/ });
  await pBtn.click();
  await page.waitForTimeout(500);
  const pList = await page.locator("main").innerText();
  verdict.warehouse.pFilter = /Needs bay|\bP-L/.test(pList);
  await page.screenshot({ path: "/workspace/screenshots/qa-warehouse-bay-p.png" });

  await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const completeCard = page.getByRole("button", { name: /Complete/i }).first();
  await completeCard.click();
  await page.waitForTimeout(600);
  verdict.service.completePressed = (await completeCard.getAttribute("aria-pressed")) === "true";
  if (!verdict.service.completePressed) verdict.errors.push("Complete bubble did not look selected");
  await page.screenshot({ path: "/workspace/screenshots/qa-complete-filter.png" });
  const rowStatuses = await page.locator("ul li").allTextContents();
  const sample = rowStatuses.slice(0, 8).map((t) => t.replace(/\s+/g, " ").slice(0, 80));
  verdict.service.sample = sample;
  const openish = sample.filter((t) => /Needs Scheduling|In Progress|Dispatched/i.test(t));
  if (openish.length) verdict.errors.push(`Complete filter still shows open tickets: ${openish.join(" | ")}`);
  await completeCard.click();
  await page.waitForTimeout(300);
  verdict.service.cleared = (await completeCard.getAttribute("aria-pressed")) !== "true";

  await page.getByRole("button", { name: /New call/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("combobox").first().click();
  const custOpt = dialog.getByRole("option").first();
  if (await custOpt.count()) await custOpt.click();
  await page.waitForTimeout(300);
  const equipLabel = dialog.getByText("Equipment", { exact: true });
  await equipLabel.scrollIntoViewIfNeeded();
  const equipBox = dialog.locator("div").filter({ has: dialog.getByText("Equipment", { exact: true }) }).last();
  const search = dialog.getByPlaceholder(/Search or add a machine|Add another/i);
  await search.click();
  const opts = dialog.getByRole("option");
  const n = Math.min(await opts.count(), 6);
  for (let i = 0; i < n; i++) {
    await opts.nth(i).click();
    await page.waitForTimeout(120);
    await search.click().catch(() => {});
  }
  await page.waitForTimeout(300);
  await search.scrollIntoViewIfNeeded();
  const geom = await dialog.evaluate(() => {
    const root = document.querySelector("[role=dialog]");
    const chipRow = root.querySelector("[data-equip-chips]");
    const chips = [...(chipRow?.querySelectorAll("li") ?? [])].map((el) => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent.trim().slice(0, 36), x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const searches = [...root.querySelectorAll("[role=combobox]")];
    const equipSearch = searches.at(-1)?.getBoundingClientRect();
    const label = [...root.querySelectorAll("label, p")].find((el) => el.textContent.trim() === "Equipment");
    const lr = label?.getBoundingClientRect();
    return {
      chips,
      search: equipSearch ? { x: equipSearch.x, y: equipSearch.y, w: equipSearch.width, h: equipSearch.height } : null,
      label: lr ? { y: lr.y, h: lr.height } : null,
    };
  });
  verdict.ticket.chipCount = geom.chips.length;
  verdict.ticket.chipsAboveSearch = !!(
    geom.search && geom.chips.length && geom.chips.every((c) => c.y + c.h <= geom.search.y + 4)
  );
  const chipHits = [];
  for (let i = 0; i < geom.chips.length; i++) {
    for (let j = i + 1; j < geom.chips.length; j++) {
      if (overlap(geom.chips[i], geom.chips[j])) chipHits.push([geom.chips[i].text, geom.chips[j].text]);
    }
  }
  verdict.ticket.chipOverlap = chipHits;
  if (chipHits.length) verdict.errors.push(`Equipment chips overlap: ${JSON.stringify(chipHits)}`);
  if (!verdict.ticket.chipsAboveSearch) {
    verdict.errors.push(`Equipment chips not above search: ${JSON.stringify(geom)}`);
  }
  const equipShot = dialog.locator("[data-equip-chips]").locator("xpath=ancestor::div[contains(@class,'min-w-0')][1]");
  if (await equipShot.count()) {
    await equipShot.screenshot({ path: "/workspace/screenshots/qa-ticket-equip-chips.png" });
  }
  await page.screenshot({ path: "/workspace/screenshots/qa-ticket-no-overlap.png" });
} catch (err) {
  verdict.errors.push(String(err));
  await page.screenshot({ path: "/workspace/screenshots/qa-bays-fail.png" }).catch(() => {});
} finally {
  writeFileSync("/workspace/screenshots/qa-bays-bubbles.json", JSON.stringify(verdict, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();
}
