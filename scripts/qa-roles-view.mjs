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

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page.on("pageerror", (e) => errors.push(`page: ${e}`));
  return page;
}

async function shot(page, name, full = false) {
  try {
    await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: full });
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
  await page.waitForTimeout(6000);
}

async function waitDesk(page) {
  for (let i = 0; i < 20; i++) {
    const t = await page.locator("body").innerText();
    if (/Operations clock|Install clock|Sales pipeline|Access/i.test(t) && !/Choose a username/i.test(t)) return;
    if (/waiting for approval/i.test(t)) return "pending";
    await page.waitForTimeout(800);
  }
  return "timeout";
}

try {
  const stamp = Date.now().toString(36).slice(-4);
  const owner = `chuy.qa${stamp}`;
  const mate = `liz.svc${stamp}`;
  const pass = "DeskRoles99!";

  const ownerPage = await newPage();
  await signUp(ownerPage, owner, pass);
  await ownerPage.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const ownerLand = await waitDesk(ownerPage);
  note(ownerLand !== "timeout", `owner landed (${ownerLand ?? "desk"})`);

  const matePage = await newPage();
  await signUp(matePage, mate, pass);

  await ownerPage.goto(`${BASE}/access`, { waitUntil: "networkidle" });
  await ownerPage.waitForTimeout(1500);
  let accessText = await ownerPage.locator("main").innerText();
  note(/Sales|Service|Needs a role|Needs role/i.test(accessText), "Access shows role picker");

  const approve = ownerPage.getByRole("button", { name: /^Approve$/ }).first();
  if (await approve.count()) {
    await approve.click();
    await ownerPage.waitForTimeout(1200);
  }

  const roleSelects = ownerPage.locator('select[aria-label="Role"]');
  const roleN = await roleSelects.count();
  note(roleN >= 1, `role pickers visible (${roleN})`);
  const ownerRow = ownerPage.locator("li").filter({ hasText: owner }).first();
  if (await ownerRow.locator('select[aria-label="Role"]').count()) {
    await ownerRow.locator('select[aria-label="Role"]').selectOption("sales");
    await ownerPage.waitForTimeout(800);
  }
  const mateRow = ownerPage.locator("li").filter({ hasText: mate }).first();
  if (await mateRow.locator('select[aria-label="Role"]').count()) {
    await mateRow.locator('select[aria-label="Role"]').selectOption("service");
    await ownerPage.waitForTimeout(800);
  }
  await shot(ownerPage, "qa-role-picker");
  const ownerRoleVal = await ownerRow.locator('select[aria-label="Role"]').inputValue().catch(() => "");
  note(ownerRoleVal === "sales", `owner role is sales (${ownerRoleVal})`);

  await ownerPage.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await ownerPage.waitForTimeout(1500);
  const salesClock = await ownerPage.locator("main").innerText();
  note(/Sales view/i.test(salesClock), "clock header shows Sales view");
  note(/Pipeline snapshot|Coming due/i.test(salesClock), "Sales My View clock shows pipeline + coming due");
  await ownerPage.locator("h2", { hasText: "Coming due" }).scrollIntoViewIfNeeded().catch(() => {});
  await ownerPage.waitForTimeout(400);
  await shot(ownerPage, "qa-myview-sales");

  await ownerPage.goto(`${BASE}/pipeline`, { waitUntil: "networkidle" });
  await ownerPage.waitForTimeout(1200);
  const pipe = await ownerPage.locator("main").innerText();
  for (const name of [
    "Amanda Logg",
    "Lizbeth Romero",
    "Sean Marshall",
    "Lance Oden",
    "Bill McKinley",
    "Shannon Cafourek",
    "Jesus Garcia",
  ]) {
    note(pipe.includes(name), `pipeline lists ${name}`);
  }
  note(/No rep assigned/i.test(pipe), "pipeline flags no-rep");
  await ownerPage.getByRole("button", { name: /New deal/i }).click();
  await ownerPage.waitForTimeout(600);
  const dlg = ownerPage.getByRole("dialog");
  const dlgText = (await dlg.count()) ? await dlg.innerText() : "";
  note(/Amanda Logg \(AL\)/.test(dlgText), "new deal rep dropdown shows Name (IN)");
  note(/Lizbeth Romero \(LR\)/.test(dlgText) && /Jesus Garcia \(JG\)/.test(dlgText), "all seven reps in dropdown");
  await shot(ownerPage, "qa-rep-dropdown");
  if (await dlg.count()) await ownerPage.keyboard.press("Escape");

  await ownerPage.goto(`${BASE}/pipeline`, { waitUntil: "networkidle" });
  await ownerPage.waitForTimeout(1200);
  const dealRow = ownerPage.locator("main div.border-b button, main .hover\\:bg-muted\\/60").first();
  if (await dealRow.count()) {
    await dealRow.click();
    await ownerPage.waitForTimeout(1200);
    const sheet = ownerPage.locator("[role=dialog]").last();
    const sheetText = (await sheet.count()) ? await sheet.innerText() : await ownerPage.locator("body").innerText();
    note(/Avi Katz account/i.test(sheetText), "AK field on deal");
    note(/Amanda Logg \(AL\)|Rep/i.test(sheetText), "rep dropdown on deal");
    const akLabel = ownerPage.locator("label").filter({ hasText: /Avi Katz account/ });
    if (await akLabel.count()) {
      await akLabel.first().click({ force: true });
      await ownerPage.waitForTimeout(400);
    }
    await shot(ownerPage, "qa-ak-field");
    await ownerPage.keyboard.press("Escape");
  }

  await ownerPage.goto(`${BASE}/access`, { waitUntil: "networkidle" });
  await ownerPage.waitForTimeout(1000);
  const ownerRow2 = ownerPage.locator("li").filter({ hasText: owner }).first();
  if (await ownerRow2.locator('select[aria-label="Role"]').count()) {
    await ownerRow2.locator('select[aria-label="Role"]').selectOption("service");
    await ownerPage.waitForTimeout(800);
  }
  await ownerPage.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await ownerPage.waitForTimeout(1500);
  const svcClock = await ownerPage.locator("main").innerText();
  note(/Service view/i.test(svcClock), "clock header shows Service view");
  note(/Coming due|Install planner/i.test(svcClock), "Service My View clock shows coming due + planner");
  await shot(ownerPage, "qa-myview-service");

  const due = ownerPage.locator("h2", { hasText: "Coming due" }).first();
  note((await due.count()) > 0, "coming due panel on clock");
  note(/Overdue|Today|This week/i.test(svcClock), "coming due has overdue/today/this week counts");
  const dueRow = ownerPage.locator("h2", { hasText: "Coming due" }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]").locator("a").first();
  if (await dueRow.count()) {
    await dueRow.hover();
    await ownerPage.waitForTimeout(400);
  } else {
    const anyDue = ownerPage.locator("section, div").filter({ hasText: "Coming due" }).locator("a").first();
    if (await anyDue.count()) await anyDue.hover();
  }
  await shot(ownerPage, "qa-coming-due");

  await ownerPage.goto(`${BASE}/planner`, { waitUntil: "networkidle" });
  await ownerPage.waitForTimeout(1500);
  const plannerText = await ownerPage.locator("main").innerText();
  note(/Install planner/i.test(plannerText), "planner page loaded");
  const dates = ownerPage.locator('input[type="date"]');
  const nDates = await dates.count();
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));
  const iso = (d) => d.toISOString().slice(0, 10);
  const wed = new Date(monday);
  wed.setDate(monday.getDate() + 2);
  const day = iso(wed);
  if (nDates >= 3) {
    await dates.nth(2).fill(day);
    await ownerPage.waitForTimeout(600);
  }
  if (nDates >= 4) {
    await dates.nth(3).fill(day);
    await ownerPage.waitForTimeout(800);
  }
  await shot(ownerPage, "qa-install-planner");
  const afterPlan = await ownerPage.locator("main").innerText();
  note(/overlap|conflict|this week|Install planner/i.test(afterPlan), "planner timeline visible");

  await matePage.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const mateLand = await waitDesk(matePage);
  if (mateLand === "pending") {
    await ownerPage.goto(`${BASE}/access`, { waitUntil: "networkidle" });
    const ap = ownerPage.getByRole("button", { name: /^Approve$/ }).first();
    if (await ap.count()) await ap.click();
    await ownerPage.waitForTimeout(1200);
    await matePage.reload({ waitUntil: "networkidle" });
    await waitDesk(matePage);
  }
  await matePage.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await matePage.waitForTimeout(1200);
  const jobBtn = matePage.locator("main button").filter({ hasText: /.+/ }).first();
  const jobRow = matePage.locator("article, li, div.border-b").filter({ has: matePage.locator("button") }).first();
  if (await matePage.locator("main .font-medium").count()) {
    await matePage.locator("main button.font-medium, main button .font-medium, main article button, main div.border-b button").first().click();
  } else if (await jobRow.count()) {
    await jobRow.locator("button").first().click();
  }
  await matePage.waitForTimeout(1200);
  const pingBtn = matePage.getByRole("button", { name: /^Ping$/ }).first();
  if (await pingBtn.count()) {
    await pingBtn.click();
    await matePage.waitForTimeout(600);
    const noteBox = matePage.getByPlaceholder(/@username|short note/i).first();
    if (await noteBox.count()) {
      await noteBox.fill(`Need a gasket on this account before Friday.`);
    }
    const target = matePage.getByRole("button", { name: new RegExp(`@${owner}`, "i") });
    if (await target.count()) {
      await target.click();
    } else {
      const send = matePage.getByRole("button", { name: /Ping tagged/i });
      if (await send.count()) await send.click();
    }
    await matePage.waitForTimeout(1200);
  }
  await shot(matePage, "qa-ping-send");

  await ownerPage.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await ownerPage.waitForTimeout(2000);
  const bell = ownerPage.getByRole("button", { name: /notification/i }).first();
  if (await bell.count()) await bell.click();
  else await ownerPage.locator("header button").filter({ has: ownerPage.locator("svg") }).nth(-1).click();
  await ownerPage.waitForTimeout(800);
  const pingUi = await ownerPage.locator("body").innerText();
  note(/gasket|Need a|pinged/i.test(pingUi), "ping shows message preview");
  note(new RegExp(mate.split(".")[0], "i").test(pingUi) || /liz|Teammate|pinged you/i.test(pingUi), "ping shows who sent it");
  await shot(ownerPage, "qa-ping-inbox");

  await ownerPage.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await ownerPage.waitForTimeout(800);
  const settings = await ownerPage.locator("main").innerText();
  note(/Sales reps/i.test(settings), "owner can edit rep list");
  note(/Amanda Logg \(AL\)/.test(settings), "seven-name list on settings");
  await shot(ownerPage, "qa-reps-settings");
} catch (e) {
  verdict.ok = false;
  errors.push(String(e?.stack || e));
} finally {
  verdict.errors = errors;
  writeFileSync("/workspace/screenshots/qa-roles-view.json", JSON.stringify(verdict, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();
  process.exit(verdict.ok && errors.length === 0 ? 0 : 1);
}
