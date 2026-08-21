import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shot = async (name) => {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
};
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const user = `qa.dash${Date.now().toString(36).slice(-4)}`;
const pass = "QaDesk-charts9x!";
const other = `qa.ping${Date.now().toString(36).slice(-4)}`;

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Need an account/i }).click();
await page.locator("#username").fill(user);
await page.locator("#email").fill(`${user}@katz.test`);
await page.locator("#password").fill(pass);
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForTimeout(2500);
await shot("clock-after-login");

const clockText = await page.locator("body").innerText();
const hasCharts = /Call mix|Coming due|Ready in the barn|Ready modules/i.test(clockText);
const hasBell = (await page.locator('button[aria-label*="notification" i]').count()) > 0;

await page.goto(`${BASE}/modules`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("modules-dashboard");
const modulesText = await page.locator("body").innerText();
const readyBreakdown = /Ready/i.test(modulesText) && /Brew|Milk|Grinder|Steam|Hydraulic/i.test(modulesText);
const modulesSort = await page.locator('select[aria-label="Sort this list"]').count();

await page.goto(`${BASE}/pipeline`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("pipeline-charts");
const pipeText = await page.locator("body").innerText();
const pipeCharts = /By producer|How deals move/i.test(pipeText);
const pipeSort = await page.locator('select[aria-label="Sort this list"]').count();

await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const svcSort = await page.locator('select[aria-label="Sort this list"]').count();

await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const instSort = await page.locator('select[aria-label="Sort this list"]').count();
await shot("installs-ready");

await page.goto(`${BASE}/handoff`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("button", { name: /^All$/ }).click().catch(() => {});
await page.waitForTimeout(400);
const pingCount = await page.getByRole("button", { name: /^Ping$/ }).count();
await shot("handoff-ping");

await page.getByRole("button", { name: /Sign out/i }).click();
await page.waitForTimeout(1200);
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Need an account|Create one/i }).click();
await page.locator("#username").fill(other);
await page.locator("#email").fill(`${other}@katz.test`);
await page.locator("#password").fill(pass);
await page.getByRole("button", { name: /Create account/i }).click();
await page.waitForTimeout(2000);
const pending = /Waiting for approval/i.test(await page.locator("body").innerText());
await shot("login-pending-second");

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Already have an account|Sign in/i }).click().catch(() => {});
await page.locator("#username").fill(user);
await page.locator("#password").fill(pass);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForTimeout(2000);

await page.goto(`${BASE}/access`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const approve = page.getByRole("button", { name: "Approve" }).first();
if (await approve.count()) await approve.click();
await page.waitForTimeout(800);
await shot("access-approved-teammate");

await page.goto(`${BASE}/handoff`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^All$/ }).click().catch(() => {});
await page.waitForTimeout(400);
const pingBtn = page.getByRole("button", { name: /^Ping$/ }).first();
let pingMenu = 0;
if (await pingBtn.count()) {
  await pingBtn.click();
  await page.waitForTimeout(400);
  pingMenu = await page.getByRole("button", { name: other }).count();
  if (pingMenu) {
    await page.getByRole("button", { name: other }).click();
    await page.waitForTimeout(800);
  }
  await shot("handoff-ping-menu");
}

await page.getByRole("button", { name: /Sign out/i }).click();
await page.waitForTimeout(1000);
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.locator("#username").fill(other);
await page.locator("#password").fill(pass);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForTimeout(2000);
await page.locator('button[aria-label*="notification" i]').first().click().catch(() => {});
await page.waitForTimeout(400);
await shot("inbox-after-ping");
const inboxText = await page.locator("body").innerText();
const gotPing = /pinged you/i.test(inboxText);

console.log(
  JSON.stringify(
    {
      user,
      hasCharts,
      hasBell,
      readyBreakdown,
      modulesSort,
      pipeCharts,
      pipeSort,
      svcSort,
      instSort,
      pingCount,
      pending,
      pingMenu,
      gotPing,
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
