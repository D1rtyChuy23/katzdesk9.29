import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const verdict = {
  ok: false,
  emailOnlyInviteGetsIn: false,
  usernameMismatchGetsIn: false,
  waiterShowsOnAccess: false,
  waiterStaysOnWaiting: false,
  copyInviteVisible: false,
  signInByEmail: false,
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

async function clearPending(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("katz-desk-pending");
    } catch {
      /* ignore */
    }
  });
}

async function signup(page, username, email, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await clearPending(page);
  const back = page.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4500);
}

async function signInAs(page, identity, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await clearPending(page);
  const back = page.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  const createToggle = page.getByRole("button", { name: /Already have an account|Sign in/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(identity);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForTimeout(4000);
}

async function signOut(page) {
  const btn = page.getByRole("button", { name: /Sign out/i }).first();
  if (await btn.count()) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(1200);
  }
}

const stamp = Date.now().toString(36).slice(-5);
const admin = `chuy.fix${stamp}`;
const emailUser = `mail.${stamp}`;
const nameUser = `name.${stamp}`;
const waiter = `wait.${stamp}`;
const pass = "DeskInvite99!";

const adminPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
attach(adminPage);

try {
  await signup(adminPage, admin, `${admin}@katz.test`, pass);
  let body = await adminPage.locator("body").innerText();
  if (!/Operations clock|Active calls|Service tracker/i.test(body)) {
    verdict.errors.push(`admin not on desk: ${body.slice(0, 220)}`);
  }
  verdict.steps.push("admin signed up");

  await adminPage.goto(`${BASE}/access`, { waitUntil: "networkidle" });
  await adminPage.waitForTimeout(700);
  body = await adminPage.locator("body").innerText();
  if (!/Save invite|Invite people/i.test(body)) verdict.errors.push("access form missing");

  await adminPage.locator("#invite-email").fill(`${emailUser}@katz.test`);
  await adminPage.getByRole("button", { name: /Save invite/i }).click();
  await adminPage.waitForTimeout(1200);

  await adminPage.locator("#invite-username").fill(nameUser);
  await adminPage.getByRole("button", { name: /Save invite/i }).click();
  await adminPage.waitForTimeout(1200);

  body = await adminPage.locator("body").innerText();
  verdict.copyInviteVisible = /Copy invite/i.test(body);
  await adminPage.screenshot({ path: "/workspace/screenshots/access-invite-fix.png", fullPage: true });
  verdict.steps.push("saved two invites");

  const mailPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  attach(mailPage);
  await signup(mailPage, `diff.${stamp}`, `${emailUser}@katz.test`, pass);
  const mailBody = await mailPage.locator("body").innerText();
  verdict.emailOnlyInviteGetsIn = /Operations clock|Active calls|Service tracker/i.test(mailBody);
  if (!verdict.emailOnlyInviteGetsIn) {
    verdict.errors.push(`email-only invite did not get in: ${mailBody.slice(0, 220)}`);
  }
  await mailPage.screenshot({ path: "/workspace/screenshots/invite-email-only.png" });
  await mailPage.close();
  verdict.steps.push(`email-only invite in=${verdict.emailOnlyInviteGetsIn}`);

  const namePage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  attach(namePage);
  await signup(namePage, nameUser, `other.${stamp}@gmail.test`, pass);
  const nameBody = await namePage.locator("body").innerText();
  verdict.usernameMismatchGetsIn = /Operations clock|Active calls|Service tracker/i.test(nameBody);
  if (!verdict.usernameMismatchGetsIn) {
    verdict.errors.push(`username invite + other email did not get in: ${nameBody.slice(0, 220)}`);
  }
  await namePage.screenshot({ path: "/workspace/screenshots/invite-username-other-email.png" });
  await namePage.close();
  verdict.steps.push(`username mismatch in=${verdict.usernameMismatchGetsIn}`);

  const waitPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  attach(waitPage);
  await signup(waitPage, waiter, `${waiter}@katz.test`, pass);
  const waitBody = await waitPage.locator("body").innerText();
  verdict.waiterStaysOnWaiting = /Waiting for approval/i.test(waitBody);
  if (!verdict.waiterStaysOnWaiting) {
    verdict.errors.push(`waiter not on waiting: ${waitBody.slice(0, 220)}`);
  }
  await waitPage.screenshot({ path: "/workspace/screenshots/invite-waiter.png" });
  verdict.steps.push(`waiter waiting=${verdict.waiterStaysOnWaiting}`);

  await adminPage.goto(`${BASE}/access`, { waitUntil: "networkidle" });
  await adminPage.waitForTimeout(1500);
  const accessAfter = await adminPage.locator("body").innerText();
  verdict.waiterShowsOnAccess =
    accessAfter.includes(waiter) || /Signing up|Waiting for approval/i.test(accessAfter);
  if (!accessAfter.includes(waiter)) {
    verdict.errors.push(`waiter not listed on access: ${accessAfter.slice(0, 400)}`);
  }
  await adminPage.screenshot({ path: "/workspace/screenshots/access-after-signups.png", fullPage: true });

  await waitPage.close();
  await signOut(adminPage);
  await signInAs(adminPage, `${admin}@katz.test`, pass);
  const byEmail = await adminPage.locator("body").innerText();
  verdict.signInByEmail = /Operations clock|Active calls|Service tracker/i.test(byEmail);
  if (!verdict.signInByEmail) verdict.errors.push(`sign in by email failed: ${byEmail.slice(0, 220)}`);
  verdict.steps.push(`sign-in by email=${verdict.signInByEmail}`);
} catch (e) {
  verdict.errors.push(String(e));
}

verdict.errors.push(...errors);
verdict.ok =
  verdict.emailOnlyInviteGetsIn &&
  verdict.usernameMismatchGetsIn &&
  verdict.waiterShowsOnAccess &&
  verdict.waiterStaysOnWaiting &&
  verdict.copyInviteVisible &&
  verdict.errors.filter((e) => !/^console:/.test(e)).length === 0;

writeFileSync("/workspace/screenshots/qa-invite-fix.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.ok ? 0 : 1);
