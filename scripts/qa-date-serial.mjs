import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
mkdirSync("/workspace/artifacts", { recursive: true });

const SERIAL = "0183330226105C0012";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`page: ${e}`));

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

async function signIn() {
  const stamp = Date.now().toString(36).slice(-4);
  const username = `chuy.ser${stamp}`;
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(`${username}@katz.test`);
  await page.locator("#password").fill("DeskSerial99!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(5000);
}

try {
  await signIn();

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const board = await page.locator("main").innerText();
  if (!/this week/i.test(board) || !/no date/i.test(board)) {
    throw new Error(`Install board missing this-week / no-date counts: ${board.slice(0, 500)}`);
  }
  await shot("install-date-counts");

  await page.getByRole("button", { name: /Export readiness/i }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: /^Preview$/ }).click();
  await page.waitForTimeout(3000);
  const preview = await page.getByRole("dialog").innerText();
  if (!/Install \/ scheduled date/i.test(preview)) {
    throw new Error(`Install preview missing date column: ${preview.slice(0, 800)}`);
  }
  await shot("export-install-dates");

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.getByRole("button", { name: /Download Excel/i }).click(),
  ]);
  const filename = download.suggestedFilename();
  const dest = `/workspace/artifacts/${filename}`;
  await download.saveAs(dest);
  const wb = XLSX.read(readFileSync(dest));
  if (wb.SheetNames.join() !== "Not ready,Ready") {
    throw new Error(`Sheets ${wb.SheetNames}`);
  }
  const notReady = XLSX.utils.sheet_to_json(wb.Sheets["Not ready"], { header: 1, defval: "" });
  const ready = XLSX.utils.sheet_to_json(wb.Sheets["Ready"], { header: 1, defval: "" });
  const nrHeader = notReady.find((r) => r.includes("Account"));
  const rHeader = ready.find((r) => r.includes("Account"));
  if (!nrHeader?.includes("Install / scheduled date")) {
    throw new Error(`Not ready header ${JSON.stringify(nrHeader)}`);
  }
  if (!rHeader?.includes("Install / scheduled date")) {
    throw new Error(`Ready header ${JSON.stringify(rHeader)}`);
  }
  const nrIdx = nrHeader.indexOf("Install / scheduled date");
  const acctIdx = nrHeader.indexOf("Account");
  if (nrIdx !== acctIdx + 1) throw new Error("Date should sit next to Account on Not ready");
  const rIdx = rHeader.indexOf("Install / scheduled date");
  if (rIdx !== rHeader.indexOf("Account") + 1) throw new Error("Date should sit next to Account on Ready");
  const nrData = notReady.filter((r) => r[0] && r[0] !== "Account" && r[0] !== "Install readiness" && !String(r[0]).startsWith("Generated") && !String(r[0]).includes("not ready") && !String(r[0]).includes("row"));
  writeFileSync(
    "/workspace/artifacts/install-dates-summary.json",
    JSON.stringify(
      {
        filename,
        notReadyHeader: nrHeader,
        readyHeader: rHeader,
        sampleNotReady: nrData.slice(0, 6).map((r) => ({ account: r[0], date: r[1], equipment: r[2], configuration: r[3] })),
        sampleReady: ready
          .filter((r) => r[0] && r[0] !== "Account" && !String(r[0]).startsWith("Generated") && r[0] !== "Install readiness")
          .slice(0, 4)
          .map((r) => ({ account: r[0], date: r[1], equipment: r[2], configuration: r[3] })),
      },
      null,
      2,
    ),
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  const first = page.locator("main button").filter({ hasText: /./ }).first();
  await page.locator("main").getByRole("button").nth(6).click({ timeout: 5000 }).catch(async () => {
    await page.getByText("Brews & Books").first().click();
  });
  const sheet = page.getByRole("dialog").or(page.locator("[role=dialog]"));
  // install uses a sheet, not always dialog
  await page.waitForTimeout(800);
  const sn = page.getByPlaceholder("Type the serial").first();
  if (!(await sn.count())) {
    await page.getByText(/not ready/i).first().click();
    await page.waitForTimeout(600);
  }
  const input = page.getByPlaceholder("Type the serial").first();
  if (!(await input.count())) {
    throw new Error("No serial field on install sheet");
  }
  await input.fill(SERIAL);
  await input.blur();
  await page.waitForTimeout(2500);
  await shot("serial-pull-install");
  const body = await page.locator("body").innerText();
  if (!/pulled from warehouse/i.test(body) && !/not found in warehouse/i.test(body)) {
    throw new Error(`No serial pull notice: ${body.slice(-800)}`);
  }
  if (!new RegExp(SERIAL.slice(0, 8), "i").test(body)) {
    throw new Error("Serial not shown after pull");
  }

  console.log(JSON.stringify({ ok: true, filename, dest, errors, bodyHit: /pulled from warehouse/i.test(body) }));
} catch (e) {
  await shot("date-serial-fail");
  console.error(e);
  console.log(JSON.stringify({ ok: false, error: String(e), errors }));
  process.exit(1);
} finally {
  await browser.close();
}
