import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const verdict = { ok: true, checks: [] };

function note(ok, msg) {
  verdict.checks.push({ ok, msg });
  if (!ok) {
    verdict.ok = false;
    errors.push(msg);
  }
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  } catch (e) {
    errors.push(`shot ${name}: ${e.message}`);
  }
}

async function signUp(page, username, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(`${username}@katz.test`);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(5000);
}

async function waitDesk(page) {
  for (let i = 0; i < 20; i++) {
    const t = await page.locator("body").innerText();
    if (/Operations clock|Install clock|Sales pipeline|Access|In-house rebuilds/i.test(t) && !/Choose a username/i.test(t)) {
      return "desk";
    }
    if (/waiting for approval/i.test(t)) return "pending";
    await page.waitForTimeout(700);
  }
  return "timeout";
}

try {
  const stamp = Date.now().toString(36).slice(-4);
  const owner = `chuy.rb${stamp}`;
  const pass = "DeskRebuild99!";
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page.on("pageerror", (e) => errors.push(`page: ${e}`));

  await signUp(page, owner, pass);
  await page.goto(`${BASE}/rebuilds`, { waitUntil: "networkidle" });
  const land = await waitDesk(page);
  note(land !== "timeout", `landed on rebuilds (${land})`);
  await page.waitForTimeout(1200);

  const boardText = await page.locator("main").innerText().catch(() => page.locator("body").innerText());
  note(/In-house rebuilds/i.test(boardText), "Rebuilds page heading");
  note(/Drag a project/i.test(boardText), "Drag hint visible");
  note(/Queued|In progress|Waiting/i.test(boardText), "Status columns present");

  const removeBtns = page.locator('[data-testid^="rebuild-remove-"]');
  note((await removeBtns.count()) > 0, "Remove buttons on rebuild cards");
  await shot(page, "qa-rebuild-board");

  const queuedCol = page.locator('[data-testid="rebuild-col-Queued"]');
  const progressCol = page.locator('[data-testid="rebuild-col-In progress"]');
  const queuedCard = queuedCol.locator('[data-testid^="rebuild-card-"]').first();
  const queuedTitle = ((await queuedCard.locator("p").first().innerText().catch(() => "")) || "").trim();
  const beforeQueued = await queuedCol.locator('[data-testid^="rebuild-card-"]').count();
  const beforeProgress = await progressCol.locator('[data-testid^="rebuild-card-"]').count();

  if (await queuedCard.count()) {
    await queuedCard.scrollIntoViewIfNeeded();
    await queuedCard.dragTo(progressCol, { targetPosition: { x: 80, y: 80 } });
    await page.waitForTimeout(1800);
  }
  const afterQueued = await queuedCol.locator('[data-testid^="rebuild-card-"]').count();
  const afterProgress = await progressCol.locator('[data-testid^="rebuild-card-"]').count();
  const moved = afterQueued < beforeQueued || afterProgress > beforeProgress;
  note(moved || /owner and a target|reason delayed/i.test(await page.locator("body").innerText()), "Drag moved a card or asked for missing fields");
  await shot(page, "qa-rebuild-drag");

  const cancelledCol = page.locator('[data-testid="rebuild-col-Cancelled"]');
  const cancelCard = cancelledCol.locator('[data-testid^="rebuild-card-"]').first();
  const cancelCountBefore = await cancelledCol.locator('[data-testid^="rebuild-card-"]').count();
  if (await cancelCard.count()) {
    page.once("dialog", (d) => d.accept());
    await cancelCard.locator('[data-testid^="rebuild-remove-"]').click();
    await page.waitForTimeout(1600);
  }
  const cancelCountAfter = await cancelledCol.locator('[data-testid^="rebuild-card-"]').count();
  note(cancelCountAfter < cancelCountBefore || cancelCountBefore === 0, "Removed a rebuild from the board");
  await shot(page, "qa-rebuild-removed");

  await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /New call/i }).click();
  await page.waitForTimeout(600);
  const dialog = page.getByRole("dialog");
  note((await dialog.count()) > 0, "New call dialog open");

  const equipSearch = dialog.getByRole("combobox").nth(1);
  await equipSearch.click();
  await page.waitForTimeout(400);
  const option = dialog.getByRole("option").first();
  if (await option.count()) {
    const name = (await option.innerText()).trim();
    await option.click();
    await page.waitForTimeout(400);
    const chip = dialog.locator("li").filter({ hasText: name.split("\n")[0] }).first();
    note((await chip.count()) > 0 || (await dialog.innerText()).includes(name.slice(0, 12)), "Equipment chip sits above the search");
  } else {
    await equipSearch.fill("Eversys Cameo");
    await page.waitForTimeout(400);
    const first = dialog.getByRole("option").first();
    if (await first.count()) await first.click();
  }
  await shot(page, "qa-ticket-equipment");

  const dlgText = await dialog.innerText();
  note(/Equipment/i.test(dlgText), "Equipment label in create dialog");
  note(/Each machine is its own chip/i.test(dlgText), "Chip layout note");
  note(/Urgency/i.test(dlgText), "Urgency still below equipment");

  writeFileSync(
    "/workspace/screenshots/qa-rebuild-equip.json",
    JSON.stringify({ ok: verdict.ok, checks: verdict.checks, errors, queuedTitle, beforeQueued, afterQueued, beforeProgress, afterProgress }, null, 2),
  );
} catch (e) {
  errors.push(String(e?.stack || e));
  verdict.ok = false;
} finally {
  await browser.close();
  console.log(JSON.stringify({ ok: verdict.ok, checks: verdict.checks, errors }, null, 2));
  if (!verdict.ok) process.exitCode = 1;
}
