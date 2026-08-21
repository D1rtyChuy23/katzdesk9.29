import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`page: ${e}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

const shot = async (name) => {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
};

async function clearPending() {
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("katz-desk-pending");
    } catch {
      /* ignore */
    }
  });
}

async function signup(username, email, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await clearPending();
  await page.reload({ waitUntil: "networkidle" });
  const back = page.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(3500);
}

const user = `chuy.ops${Date.now().toString(36).slice(-4)}`;
const pass = "DeskPublish99!";
const teammate = `teammate.${Date.now().toString(36).slice(-4)}`;
const verdict = { user, pages: {}, pending: false, access: false, errors: [] };

try {
  await signup(user, `${user}@katz.test`, pass);
  await shot("pub-clock");
  const clock = await page.locator("body").innerText();
  verdict.pages.clock = /Operations clock|Today,|Active calls|Waiting for approval/i.test(clock);
  verdict.clockApproved = /Operations clock|Active calls/i.test(clock);
  verdict.waiting = /Waiting for approval/i.test(clock);

  if (verdict.clockApproved) {
    const routes = [
      ["/service", "pub-service", /Service/i],
      ["/tlc", "pub-tlc", /TLC|Factor/i],
      ["/pms", "pub-pms", /PM/i],
      ["/pipeline", "pub-pipeline", /Pipeline|deal/i],
      ["/installs", "pub-installs", /Install/i],
      ["/handoff", "pub-handoff", /Handoff|Mine/i],
      ["/warehouse", "pub-warehouse", /Warehouse|Barn/i],
      ["/locations", "pub-locations", /Location|Deployed/i],
      ["/modules", "pub-modules", /Module/i],
      ["/recipes", "pub-recipes", /Recipe|House/i],
      ["/access", "pub-access", /Access|Waiting|Approved/i],
    ];
    for (const [path, name, re] of routes) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      const text = await page.locator("body").innerText();
      verdict.pages[path] = re.test(text);
      if (path === "/access") verdict.access = /Waiting \(|Approved \(/i.test(text);
      await shot(name);
    }
    await page.getByRole("button", { name: /Sign out/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  await signup(teammate, `${teammate}@katz.test`, pass);
  await shot("pub-teammate-pending");
  verdict.pending = /Waiting for approval/i.test(await page.locator("body").innerText());
} catch (err) {
  verdict.errors.push(String(err));
  await shot("pub-crash");
}

verdict.console = errors.slice(0, 20);
writeFileSync("/workspace/screenshots/pub-check.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
const fatal = errors.filter((e) => !/favicon|fonts\.g|Download the React DevTools/i.test(e));
process.exit(verdict.clockApproved && verdict.pending && verdict.access && fatal.length === 0 && !verdict.errors.length ? 0 : 1);
