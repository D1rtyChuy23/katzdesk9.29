import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const verdict = { usernamePage: false, sheetOpen: false, sheetScrolled: false, errors: [] };

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => verdict.errors.push(String(e)));

  const stamp = Date.now().toString(36).slice(-5);
  const email = `oauth.${stamp}@katz.test`;
  const pass = "DeskInvite99!";

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const signup = await page.evaluate(async ({ email, pass }) => {
    const res = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass, name: "OAuth Guest" }),
    });
    return { status: res.status, body: (await res.text()).slice(0, 400) };
  }, { email, pass });
  verdict.signup = signup;

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const setupText = await page.locator("body").innerText();
  verdict.homePrefix = setupText.slice(0, 280);
  verdict.usernamePage = /Choose a username/i.test(setupText);
  await page.screenshot({ path: "/workspace/screenshots/username-setup.png" });

  if (verdict.usernamePage) {
    await page.locator("#setup-username").fill(`oauth.${stamp}`);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForTimeout(2500);
    const after = await page.locator("body").innerText();
    verdict.afterUsername = after.slice(0, 200);
    await page.screenshot({ path: "/workspace/screenshots/username-setup-after.png" });
  }

  const desk = await browser.newPage({ viewport: { width: 390, height: 844 } });
  desk.on("pageerror", (e) => verdict.errors.push(`desk: ${e}`));
  await desk.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const back = desk.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  const create = desk.getByRole("button", { name: /Need an account|Create one/i });
  if (await create.count()) await create.click();
  const admin = `chuy.m${stamp}`;
  await desk.locator("#username").fill(admin);
  await desk.locator("#email").fill(`${admin}@katz.test`);
  await desk.locator("#password").fill(pass);
  await desk.getByRole("button", { name: "Create account" }).click();
  await desk.waitForTimeout(4000);
  verdict.deskPrefix = (await desk.locator("body").innerText()).slice(0, 200);
  await desk.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await desk.waitForTimeout(1500);
  verdict.servicePrefix = (await desk.locator("body").innerText()).slice(0, 240);
  const row = desk.locator("li button").first();
  const rowCount = await row.count();
  verdict.rowCount = rowCount;
  if (rowCount) {
    await row.click();
    await desk.waitForTimeout(1500);
    const dialog = desk.locator("[role='dialog']");
    const dialogCount = await dialog.count();
    verdict.dialogCount = dialogCount;
    if (dialogCount) {
      const txt = await dialog.first().innerText();
      verdict.sheetOpen = /Service call|Handoff notes|Issue|Technician/i.test(txt);
      verdict.sheetPrefix = txt.slice(0, 240);
      await desk.screenshot({ path: "/workspace/screenshots/service-call-mobile-open.png" });
      const scroller = desk.locator(".sheet-scroll").last();
      if (await scroller.count()) {
        await scroller.evaluate((el) => {
          el.scrollTop = 900;
        });
        await desk.waitForTimeout(400);
        const m = await scroller.evaluate((el) => ({ top: el.scrollTop, sh: el.scrollHeight, ch: el.clientHeight }));
        verdict.sheetScroll = m;
        verdict.sheetScrolled = m.top > 100 && m.sh > m.ch;
        await desk.screenshot({ path: "/workspace/screenshots/service-call-mobile-scrolled.png" });
      }
    } else {
      await desk.screenshot({ path: "/workspace/screenshots/service-call-mobile-open.png" });
    }
  }
} catch (e) {
  verdict.errors.push(String(e));
} finally {
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();
}
