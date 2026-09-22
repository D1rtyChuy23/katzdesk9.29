import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36).slice(-4);
const admin = `chuy.ops${stamp}`;
const teammate = `josh.${stamp}`;
const pass = "DeskOps99!!";

const browser = await chromium.launch({ headless: true });
const verdict = {
  admin,
  teammate,
  customersPage: false,
  addedCustomer: false,
  multiEquip: false,
  issueGrows: false,
  pingSent: false,
  attribution: false,
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
  const adminPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await signup(adminPage, admin, `${admin}@katz.test`);
  await adminPage.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
  await adminPage.waitForTimeout(800);
  const custText = await adminPage.locator("body").innerText();
  verdict.customersPage = /Customers/i.test(custText) && /Add customer/i.test(custText);
  await adminPage.getByPlaceholder("Add a customer name").fill(`Cafe ${stamp}`);
  await adminPage.getByRole("button", { name: "Add customer" }).click();
  await adminPage.waitForTimeout(800);
  verdict.addedCustomer = (await adminPage.locator("body").innerText()).includes(`Cafe ${stamp}`);
  await adminPage.screenshot({ path: "/workspace/screenshots/customers-admin.png" });

  await adminPage.goto(`${BASE}/access`, { waitUntil: "networkidle" });
  await adminPage.waitForTimeout(600);
  const emailBox = adminPage.getByPlaceholder(/email/i).first();
  if (await emailBox.count()) {
    await emailBox.fill(`${teammate}@katz.test`);
    const userBox = adminPage.getByPlaceholder(/username/i).first();
    if (await userBox.count()) await userBox.fill(teammate);
    await adminPage.getByRole("button", { name: /Send invite|Invite/i }).click();
    await adminPage.waitForTimeout(800);
  }

  const other = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await signup(other, teammate, `${teammate}@katz.test`);
  await other.waitForTimeout(1500);

  await adminPage.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await adminPage.getByText(/SC-/).first().waitFor({ timeout: 15000 });
  await adminPage.locator("li button").filter({ hasText: /SC-/ }).first().click();
  await adminPage.locator("[role=dialog]").waitFor({ state: "visible", timeout: 8000 });
  const sheet = adminPage.locator("[role=dialog]");
  const issue = sheet.locator("#issue");
  const hBefore = await issue.evaluate((el) => el.scrollHeight);
  await issue.click();
  await issue.fill(
    "Steam wand leaking on the bar plus a second machine throwing a boiler alarm that needs a long description so the issue field has to grow with the extra lines of text we are adding here.",
  );
  await adminPage.waitForTimeout(250);
  const h2 = await issue.evaluate((el) => el.scrollHeight);
  const issueH = await issue.evaluate((el) => el.getBoundingClientRect().height);
  verdict.issueGrows = h2 >= 60 && issueH >= 44;
  await sheet.screenshot({ path: "/workspace/screenshots/service-issue-equip.png" });

  const combo = sheet.getByRole("combobox", { name: "Equipment" });
  await combo.click();
  await adminPage.waitForTimeout(300);
  const pick = adminPage.locator("[role=listbox] [role=option]").first();
  if (await pick.count()) {
    await pick.click();
    await adminPage.waitForTimeout(250);
    await combo.click().catch(() => {});
    await adminPage.waitForTimeout(200);
    const pick2 = adminPage.locator("[role=listbox] [role=option]").nth(1);
    if (await pick2.count()) await pick2.click();
  }
  const equipVal = await sheet.locator("input[name=equipment]").inputValue().catch(() => "");
  const chipCount = await sheet.locator("[role=combobox] span").count();
  verdict.multiEquip = equipVal.includes("\n") || chipCount >= 1 || equipVal.length > 2;

  await sheet.getByRole("button", { name: "Save" }).click();
  await adminPage.waitForTimeout(900);
  const afterSave = await sheet.innerText();
  verdict.attribution = /Who changed this|@chuy/i.test(afterSave);

  const noteBox = sheet.getByPlaceholder("Write a note… tag @username to ping them");
  await noteBox.fill(`@${teammate} see this message and respond asap`);
  await sheet.getByRole("button", { name: "Post" }).click();
  await adminPage.waitForTimeout(1200);
  const afterNote = await sheet.innerText();
  verdict.pingSent = new RegExp(`@${teammate}|see this message`, "i").test(afterNote);

  await sheet.screenshot({ path: "/workspace/screenshots/service-handoff-ping.png" });

  await other.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await other.waitForTimeout(2000);
  const bell = other.locator("button").filter({ has: other.locator("svg") }).nth(0);
  await other.getByRole("button", { name: /notification/i }).click().catch(() => bell.click());
  await other.waitForTimeout(500);
  const otherText = await other.locator("body").innerText();
  verdict.pingReceived = /pinged you|see this message|respond asap/i.test(otherText);
  await other.screenshot({ path: "/workspace/screenshots/teammate-ping.png" });
} catch (e) {
  verdict.errors.push(String(e));
} finally {
  await browser.close();
  console.log(JSON.stringify(verdict, null, 2));
  if (!verdict.customersPage || !verdict.addedCustomer || !verdict.issueGrows || verdict.errors.length) {
    process.exit(1);
  }
}
