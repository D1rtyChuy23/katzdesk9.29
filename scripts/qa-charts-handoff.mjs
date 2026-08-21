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

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

async function signIn() {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("katz-desk-pending");
    } catch {
      /* ignore */
    }
  });
  const back = page.getByRole("button", { name: /Back to sign in/i });
  if (await back.count()) await back.click();
  await page.locator("#username").fill("chuy.opsxhw6");
  await page.locator("#password").fill("DeskPublish99!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(4000);
}

const verdict = { pages: {}, errors };

try {
  await signIn();
  const routes = [
    ["/", "fix-clock", /Operations clock|Ready in the barn/i],
    ["/service", "fix-service", /On the truck|Active by status/i],
    ["/pms", "fix-pms", /By style|Active by status/i],
    ["/pipeline", "fix-pipeline", /How deals move|Deal size|By producer/i],
    ["/installs", "fix-installs", /Ready machines|Board mix/i],
    ["/handoff", "fix-handoff", /Handoff/i],
    ["/warehouse", "fix-warehouse", /Ready by model/i],
    ["/locations", "fix-locations", /Deployed by location/i],
    ["/modules", "fix-modules", /Ready by type/i],
  ];
  for (const [path, name, re] of routes) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    if (path === "/handoff") {
      const all = page.getByRole("button", { name: /^All$/ });
      if (await all.count()) await all.click();
      await page.waitForTimeout(400);
    }
    const text = await page.locator("body").innerText();
    verdict.pages[path] = { ok: re.test(text), sample: text.slice(0, 180).replace(/\s+/g, " ") };
    await shot(name);
  }
} catch (e) {
  verdict.crash = String(e);
  await shot("fix-crash").catch(() => {});
}

verdict.errors = errors;
writeFileSync("/workspace/screenshots/fix-charts.json", JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.crash || errors.length ? 1 : 0);
