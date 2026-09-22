import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const verdict = {
  admin: null,
  teammate: null,
  invitedJoinsDesk: false,
  uninvitedWaits: false,
  accessHasInvite: false,
  pendingInviteShows: false,
  usernameSetupSkippedWhenChosen: false,
  loginMentionsUsername: false,
  mobileSheetScrolls: false,
  mobileSheetOverflow: null,
  mobileSheetHeights: null,
  errors: [],
};

async function attach(page) {
  page.on("pageerror", (e) => errors.push(`page: ${e}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
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
  await page.reload({ waitUntil: "networkidle" });
  const back = page.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4000);
}

async function signOut(page) {
  const btn = page.getByRole("button", { name: /Sign out/i }).first();
  if (await btn.count()) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(1500);
  }
}

const stamp = Date.now().toString(36).slice(-5);
const admin = `chuy.ops${stamp}`;
const teammate = `invited.${stamp}`;
const waiter = `waiting.${stamp}`;
const pass = "DeskInvite99!";
verdict.admin = admin;
verdict.teammate = teammate;

const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await attach(desktop);

try {
  await signup(desktop, admin, `${admin}@katz.test`, pass);
  const afterAdmin = await desktop.locator("body").innerText();
  const adminIn = /Operations clock|Active calls|Service tracker/i.test(afterAdmin);
  if (!adminIn) {
    verdict.errors.push(`admin did not land on desk: ${afterAdmin.slice(0, 280)}`);
  }
  verdict.usernameSetupSkippedWhenChosen = !/Choose a username/i.test(afterAdmin);

  await desktop.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const loginText = await desktop.locator("body").innerText();
  verdict.loginMentionsUsername = /username/i.test(loginText) && /password/i.test(loginText);

  await desktop.goto(`${BASE}/access`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(800);
  const accessText = await desktop.locator("body").innerText();
  verdict.accessHasInvite = /Invite people/i.test(accessText) && /Save invite|Send invite/i.test(accessText);
  await desktop.screenshot({ path: "/workspace/screenshots/access-invite.png", fullPage: true });

  await desktop.locator("#invite-email").fill(`${teammate}@katz.test`);
  await desktop.locator("#invite-username").fill(teammate);
  await desktop.getByRole("button", { name: /Save invite|Send invite/i }).click();
  await desktop.waitForTimeout(1500);
  const afterInvite = await desktop.locator("body").innerText();
  verdict.pendingInviteShows =
    /Pending invites/i.test(afterInvite) &&
    (afterInvite.includes(teammate) || /Invite sent|Approved/i.test(afterInvite));
  await desktop.screenshot({ path: "/workspace/screenshots/access-invite-sent.png", fullPage: true });

  await signOut(desktop);
  await signup(desktop, teammate, `${teammate}@katz.test`, pass);
  const teammateBody = await desktop.locator("body").innerText();
  verdict.invitedJoinsDesk = /Operations clock|Active calls|Service tracker/i.test(teammateBody);
  verdict.teammateSawWait = /Waiting for approval/i.test(teammateBody);
  await desktop.screenshot({ path: "/workspace/screenshots/invite-teammate-in.png", fullPage: true });

  await signOut(desktop);
  await signup(desktop, waiter, `${waiter}@katz.test`, pass);
  const waiterBody = await desktop.locator("body").innerText();
  verdict.uninvitedWaits = /Waiting for approval/i.test(waiterBody);
  await desktop.screenshot({ path: "/workspace/screenshots/invite-uninvited-wait.png", fullPage: true });
} catch (e) {
  verdict.errors.push(String(e));
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await attach(mobile);
try {
  await signup(mobile, admin, `${admin}@katz.test`, pass);
  const maybeIn = mobile.getByRole("button", { name: /Need an account|Create one|Already have/i });
  if (await mobile.getByRole("button", { name: "Sign in" }).count()) {
    const back = mobile.getByRole("button", { name: /Back to sign in|Already have an account/i });
    if (await back.count()) await back.click();
    if (await maybeIn.count()) {
      const label = await maybeIn.first().innerText();
      if (/Need an account/i.test(label)) {
        /* already on sign in */
      } else {
        await maybeIn.first().click();
      }
    }
    await mobile.locator("#username").fill(admin);
    await mobile.locator("#password").fill(pass);
    await mobile.getByRole("button", { name: "Sign in" }).click();
    await mobile.waitForTimeout(3500);
  }

  await mobile.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(1200);
  const row = mobile.locator("li button").first();
  if (await row.count()) {
    await row.click();
    await mobile.waitForTimeout(1200);
    const scroll = mobile.locator(".sheet-scroll").first();
    if (await scroll.count()) {
      const metrics = await scroll.evaluate((el) => {
        const cs = getComputedStyle(el);
        const parent = el.parentElement;
        const pcs = parent ? getComputedStyle(parent) : null;
        el.scrollTop = 180;
        const after = el.scrollTop;
        return {
          overflowY: cs.overflowY,
          touchAction: cs.touchAction,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          windowHeight: window.innerHeight,
          parentOverflow: pcs?.overflowY ?? null,
          parentHeight: parent ? parent.clientHeight : null,
          scrolledTo: after,
        };
      });
      verdict.mobileSheetHeights = metrics;
      verdict.mobileSheetOverflow = metrics.overflowY;
      verdict.mobileSheetScrolls =
        (metrics.overflowY === "scroll" || metrics.overflowY === "auto") &&
        metrics.clientHeight < metrics.windowHeight &&
        metrics.scrollHeight > metrics.clientHeight &&
        metrics.scrolledTo > 0;
      await mobile.screenshot({ path: "/workspace/screenshots/service-sheet-mobile.png" });
    } else {
      verdict.errors.push("open call: no .sheet-scroll");
      await mobile.screenshot({ path: "/workspace/screenshots/service-sheet-mobile.png" });
    }
  } else {
    verdict.errors.push("no service rows to open");
    await mobile.screenshot({ path: "/workspace/screenshots/service-sheet-mobile.png" });
  }
} catch (e) {
  verdict.errors.push(`mobile: ${e}`);
}

verdict.errors.push(...errors);
writeFileSync("/workspace/screenshots/qa-access-invites.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.invitedJoinsDesk && verdict.accessHasInvite && verdict.errors.filter((e) => !/^console:/.test(e)).length === 0 ? 0 : 1);
