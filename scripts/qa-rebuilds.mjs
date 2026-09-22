import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
mkdirSync("/workspace/artifacts", { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

async function signIn() {
  const stamp = Date.now().toString(36).slice(-4);
  const username = `chuy.rb${stamp}`;
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(`${username}@katz.test`);
  await page.locator("#password").fill("DeskRebuild99!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(6000);
  return username;
}

const verdict = { errors: [], shots: [], exportFile: null, statuses: [], waitingReason: false, health: [], columns: [] };

try {
  await signIn();

  await page.goto(`${BASE}/rebuilds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const body = await page.locator("main").innerText();
  const need = ["Queued", "In progress", "Waiting", "Testing", "Ready", "Completed", "Cancelled"];
  verdict.statuses = need.filter((s) => body.includes(s));
  if (verdict.statuses.length < 7) {
    verdict.errors.push(`Board missing statuses: ${need.filter((s) => !verdict.statuses.includes(s)).join(", ")}`);
  }
  await shot("qa-rebuild-board");
  verdict.shots.push("qa-rebuild-board");

  const waitingCard = page.getByRole("button", { name: /Hyde Park ITCB/i }).first();
  if (await waitingCard.count()) {
    await waitingCard.click();
    await page.waitForTimeout(800);
    const sheetLoc = page.locator(".sheet-panel").last();
    await sheetLoc.waitFor({ state: "visible", timeout: 5000 }).catch(() => null);
    const sheet = (await sheetLoc.innerText().catch(() => "")) || (await page.innerText());
    verdict.waitingReason = /Parts on order/i.test(sheet) && /Reason delayed/i.test(sheet);
    if (!verdict.waitingReason) verdict.errors.push(`Waiting sheet missing reason: ${sheet.slice(0, 400)}`);
    const healthHit = /Overdue|At risk|No date|On track/i.test(sheet);
    if (!healthHit) verdict.errors.push("Waiting sheet missing health flag");
    if (await sheetLoc.count()) {
      await sheetLoc.screenshot({ path: "/workspace/screenshots/qa-rebuild-waiting.png" });
    } else {
      await shot("qa-rebuild-waiting");
    }
    verdict.shots.push("qa-rebuild-waiting");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } else {
    verdict.errors.push("Waiting Hyde Park card not found");
    await shot("qa-rebuild-waiting");
  }

  await page.getByRole("button", { name: /^Timeline$/ }).click();
  await page.waitForTimeout(800);
  const timeline = await page.locator("main").innerText();
  if (!/Rebuild timeline/i.test(timeline)) verdict.errors.push("Timeline heading missing");
  await shot("qa-rebuild-timeline");
  verdict.shots.push("qa-rebuild-timeline");

  await page.locator("#desk-main").getByRole("button", { name: /^Export$/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.locator("#export-type").selectOption("rebuilds");
  await page.getByRole("button", { name: /^Preview$/ }).click();
  await page.waitForTimeout(2500);
  const preview = await page.getByRole("dialog").innerText();
  if (!/Days open/i.test(preview) || !/Days to target/i.test(preview)) {
    verdict.errors.push(`Export preview missing days columns: ${preview.slice(0, 500)}`);
  }
  await shot("qa-rebuild-export");
  verdict.shots.push("qa-rebuild-export");

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.getByRole("button", { name: /Download Excel/i }).click(),
  ]);
  const filename = download.suggestedFilename();
  const dest = `/workspace/artifacts/${filename}`;
  await download.saveAs(dest);
  verdict.exportFile = filename;
  const wb = XLSX.read(readFileSync(dest));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const header = aoa.find((r) => r.includes("Project") || r.includes("Days open"));
  verdict.columns = header || [];
  if (!header?.includes("Days open") || !header?.includes("Days to target") || !header?.includes("Health")) {
    verdict.errors.push(`Export header ${JSON.stringify(header)}`);
  }
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const clock = await page.locator("main").innerText();
  if (!/Rebuild/i.test(clock)) verdict.errors.push("Clock missing Rebuild section");
  const rebuildHead = page.locator("h2", { hasText: /^Rebuild$/ });
  if (await rebuildHead.count()) {
    await rebuildHead.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }
  await shot("qa-rebuild-clock");
  verdict.shots.push("qa-rebuild-clock");
} catch (e) {
  verdict.errors.push(e instanceof Error ? e.message : String(e));
  await shot("qa-rebuild-fail");
}

verdict.pageErrors = errors;
writeFileSync("/workspace/screenshots/qa-rebuilds.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
if (verdict.errors.length) process.exit(1);
